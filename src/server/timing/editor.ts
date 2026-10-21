import "server-only";
import { clampMs, type TimingRow } from "@/shared/timing/timing";
import { parseSnapshot } from "@/shared/timing/save-input";
import type { PrismaClient } from "@/server/db/generated/client";

export type EditorData = {
  recording: {
    id: string;
    status: "DRAFT" | "READY" | "PUBLISHED";
    bookSlug: string;
    chapter: number;
    verseStart: number;
    endChapter: number;
    verseEnd: number;
    genreName: string;
    arrangementNo: number;
  };
  /** The draft being edited, or null when a published recording has none yet. */
  draft: { id: string; version: number; basedOnPublished: boolean } | null;
  audioAssetId: string;
  durationMs: number;
  rows: TimingRow[];
};

export type SessionInfo = { id: string; savedAt: Date; version: number; filled: number };

export type SaveResult =
  { ok: true; savedAt: Date } | { ok: false; status: 404 | 409 | 422; error: string };

const SESSION_MERGE_MS = 5 * 60 * 1000;

function toRows(
  verses: {
    chapter: number;
    verse: number;
    startMs: number | null;
    endMs: number | null;
    ackGap: boolean;
    ackOverlap: boolean;
    note: string | null;
  }[],
): TimingRow[] {
  return [...verses]
    .sort((a, b) => a.chapter - b.chapter || a.verse - b.verse)
    .map((v) => ({ ...v }));
}

const filled = (rows: TimingRow[]) =>
  rows.filter((r) => r.startMs !== null && r.endMs !== null).length;

/**
 * The timing editor's reads and writes. It only ever changes the newest DRAFT timing sheet of a
 * recording: a published sheet is never edited in place (editing a published recording first
 * starts a new draft version), and the audio is never touched.
 */
