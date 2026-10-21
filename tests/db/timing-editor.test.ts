import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTimingEditor } from "../../src/server/timing/editor";
import { createRecordings } from "../../src/server/library/recordings";
import { LocalStorageDriver } from "../../src/server/storage/local";
import type { RecordingInput } from "../../src/shared/library/recording-input";
import { testClient } from "./test-db";

const prisma = testClient();
const tag = `te${Date.now()}`;
const adminEmail = `${tag}@example.test`;
let storage: LocalStorageDriver;
let counter = 0;

/** A mono WAV of the given length (real header, silent samples). */
function wav(seconds: number): Uint8Array {
  const rate = 8000;
  const samples = rate * seconds;
  const b = Buffer.alloc(44 + samples * 2);
  b.write("RIFF", 0);
  b.writeUInt32LE(36 + samples * 2, 4);
  b.write("WAVE", 8);
  b.write("fmt ", 12);
  b.writeUInt32LE(16, 16);
  b.writeUInt16LE(1, 20);
  b.writeUInt16LE(1, 22);
  b.writeUInt32LE(rate, 24);
  b.writeUInt32LE(rate * 2, 28);
  b.writeUInt16LE(2, 32);
  b.writeUInt16LE(16, 34);
  b.write("data", 36);
  b.writeUInt32LE(samples * 2, 40);
  return new Uint8Array(b);
}

async function upload(seconds = 12): Promise<string> {
  const bytes = wav(seconds);
  // A different length gives a different file, so the fingerprint differs too.
  const key = `recordings/${tag}-${++counter}-aaaa/original.wav`;
  await storage.write(
    key,
    new ReadableStream({
      start(controller) {
        controller.enqueue(bytes);
        controller.close();
      },
    }),
    bytes.length,
  );
  return key;
}

const input = (key: string, over: Partial<RecordingInput> = {}): RecordingInput => ({
  key,
  translation: "WEB",
  book: "joel",
  chapter: 1,
  verseStart: 1,
  endChapter: 1,
  verseEnd: 3,
  genre: { kind: "builtin", slug: "pop" },
  ...over,
});

const service = () =>
  createRecordings({ client: prisma, storage, verseCounts: async () => Array(10).fill(30) });

/** A draft with all three verses timed. */
async function timedDraft(over: Partial<RecordingInput> = {}) {
  const key = await upload(12);
  const chapter = over.chapter ?? 1;
  const created = await service().createDraft(
    input(key, { endChapter: chapter, ...over }),
    adminEmail,
  );
  if (!created.ok) throw new Error(created.errors.join());
  const set = await prisma.timingSet.findFirstOrThrow({ where: { recordingId: created.id } });
  for (const [i, verse] of [1, 2, 3].entries()) {
    await prisma.verseTiming.updateMany({
      where: { timingSetId: set.id, verse },
      data: { startMs: i * 3000, endMs: i * 3000 + 2500, ackGap: true },
    });
  }
  return { id: created.id, key, setId: set.id };
}

async function publish(recordingId: string, setId: string) {
  await prisma.timingSet.update({ where: { id: setId }, data: { state: "PUBLISHED" } });
  await prisma.recording.update({
    where: { id: recordingId },
    data: { status: "PUBLISHED", publishedTimingId: setId },
  });
}

beforeAll(async () => {
  storage = new LocalStorageDriver(await mkdtemp(path.join(tmpdir(), "lt-db-")), "db-test-secret");
});

afterAll(async () => {
  const user = await prisma.user.findUnique({ where: { email: adminEmail } });
  if (user) {
    const ids = (await prisma.recording.findMany({ where: { createdById: user.id } })).map(
      (r) => r.id,
    );
    await prisma.recording.updateMany({
      where: { id: { in: ids } },
      data: { publishedTimingId: null },
    });
    await prisma.timingSet.deleteMany({ where: { recordingId: { in: ids } } });
    await prisma.recording.deleteMany({ where: { id: { in: ids } } });
    await prisma.audioAsset.deleteMany({
      where: { storageKey: { startsWith: `recordings/${tag}` } },
    });
    await prisma.user.delete({ where: { id: user.id } });
  }
  await prisma.$disconnect();
});

const editor = createTimingEditor(prisma);

const rowsOf = async (setId: string) =>
  (
    await prisma.verseTiming.findMany({ where: { timingSetId: setId }, orderBy: { verse: "asc" } })
  ).map((v) => ({
    chapter: v.chapter,
    verse: v.verse,
    startMs: v.startMs,
    endMs: v.endMs,
    ackGap: v.ackGap,
    ackOverlap: v.ackOverlap,
    note: v.note,
  }));

