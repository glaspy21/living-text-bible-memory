import "server-only";
import { createHash } from "node:crypto";
import { mp3DurationMs, wavDurationMs, type ReadBytes } from "@/shared/audio/duration";
import { isValidPeaks } from "@/shared/audio/peaks";
import {
  canonicalMime,
  isOriginalAudioKey,
  peaksKeyFor,
  sniffAudioKind,
  SNIFF_BYTES,
} from "@/shared/audio/upload-rules";
import { checkRecordingInput, type RecordingInput } from "@/shared/library/recording-input";
import { bookBySlug } from "@/shared/scripture/books";
import { expandPassage } from "@/shared/scripture/refs";
import type { PrismaClient } from "@/server/db/generated/client";
import type { StorageDriver } from "@/server/storage/types";

export type CreateResult =
  { ok: true; id: string } | { ok: false; status: 400 | 404 | 409 | 422; errors: string[] };

const HASH_CHUNK = 4 * 1024 * 1024;

/** A lowercase, hyphenated version of a genre name, for its URL-safe slug. */
export function genreSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Turns a verified upload into a draft recording: reads the file's length, fingerprints it, saves
 * the audio asset, recording and an empty timing draft (one blank row per verse, ready for the
 * timing editor), and stores the waveform. A matching passage never replaces an existing
 * recording: it becomes another one, numbered "Default 2", "Default 3", …
 */