export function createTimingEditor(client: PrismaClient) {
  async function workingDraft(recordingId: string) {
    return client.timingSet.findFirst({
      where: { recordingId, state: "DRAFT" },
      orderBy: { version: "desc" },
      include: { verses: true },
    });
  }

  return {
    async load(recordingId: string): Promise<EditorData | null> {
      const rec = await client.recording.findUnique({
        where: { id: recordingId },
        include: { book: true, genre: true, originalAsset: true },
      });
      if (!rec) return null;
      const draft = await workingDraft(recordingId);
      const published = rec.publishedTimingId
        ? await client.timingSet.findUnique({
            where: { id: rec.publishedTimingId },
            include: { verses: true, audioAsset: true },
          })
        : null;
      const shown = draft ?? published;
      const assetId = shown?.audioAssetId ?? rec.originalAssetId;
      const asset =
        assetId === rec.originalAssetId
          ? rec.originalAsset
          : await client.audioAsset.findUniqueOrThrow({ where: { id: assetId } });
      return {
        recording: {
          id: rec.id,
          status: rec.status,
          bookSlug: rec.book.slug,
          chapter: rec.chapter,
          verseStart: rec.verseStart,
          endChapter: rec.endChapter,
          verseEnd: rec.verseEnd,
          genreName: rec.genre.name,
          arrangementNo: rec.arrangementNo,
        },
        draft: draft
          ? {
              id: draft.id,
              version: draft.version,
              basedOnPublished: !!draft.basedOnId && draft.basedOnId === rec.publishedTimingId,
            }
          : null,
        audioAssetId: asset.id,
        durationMs: asset.durationMs,
        rows: shown ? toRows(shown.verses) : [],
      };
    },

    /**
     * Start a new draft version of a published recording's timing (same boundaries, same audio).
     * Listeners keep the published version until this draft is published. Does nothing if a
     * draft already exists.
     */
    async startDraft(recordingId: string, adminEmail: string): Promise<{ ok: boolean }> {
      const existing = await workingDraft(recordingId);
      if (existing) return { ok: true };
      const rec = await client.recording.findUnique({
        where: { id: recordingId },
        select: { publishedTimingId: true },
      });
      if (!rec?.publishedTimingId) return { ok: false };
      return client.$transaction(async (tx) => {
        const user = await tx.user.upsert({
          where: { email: adminEmail },
          update: {},
          create: { email: adminEmail, role: "ADMIN" },
        });
        const base = await tx.timingSet.findUniqueOrThrow({
          where: { id: rec.publishedTimingId! },
          include: { verses: true },
        });
        const latest = await tx.timingSet.findFirst({
          where: { recordingId },
          orderBy: { version: "desc" },
          select: { version: true },
        });
        await tx.timingSet.create({
          data: {
            recordingId,
            version: (latest?.version ?? base.version) + 1,
            state: "DRAFT",
            createdById: user.id,
            basedOnId: base.id,
            audioAssetId: base.audioAssetId,
            verses: {
              create: toRows(base.verses).map((v) => ({
                chapter: v.chapter,
                verse: v.verse,
                startMs: v.startMs,
                endMs: v.endMs,
                ackGap: v.ackGap,
                ackOverlap: v.ackOverlap,
                note: v.note,
              })),
            },
          },
        });
        return { ok: true };
      });
    },

    /**
     * Save the editor's rows into the draft sheet. The rows must be exactly the sheet's verses;
     * times must lie inside the audio. A boundary that moved clears that verse's gap/overlap
     * acknowledgements. A Ready recording goes back to Draft because its timing changed. Also
     * stores a snapshot for "return to an earlier session" (merged into the latest one if it is
     * recent, so autosave doesn't flood the history).
     */
    async save(
      recordingId: string,
      setId: string,
      rows: TimingRow[],
      opts: { newSession?: boolean } = {},
    ): Promise<SaveResult> {
      const set = await client.timingSet.findFirst({
        where: { id: setId, recordingId },
        include: {
          verses: true,
          recording: { include: { originalAsset: true } },
          audioAsset: true,
        },
      });
      if (!set) return { ok: false, status: 404, error: "That timing sheet was not found." };
      if (set.state !== "DRAFT") {
        return {
          ok: false,
          status: 409,
          error: "This timing is no longer a draft. Reload to continue with the current draft.",
        };
      }
      const durationMs = (set.audioAsset ?? set.recording.originalAsset).durationMs;

      const existing = new Map(set.verses.map((v) => [`${v.chapter}:${v.verse}`, v]));
      const sent = new Set(rows.map((r) => `${r.chapter}:${r.verse}`));
      if (
        rows.length !== existing.size ||
        sent.size !== rows.length ||
        rows.some((r) => !existing.has(`${r.chapter}:${r.verse}`))
      ) {
        return { ok: false, status: 422, error: "The verses do not match this recording." };
      }
      if (
        rows.some(
          (r) =>
            (r.startMs !== null && r.startMs > durationMs) ||
            (r.endMs !== null && r.endMs > durationMs),
        )
      ) {
        return { ok: false, status: 422, error: "A time is beyond the end of the recording." };
      }

      const savedAt = new Date();
      await client.$transaction(async (tx) => {
        for (const r of rows) {
          const old = existing.get(`${r.chapter}:${r.verse}`)!;
          const moved = old.startMs !== r.startMs || old.endMs !== r.endMs;
          const same =
            !moved &&
            old.ackGap === r.ackGap &&
            old.ackOverlap === r.ackOverlap &&
            (old.note ?? null) === (r.note ?? null);
          if (same) continue;
          await tx.verseTiming.update({
            where: { id: old.id },
            data: {
              startMs: r.startMs,
              endMs: r.endMs,
              // A boundary that moved invalidates the admin's earlier "this is intended".
              ackGap: moved ? false : r.ackGap,
              ackOverlap: moved ? false : r.ackOverlap,
              note: r.note ?? null,
            },
          });
        }
        if (set.recording.status === "READY") {
          await tx.recording.update({ where: { id: recordingId }, data: { status: "DRAFT" } });
        } else {
          await tx.recording.update({ where: { id: recordingId }, data: { updatedAt: savedAt } });
        }

        const snapshot = { rows: rows.map((r) => ({ ...r, note: r.note ?? null })) };
        const last = await tx.editSession.findFirst({
          where: { timingSetId: setId },
          orderBy: { savedAt: "desc" },
        });
        if (
          last &&
          !opts.newSession &&
          savedAt.getTime() - last.savedAt.getTime() < SESSION_MERGE_MS
        ) {
          await tx.editSession.update({ where: { id: last.id }, data: { snapshot, savedAt } });
        } else {
          await tx.editSession.create({
            data: { recordingId, timingSetId: setId, savedAt, snapshot },
          });
        }
      });
      return { ok: true, savedAt };
    },

    /** Earlier editing sessions of this recording, newest first. */
    async sessions(recordingId: string): Promise<SessionInfo[]> {
      const found = await client.editSession.findMany({
        where: { recordingId },
        orderBy: { savedAt: "desc" },
        take: 50,
        include: { timingSet: { select: { version: true } } },
      });
      return found.map((s) => ({
        id: s.id,
        savedAt: s.savedAt,
        version: s.timingSet.version,
        filled: filled(parseSnapshot(s.snapshot) ?? []),
      }));
    },

    /**
     * Put an earlier session's boundaries back into the current draft. The current state is
     * saved as its own session first, so a restore can itself be undone. Times that don't fit the
     * draft's audio are left blank rather than guessed.
     */
    async restore(recordingId: string, sessionId: string): Promise<SaveResult> {
      const session = await client.editSession.findFirst({
        where: { id: sessionId, recordingId },
      });
      const rows = session ? parseSnapshot(session.snapshot) : null;
      if (!session || !rows)
        return { ok: false, status: 404, error: "That session was not found." };
      const draft = await workingDraft(recordingId);
      if (!draft) return { ok: false, status: 409, error: "There is no draft to restore into." };

      const before = await this.save(recordingId, draft.id, toRows(draft.verses), {
        newSession: true,
      });
      if (!before.ok) return before;

      const rec = await client.timingSet.findUniqueOrThrow({
        where: { id: draft.id },
        include: { recording: { include: { originalAsset: true } }, audioAsset: true },
      });
      const durationMs = (rec.audioAsset ?? rec.recording.originalAsset).durationMs;
      const old = new Map(rows.map((r) => [`${r.chapter}:${r.verse}`, r]));
      const restored: TimingRow[] = toRows(draft.verses).map((v) => {
        const o = old.get(`${v.chapter}:${v.verse}`);
        const fit = (ms: number | null | undefined) =>
          ms === null || ms === undefined || ms > durationMs ? null : clampMs(ms, durationMs);
        return o
          ? { ...v, startMs: fit(o.startMs), endMs: fit(o.endMs), ackGap: false, ackOverlap: false }
          : v;
      });
      return this.save(recordingId, draft.id, restored, { newSession: true });
    },
  };
}