describe("timing editor: load", () => {
  it("returns the draft with one row per verse and the audio length", async () => {
    const { id, setId } = await timedDraft();
    const data = await editor.load(id);
    expect(data?.draft).toMatchObject({ id: setId, version: 1, basedOnPublished: false });
    expect(data?.rows.map((r) => r.verse)).toEqual([1, 2, 3]);
    expect(data?.durationMs).toBe(12000);
    expect(data?.rows[1]).toMatchObject({ startMs: 3000, endMs: 5500 });
  });
  it("is null for an unknown recording", async () => {
    expect(await editor.load("nope")).toBeNull();
  });
  it("shows a published recording without a draft as read-only data", async () => {
    const { id, setId } = await timedDraft();
    await publish(id, setId);
    const data = await editor.load(id);
    expect(data?.draft).toBeNull();
    expect(data?.rows).toHaveLength(3);
  });
});

describe("timing editor: save", () => {
  it("stores boundaries and clears acknowledgements of verses that moved", async () => {
    const { id, setId } = await timedDraft();
    const rows = await rowsOf(setId);
    rows[0].endMs = 2000; // moved
    const saved = await editor.save(id, setId, rows);
    expect(saved.ok).toBe(true);
    const after = await rowsOf(setId);
    expect(after[0]).toMatchObject({ endMs: 2000, ackGap: false });
    expect(after[1].ackGap).toBe(true); // untouched verse keeps its acknowledgement
  });
  it("clears the acknowledgement of the gap before a verse whose start moved", async () => {
    const { id, setId } = await timedDraft();
    const rows = await rowsOf(setId);
    rows[1].startMs = 3100; // the gap after verse 1 changes
    await editor.save(id, setId, rows);
    const after = await rowsOf(setId);
    expect(after.map((r) => r.ackGap)).toEqual([false, true, true]);
  });
  it("keeps an acknowledgement the editor set in the same save as a move", async () => {
    const { id, setId } = await timedDraft();
    await prisma.verseTiming.updateMany({ where: { timingSetId: setId }, data: { ackGap: false } });
    const rows = await rowsOf(setId);
    rows[1].startMs = 3100;
    rows[0].ackGap = true;
    await editor.save(id, setId, rows);
    expect((await rowsOf(setId))[0].ackGap).toBe(true);
  });
  it("lets the editor set an acknowledgement without moving anything", async () => {
    const { id, setId } = await timedDraft();
    const rows = await rowsOf(setId);
    rows[2].ackOverlap = true;
    await editor.save(id, setId, rows);
    expect((await rowsOf(setId))[2].ackOverlap).toBe(true);
  });
  it("refuses times beyond the audio, wrong verses and non-draft sheets, changing nothing", async () => {
    const { id, setId } = await timedDraft();
    const rows = await rowsOf(setId);
    const tooLate = rows.map((r, i) => (i === 0 ? { ...r, endMs: 99999 } : r));
    expect(await editor.save(id, setId, tooLate)).toMatchObject({ ok: false, status: 422 });
    expect(await editor.save(id, setId, rows.slice(1))).toMatchObject({ ok: false, status: 422 });
    expect(
      await editor.save(id, setId, [...rows.slice(0, 2), { ...rows[2], verse: 9 }]),
    ).toMatchObject({ ok: false, status: 422 });
    expect(await editor.save(id, "missing", rows)).toMatchObject({ ok: false, status: 404 });
    expect(await rowsOf(setId)).toEqual(rows);

    await publish(id, setId);
    expect(await editor.save(id, setId, rows)).toMatchObject({ ok: false, status: 409 });
  });
  it("keeps a published sheet unchanged and sends Ready recordings back to Draft", async () => {
    const { id, setId } = await timedDraft();
    await prisma.recording.update({ where: { id }, data: { status: "READY" } });
    const rows = await rowsOf(setId);
    rows[0].startMs = 100;
    await editor.save(id, setId, rows);
    expect((await prisma.recording.findUniqueOrThrow({ where: { id } })).status).toBe("DRAFT");
  });
  it("allows gaps, overlaps and out-of-order boundaries (validation flags them, saving never fixes)", async () => {
    const { id, setId } = await timedDraft();
    const rows = await rowsOf(setId);
    rows[0].startMs = 5000;
    rows[0].endMs = 1000;
    rows[1].startMs = 900;
    expect((await editor.save(id, setId, rows)).ok).toBe(true);
    expect(await rowsOf(setId)).toMatchObject([
      { startMs: 5000, endMs: 1000 },
      { startMs: 900 },
      {},
    ]);
  });
});

