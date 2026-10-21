import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createPublisher } from "../../src/server/timing/publish";
import { createPlayback } from "../../src/server/library/playback";
import { createTimingEditor } from "../../src/server/timing/editor";
import { createRecordings } from "../../src/server/library/recordings";
import { LocalStorageDriver } from "../../src/server/storage/local";
import type { RecordingInput } from "../../src/shared/library/recording-input";
import { testClient } from "./test-db";

const prisma = testClient();
const tag = `pb${Date.now()}`;
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
  book: "amos",
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

const publisher = createPublisher(prisma);
const editor = createTimingEditor(prisma);
const playback = createPlayback(prisma);
const AMOS = { book: "amos", chapter: 1, verseStart: 1, endChapter: 1, verseEnd: 3 };

describe("markReady", () => {
  it("marks a valid draft Ready", async () => {
    const { id, setId } = await timedDraft();
    // timedDraft leaves a 500 ms gap after each verse; acknowledge them
    await prisma.verseTiming.updateMany({ where: { timingSetId: setId }, data: { ackGap: true } });
    expect(await publisher.markReady(id)).toEqual({ ok: true, status: "READY" });
    expect((await prisma.recording.findUniqueOrThrow({ where: { id } })).status).toBe("READY");
  });
  it("refuses a draft with unacknowledged gaps, saying which", async () => {
    const { id, setId } = await timedDraft();
    await prisma.verseTiming.updateMany({ where: { timingSetId: setId }, data: { ackGap: false } });
    const result = await publisher.markReady(id);
    expect(result).toMatchObject({ ok: false, status: 422 });
    if (!result.ok) expect(result.validation?.unacknowledged).toHaveLength(2);
    expect((await prisma.recording.findUniqueOrThrow({ where: { id } })).status).toBe("DRAFT");
  });
  it("refuses blank timing and end-before-start", async () => {
    const key = await upload(12);
    const created = await service().createDraft(input(key), adminEmail);
    if (!created.ok) throw new Error("setup");
    expect(await publisher.markReady(created.id)).toMatchObject({ ok: false, status: 422 });

    const { id, setId } = await timedDraft();
    await prisma.verseTiming.updateMany({
      where: { timingSetId: setId, verse: 1 },
      data: { startMs: 5000, endMs: 4000 },
    });
    const result = await publisher.markReady(id);
    expect(result).toMatchObject({ ok: false, status: 422 });
    if (!result.ok)
      expect(result.validation?.errors.map((e) => e.kind)).toContain("end-not-after-start");
  });
  it("is a 404 for an unknown recording and refuses a published recording", async () => {
    expect(await publisher.markReady("nope")).toMatchObject({ ok: false, status: 404 });
    const { id, setId } = await timedDraft();
    await publish(id, setId);
    expect(await publisher.markReady(id)).toMatchObject({ ok: false, status: 409 });
  });
});

describe("a change after Ready sends the recording back to Draft", () => {
  it("via the editor's save", async () => {
    const { id, setId } = await timedDraft();
    await prisma.verseTiming.updateMany({ where: { timingSetId: setId }, data: { ackGap: true } });
    await publisher.markReady(id);
    const data = (await editor.load(id))!;
    data.rows[0].endMs = 2000;
    await editor.save(id, setId, data.rows);
    expect((await prisma.recording.findUniqueOrThrow({ where: { id } })).status).toBe("DRAFT");
  });
  it("backToDraft leaves published recordings alone", async () => {
    const { id, setId } = await timedDraft();
    await publish(id, setId);
    expect(await publisher.backToDraft(id)).toEqual({ ok: true, status: "PUBLISHED" });
  });
});