export function createRecordings(deps: {
  client: PrismaClient;
  storage: StorageDriver;
  /** Verse count of each chapter of a book (chapter n is index n - 1). */
  verseCounts: (bookSlug: string) => Promise<number[]>;
}) {
  const { client, storage } = deps;

  async function fingerprint(key: string, size: number): Promise<string> {
    const hash = createHash("sha256");
    for (let start = 0; start < size; start += HASH_CHUNK) {
      const end = Math.min(start + HASH_CHUNK, size) - 1;
      hash.update(await storage.readBytes(key, { start, end }));
    }
    return hash.digest("hex");
  }

  type Inspected =
    | { ok: true; size: number; kind: "mp3" | "wav"; durationMs: number; sha256: string }
    | { ok: false; status: 400 | 404 | 422; errors: string[] };

  /** Check that an uploaded file is really MP3/WAV audio, then read its length and fingerprint. */
  async function inspectUpload(key: string): Promise<Inspected> {
    if (!isOriginalAudioKey(key)) {
      return { ok: false, status: 400, errors: ["Unknown upload."] };
    }
    const size = await storage.size(key);
    if (size === null) {
      return { ok: false, status: 404, errors: ["The file has not arrived yet."] };
    }
    const head = await storage.readBytes(key, { start: 0, end: SNIFF_BYTES - 1 });
    const kind = sniffAudioKind(head);
    if (!kind) return { ok: false, status: 422, errors: ["That file is not a real MP3 or WAV."] };

    const read: ReadBytes = async (start, length) =>
      length <= 0 || start >= size
        ? new Uint8Array()
        : storage.readBytes(key, { start, end: Math.min(start + length, size) - 1 });
    const durationMs =
      kind === "wav" ? await wavDurationMs(read, size) : await mp3DurationMs(read, size);
    if (!durationMs || durationMs <= 0) {
      return {
        ok: false,
        status: 422,
        errors: ["We couldn't read the length of this recording. Try exporting it again."],
      };
    }
    return { ok: true, size, kind, durationMs, sha256: await fingerprint(key, size) };
  }

  /** Store the waveform. A convenience: a failure to store it must not lose the recording. */
  async function savePeaks(key: string, peaks: number[] | undefined) {
    if (!peaks || !isValidPeaks(peaks)) return;
    try {
      const peaksKey = peaksKeyFor(key);
      await storage.put(
        peaksKey,
        new TextEncoder().encode(JSON.stringify(peaks)),
        "application/json",
      );
      await client.audioAsset.update({ where: { storageKey: key }, data: { peaksKey } });
    } catch (error) {
      console.warn("Waveform peaks could not be stored:", error);
    }
  }

  return {
    async createDraft(
      input: RecordingInput,
      adminEmail: string,
      peaks?: number[],
    ): Promise<CreateResult> {
      const book = bookBySlug(input.book);
      const counts = book ? await deps.verseCounts(book.slug) : [];
      const checked = checkRecordingInput(input, counts);
      if (!checked.ok) return { ok: false, status: 400, errors: checked.errors };
      const value = checked.value;

      const inspected = await inspectUpload(value.key);
      if (!inspected.ok) return inspected;
      const { size, kind, durationMs, sha256 } = inspected;

      const book_ = book!;
      const verses = expandPassage(
        {
          book: book_.slug,
          start: { chapter: value.chapter, verse: value.verseStart },
          end: { chapter: value.endChapter, verse: value.verseEnd },
        },
        counts,
      );

      try {
        const recordingId = await client.$transaction(async (tx) => {
          const user = await tx.user.upsert({
            where: { email: adminEmail },
            update: {},
            create: { email: adminEmail, role: "ADMIN" },
          });
          const translation = await tx.translation.findUniqueOrThrow({
            where: { code: value.translation },
          });

          const genre =
            value.genre.kind === "builtin"
              ? await tx.genre.findUniqueOrThrow({ where: { slug: value.genre.slug } })
              : await (async () => {
                  const name = value.genre.kind === "custom" ? value.genre.name : "";
                  const slug = genreSlug(name);
                  return (
                    (await tx.genre.findFirst({
                      where: { OR: [{ slug }, { name: { equals: name, mode: "insensitive" } }] },
                    })) ?? (await tx.genre.create({ data: { slug, name, isCustom: true } }))
                  );
                })();

          const samePassage = await tx.recording.count({
            where: {
              translationId: translation.id,
              bookId: book_.id,
              chapter: value.chapter,
              verseStart: value.verseStart,
              endChapter: value.endChapter,
              verseEnd: value.verseEnd,
              genreId: genre.id,
            },
          });

          const asset = await tx.audioAsset.create({
            data: {
              storageKey: value.key,
              mime: canonicalMime(kind),
              bytes: size,
              durationMs,
              sha256,
            },
          });
          const recording = await tx.recording.create({
            data: {
              translationId: translation.id,
              bookId: book_.id,
              chapter: value.chapter,
              verseStart: value.verseStart,
              endChapter: value.endChapter,
              verseEnd: value.verseEnd,
              genreId: genre.id,
              title: "Default",
              arrangementNo: samePassage + 1,
              description: value.description,
              status: "DRAFT",
              originalAssetId: asset.id,
              createdById: user.id,
            },
          });
          await tx.timingSet.create({
            data: {
              recordingId: recording.id,
              version: 1,
              state: "DRAFT",
              createdById: user.id,
              verses: {
                create: verses.map((v) => ({ chapter: v.chapter, verse: v.verse })),
              },
            },
          });
          return recording.id;
        });

        await savePeaks(value.key, peaks);
        return { ok: true, id: recordingId };
      } catch (error) {
        if ((error as { code?: string }).code === "P2002") {
          return {
            ok: false,
            status: 409,
            errors: ["This upload is already attached to a recording."],
          };
        }
        throw error;
      }
    },
    /**
     * Put new audio on an existing recording without losing anything. The old audio file is left
     * untouched; every timing sheet is first pinned to the audio it was made for, then a new draft
     * timing sheet is seeded from the latest one (same boundaries, acknowledgements cleared) for the
     * new audio. A published recording keeps playing its published timing and audio until the new
     * draft is published; a draft or ready one goes back to draft, as its timing needs another look.
     */
    async replaceAudio(
      recordingId: string,
      key: string,
      adminEmail: string,
      peaks?: number[],
    ): Promise<CreateResult> {
      const exists = await client.recording.findUnique({
        where: { id: recordingId },
        select: { id: true },
      });
      if (!exists) return { ok: false, status: 404, errors: ["That recording was not found."] };

      const inspected = await inspectUpload(key);
      if (!inspected.ok) return inspected;
      const { size, kind, durationMs, sha256 } = inspected;

      try {
        await client.$transaction(async (tx) => {
          const user = await tx.user.upsert({
            where: { email: adminEmail },
            update: {},
            create: { email: adminEmail, role: "ADMIN" },
          });
          const recording = await tx.recording.findUniqueOrThrow({
            where: { id: recordingId },
            include: {
              timingSets: {
                orderBy: { version: "desc" },
                include: { verses: true },
              },
            },
          });

          // Pin every sheet to the audio it was made for, so nothing is ambiguous afterwards.
          await tx.timingSet.updateMany({
            where: { recordingId, audioAssetId: null },
            data: { audioAssetId: recording.originalAssetId },
          });
          // An unpublished draft sheet is superseded (kept as history, never deleted).
          await tx.timingSet.updateMany({
            where: { recordingId, state: "DRAFT" },
            data: { state: "ARCHIVED" },
          });

          const asset = await tx.audioAsset.create({
            data: { storageKey: key, mime: canonicalMime(kind), bytes: size, durationMs, sha256 },
          });
          const latest = recording.timingSets[0];
          await tx.timingSet.create({
            data: {
              recordingId,
              version: (latest?.version ?? 0) + 1,
              state: "DRAFT",
              createdById: user.id,
              basedOnId: latest?.id,
              audioAssetId: asset.id,
              verses: {
                create: (latest?.verses ?? [])
                  .sort((a, b) => a.chapter - b.chapter || a.verse - b.verse)
                  .map((v) => ({
                    chapter: v.chapter,
                    verse: v.verse,
                    startMs: v.startMs,
                    endMs: v.endMs,
                    note: v.note,
                  })),
              },
            },
          });
          await tx.recording.update({
            where: { id: recordingId },
            data: {
              originalAssetId: asset.id,
              status: recording.status === "PUBLISHED" ? "PUBLISHED" : "DRAFT",
            },
          });
        });
      } catch (error) {
        if ((error as { code?: string }).code === "P2002") {
          return {
            ok: false,
            status: 409,
            errors: ["This upload is already attached to a recording."],
          };
        }
        throw error;
      }
      await savePeaks(key, peaks);
      return { ok: true, id: recordingId };
    },
  };
}
