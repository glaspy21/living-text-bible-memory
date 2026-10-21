import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createAdminLibrary } from "../../src/server/library/admin-library";
import { createPlayback } from "../../src/server/library/playback";
import { createRecordings } from "../../src/server/library/recordings";
import { LocalStorageDriver } from "../../src/server/storage/local";
import type { RecordingInput } from "../../src/shared/library/recording-input";
import { testClient } from "./test-db";

const prisma = testClient();
const tag = `ra${Date.now()}`;
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
  book: "isaiah",
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

describe("replaceAudio on a draft recording", () => {
  it("keeps the old audio, archives the old sheet and seeds a new draft from it", async () => {
    const { id, key, setId } = await timedDraft();
    const before = await prisma.recording.findUniqueOrThrow({ where: { id } });

    const newKey = await upload(20);
    const result = await service().replaceAudio(id, newKey, adminEmail, [0.2, 0.4]);
    expect(result).toEqual({ ok: true, id });

    const recording = await prisma.recording.findUniqueOrThrow({
      where: { id },
      include: {
        originalAsset: true,
        timingSets: { orderBy: { version: "asc" }, include: { verses: true } },
      },
    });
    expect(recording.status).toBe("DRAFT");
    expect(recording.originalAsset).toMatchObject({ storageKey: newKey, durationMs: 20_000 });
    expect(recording.originalAsset.peaksKey).not.toBeNull();

    // The old asset row and file are untouched.
    const old = await prisma.audioAsset.findUniqueOrThrow({
      where: { id: before.originalAssetId },
    });
    expect(old).toMatchObject({ storageKey: key, durationMs: 12_000 });
    expect(await storage.size(key)).not.toBeNull();

    const [v1, v2] = recording.timingSets;
    expect(recording.timingSets).toHaveLength(2);
    expect(v1).toMatchObject({ id: setId, state: "ARCHIVED", audioAssetId: old.id });
    expect(v2).toMatchObject({
      version: 2,
      state: "DRAFT",
      basedOnId: setId,
      audioAssetId: recording.originalAssetId,
    });
    // Same boundaries, acknowledgements cleared.
    const times = v2.verses
      .sort((a, b) => a.verse - b.verse)
      .map((v) => [v.verse, v.startMs, v.endMs, v.ackGap]);
    expect(times).toEqual([
      [1, 0, 2500, false],
      [2, 3000, 5500, false],
      [3, 6000, 8500, false],
    ]);
    // The archived sheet keeps its own acknowledgements.
    expect(v1.verses.every((v) => v.ackGap)).toBe(true);
  });

  it("sends a ready recording back to draft", async () => {
    const { id } = await timedDraft({ chapter: 2 });
    await prisma.recording.update({ where: { id }, data: { status: "READY" } });
    await service().replaceAudio(id, await upload(15), adminEmail);
    expect((await prisma.recording.findUniqueOrThrow({ where: { id } })).status).toBe("DRAFT");
  });

  it("can be done again, keeping every earlier sheet as history", async () => {
    const { id } = await timedDraft({ chapter: 3 });
    await service().replaceAudio(id, await upload(14), adminEmail);
    await service().replaceAudio(id, await upload(16), adminEmail);
    const sets = await prisma.timingSet.findMany({
      where: { recordingId: id },
      orderBy: { version: "asc" },
    });
    expect(sets.map((s) => [s.version, s.state])).toEqual([
      [1, "ARCHIVED"],
      [2, "ARCHIVED"],
      [3, "DRAFT"],
    ]);
    expect(new Set(sets.map((s) => s.audioAssetId)).size).toBe(3);
  });
});

describe("replaceAudio on a published recording", () => {
  it("keeps listeners on the published audio and timing until the new draft is published", async () => {
    const { id, setId } = await timedDraft({ chapter: 4 });
    await publish(id, setId);
    const published = await prisma.recording.findUniqueOrThrow({
      where: { id },
      include: { originalAsset: true },
    });

    await service().replaceAudio(id, await upload(30), adminEmail);

    const after = await prisma.recording.findUniqueOrThrow({ where: { id } });
    expect(after).toMatchObject({ status: "PUBLISHED", publishedTimingId: setId });
    const live = await createPlayback(prisma).playableFor({
      book: "isaiah",
      start: { chapter: 4, verse: 1 },
      end: { chapter: 4, verse: 3 },
    });
    const mine = live.recordings.find((r) => r.id === id);
    expect(mine).toMatchObject({ assetId: published.originalAssetId, durationMs: 12_000 });
    expect(mine?.verses).toHaveLength(3);

    // The library shows it as published with a new draft waiting.
    const rows = await createAdminLibrary(prisma).list("published");
    const row = rows.find((r) => r.id === id);
    expect(row).toMatchObject({
      hasPendingDraft: true,
      attention: "New draft waiting to be published",
    });
  });

  it("serves the new audio only after publishing", async () => {
    const { id, setId } = await timedDraft({ chapter: 5 });
    await publish(id, setId);
    await service().replaceAudio(id, await upload(30), adminEmail);
    const draft = await prisma.timingSet.findFirstOrThrow({
      where: { recordingId: id, state: "DRAFT" },
    });
    // The playback query still follows the published sheet.
    const before = await prisma.recording.findUniqueOrThrow({
      where: { id },
      include: { publishedTiming: true },
    });
    expect(before.publishedTiming?.id).toBe(setId);

    // Publishing the new draft (what M16 will do) switches listeners to the new audio.
    await prisma.timingSet.update({ where: { id: setId }, data: { state: "ARCHIVED" } });
    await publish(id, draft.id);
    const live = await createPlayback(prisma).playableFor({
      book: "isaiah",
      start: { chapter: 5, verse: 1 },
      end: { chapter: 5, verse: 3 },
    });
    expect(live.recordings.find((r) => r.id === id)).toMatchObject({
      assetId: draft.audioAssetId,
      durationMs: 30_000,
    });
  });
});

describe("replaceAudio refuses bad requests and changes nothing", () => {
  const setCount = (id: string) => prisma.timingSet.count({ where: { recordingId: id } });

  it("an unknown recording", async () => {
    expect(await service().replaceAudio("nope", await upload(), adminEmail)).toMatchObject({
      ok: false,
      status: 404,
    });
  });

  it("a file that is not audio, or has not arrived, or is already attached", async () => {
    const { id, key } = await timedDraft({ chapter: 6 });
    const html = new TextEncoder().encode("<!doctype html><p>not audio</p>");
    const fake = `recordings/${tag}-fake-aaaa/original.wav`;
    await storage.write(
      fake,
      new ReadableStream({
        start(c) {
          c.enqueue(html);
          c.close();
        },
      }),
      html.length,
    );
    expect(await service().replaceAudio(id, fake, adminEmail)).toMatchObject({ status: 422 });
    expect(
      await service().replaceAudio(id, `recordings/${tag}-gone-aaaa/original.wav`, adminEmail),
    ).toMatchObject({ status: 404 });
    expect(await service().replaceAudio(id, key, adminEmail)).toMatchObject({ status: 409 });
    expect(await setCount(id)).toBe(1);
    expect(
      (await prisma.recording.findUniqueOrThrow({ where: { id } })).originalAssetId,
    ).toBeTruthy();
  });
});