describe("publish", () => {
  async function readyDraft() {
    const made = await timedDraft(AMOS);
    await prisma.verseTiming.updateMany({
      where: { timingSetId: made.setId },
      data: { ackGap: true },
    });
    await publisher.markReady(made.id);
    return made;
  }

  it("needs Ready first", async () => {
    const { id } = await timedDraft();
    expect(await publisher.publish(id)).toMatchObject({ ok: false, status: 409 });
  });
  it("makes the draft the published timing, and listeners can then play it", async () => {
    const { id, setId } = await readyDraft();
    const before = await playback.playableFor({
      book: "amos",
      start: { chapter: 1, verse: 1 },
      end: { chapter: 1, verse: 3 },
    });
    expect(before.recordings.some((r) => r.id === id)).toBe(false);
    expect(await publisher.publish(id)).toEqual({ ok: true, status: "PUBLISHED" });
    const rec = await prisma.recording.findUniqueOrThrow({ where: { id } });
    expect(rec).toMatchObject({ status: "PUBLISHED", publishedTimingId: setId });
    expect((await prisma.timingSet.findUniqueOrThrow({ where: { id: setId } })).state).toBe(
      "PUBLISHED",
    );
    const playable = await playback.playableFor({
      book: "amos",
      start: { chapter: 1, verse: 1 },
      end: { chapter: 1, verse: 3 },
    });
    expect(playable.recordings.some((r) => r.id === id)).toBe(true);
  });
  it("refuses an invalid draft even if the status says Ready (checked again on the server)", async () => {
    const { id, setId } = await readyDraft();
    await prisma.verseTiming.updateMany({
      where: { timingSetId: setId, verse: 2 },
      data: { endMs: null },
    });
    expect(await publisher.publish(id)).toMatchObject({ ok: false, status: 422 });
    expect(
      (await prisma.recording.findUniqueOrThrow({ where: { id } })).publishedTimingId,
    ).toBeNull();
  });
  it("a new draft version replaces the live timing only on publish and archives the old one", async () => {
    const { id, setId } = await readyDraft();
    await publisher.publish(id);
    await editor.startDraft(id, adminEmail);
    const data = (await editor.load(id))!;
    data.rows[0].endMs = 2000; // moved: its acknowledgement is cleared
    await editor.save(id, data.draft!.id, data.rows);

    // while the draft is unpublished, listeners still get the old timing
    const live = await prisma.timingSet.findUniqueOrThrow({
      where: { id: setId },
      include: { verses: { orderBy: { verse: "asc" } } },
    });
    expect(live.verses[0].endMs).toBe(2500);

    // a gap acknowledgement is needed again for the moved verse; no gap here because 2000 < 3000
    const blocked = await publisher.publish(id);
    if (blocked.ok) throw new Error("expected the new gap to block publishing");
    expect(blocked.status).toBe(422);
    await prisma.verseTiming.updateMany({
      where: { timingSetId: data.draft!.id },
      data: { ackGap: true },
    });
    expect(await publisher.publish(id)).toEqual({ ok: true, status: "PUBLISHED" });

    const rec = await prisma.recording.findUniqueOrThrow({ where: { id } });
    expect(rec.publishedTimingId).toBe(data.draft!.id);
    expect((await prisma.timingSet.findUniqueOrThrow({ where: { id: setId } })).state).toBe(
      "ARCHIVED",
    );
    // the archived sheet keeps its verses (history is never deleted)
    expect(await prisma.verseTiming.count({ where: { timingSetId: setId } })).toBe(3);
  });
  it("publishing replaced audio switches listeners to the new audio at that moment", async () => {
    const { id, setId } = await readyDraft();
    await publisher.publish(id);
    const before = await prisma.recording.findUniqueOrThrow({ where: { id } });
    const newKey = await upload(13);
    const replaced = await service().replaceAudio(id, newKey, adminEmail);
    expect(replaced.ok).toBe(true);

    const view = async () =>
      (
        await playback.playableFor({
          book: "amos",
          start: { chapter: 1, verse: 1 },
          end: { chapter: 1, verse: 3 },
        })
      ).recordings.find((r) => r.id === id)!;
    expect((await view()).assetId).toBe(before.originalAssetId);

    const draft = (await editor.load(id))!;
    await prisma.verseTiming.updateMany({
      where: { timingSetId: draft.draft!.id },
      data: { ackGap: true },
    });
    expect(await publisher.publish(id)).toEqual({ ok: true, status: "PUBLISHED" });
    const now = await view();
    expect(now.assetId).toBe(draft.audioAssetId);
    expect(now.assetId).not.toBe(before.originalAssetId);
    expect((await prisma.timingSet.findUniqueOrThrow({ where: { id: setId } })).audioAssetId).toBe(
      before.originalAssetId,
    );
  });
  it("is a 404 for an unknown recording", async () => {
    expect(await publisher.publish("nope")).toMatchObject({ ok: false, status: 404 });
  });
});