describe("timing editor: published recordings get a new draft version", () => {
  it("copies the published timing into draft version 2 and leaves the published one alone", async () => {
    const { id, setId } = await timedDraft();
    await publish(id, setId);
    expect((await editor.startDraft(id, adminEmail)).ok).toBe(true);
    const data = await editor.load(id);
    expect(data?.draft).toMatchObject({ version: 2, basedOnPublished: true });
    const rows = data!.rows;
    rows[0].endMs = 1234;
    await editor.save(id, data!.draft!.id, rows);
    const published = await rowsOf(setId);
    expect(published[0].endMs).toBe(2500);
    const rec = await prisma.recording.findUniqueOrThrow({ where: { id } });
    expect(rec.status).toBe("PUBLISHED");
    expect(rec.publishedTimingId).toBe(setId);
  });
  it("does not start a second draft", async () => {
    const { id, setId } = await timedDraft();
    await publish(id, setId);
    await editor.startDraft(id, adminEmail);
    await editor.startDraft(id, adminEmail);
    expect(await prisma.timingSet.count({ where: { recordingId: id, state: "DRAFT" } })).toBe(1);
  });
  it("refuses when there is nothing published to base it on", async () => {
    const { id } = await timedDraft();
    expect((await editor.startDraft(id, adminEmail)).ok).toBe(true); // a draft already exists
    const key = await upload(12);
    const created = await service().createDraft(input(key), adminEmail);
    if (!created.ok) throw new Error("setup");
    await prisma.timingSet.updateMany({
      where: { recordingId: created.id },
      data: { state: "ARCHIVED" },
    });
    expect((await editor.startDraft(created.id, adminEmail)).ok).toBe(false);
  });
});

describe("timing editor: sessions", () => {
  it("merges quick autosaves into one session and lists it", async () => {
    const { id, setId } = await timedDraft();
    const rows = await rowsOf(setId);
    await editor.save(id, setId, rows);
    rows[0].startMs = 10;
    await editor.save(id, setId, rows);
    const sessions = await editor.sessions(id);
    expect(sessions).toHaveLength(1);
    expect(sessions[0]).toMatchObject({ version: 1, filled: 3 });
  });
  it("starts a new session when the last one is old", async () => {
    const { id, setId } = await timedDraft();
    const rows = await rowsOf(setId);
    await editor.save(id, setId, rows);
    await prisma.editSession.updateMany({
      where: { recordingId: id },
      data: { savedAt: new Date(Date.now() - 3600_000) },
    });
    await editor.save(id, setId, rows);
    expect(await editor.sessions(id)).toHaveLength(2);
  });
  it("restores an earlier session, keeping the state it replaced as its own session", async () => {
    const { id, setId } = await timedDraft();
    const rows = await rowsOf(setId);
    await editor.save(id, setId, rows);
    const first = (await editor.sessions(id))[0];
    // age it, so the next save is a separate session instead of merging into it
    await prisma.editSession.update({
      where: { id: first.id },
      data: { savedAt: new Date(Date.now() - 3600_000) },
    });
    rows[0].startMs = 1;
    rows[0].endMs = 2;
    await editor.save(id, setId, rows);
    expect((await rowsOf(setId))[0]).toMatchObject({ startMs: 1, endMs: 2 });

    const result = await editor.restore(id, first.id);
    expect(result.ok).toBe(true);
    expect((await rowsOf(setId))[0]).toMatchObject({ startMs: 0, endMs: 2500 });
    // the sessions now include the pre-restore state, so the restore can be undone
    expect((await editor.sessions(id)).length).toBeGreaterThanOrEqual(2);
  });
  it("leaves out restored times that do not fit the audio and refuses unknown sessions", async () => {
    const { id, setId } = await timedDraft();
    const rows = await rowsOf(setId);
    const session = await prisma.editSession.create({
      data: {
        recordingId: id,
        timingSetId: setId,
        snapshot: { rows: rows.map((r) => ({ ...r, endMs: 999999 })) },
      },
    });
    await editor.restore(id, session.id);
    expect((await rowsOf(setId)).every((r) => r.endMs === null)).toBe(true);
    expect(await editor.restore(id, "missing")).toMatchObject({ ok: false, status: 404 });
    const bad = await prisma.editSession.create({
      data: { recordingId: id, timingSetId: setId, snapshot: { nope: 1 } },
    });
    expect(await editor.restore(id, bad.id)).toMatchObject({ ok: false, status: 404 });
  });
});
