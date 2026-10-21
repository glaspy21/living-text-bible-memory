import { createHash } from "node:crypto";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createRecordings } from "../../src/server/library/recordings";
import { LocalStorageDriver } from "../../src/server/storage/local";
import type { RecordingInput } from "../../src/shared/library/recording-input";
import { testClient } from "./test-db";

const prisma = testClient();
const tag = `rc${Date.now()}`;
const adminEmail = `${tag}@example.test`;
const SECRET = "db-test-secret";
let storage: LocalStorageDriver;
let counter = 0;

/** A 12-second mono WAV (real header, silent samples). */
function wav(): Uint8Array {
  const rate = 8000;
  const samples = rate * 12;
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

/** Put a file in storage under a fresh upload key, as the upload routes would. */
async function upload(bytes: Uint8Array = wav()): Promise<string> {
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
  book: "esther",
  chapter: 2,
  verseStart: 1,
  endChapter: 2,
  verseEnd: 4,
  genre: { kind: "builtin", slug: "pop" },
  ...over,
});

const service = () =>
  createRecordings({ client: prisma, storage, verseCounts: async () => Array(10).fill(30) });

beforeAll(async () => {
  storage = new LocalStorageDriver(await mkdtemp(path.join(tmpdir(), "lt-db-")), SECRET);
});

afterAll(async () => {
  const user = await prisma.user.findUnique({ where: { email: adminEmail } });
  if (user) {
    const recordings = await prisma.recording.findMany({ where: { createdById: user.id } });
    const ids = recordings.map((r) => r.id);
    await prisma.timingSet.deleteMany({ where: { recordingId: { in: ids } } });
    await prisma.recording.deleteMany({ where: { id: { in: ids } } });
    await prisma.audioAsset.deleteMany({
      where: { storageKey: { startsWith: `recordings/${tag}` } },
    });
    await prisma.user.delete({ where: { id: user.id } });
  }
  await prisma.genre.deleteMany({ where: { slug: { contains: tag } } });
  await prisma.$disconnect();
});

describe("createDraft", () => {
  it("saves a draft recording with its audio facts, an empty timing sheet and the waveform", async () => {
    const key = await upload();
    const result = await service().createDraft(input(key), adminEmail, [0.1, 0.5, 0.9]);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const recording = await prisma.recording.findUniqueOrThrow({
      where: { id: result.id },
      include: {
        originalAsset: true,
        timingSets: { include: { verses: true } },
        genre: true,
        createdBy: true,
        book: true,
      },
    });
    expect(recording).toMatchObject({
      status: "DRAFT",
      title: "Default",
      arrangementNo: 1,
      chapter: 2,
      endChapter: 2,
      verseStart: 1,
      verseEnd: 4,
    });
    expect(recording.book.slug).toBe("esther");
    expect(recording.genre.slug).toBe("pop");
    expect(recording.createdBy).toMatchObject({ email: adminEmail, role: "ADMIN" });
    expect(recording.publishedTimingId).toBeNull();

    const asset = recording.originalAsset;
    expect(asset).toMatchObject({ storageKey: key, mime: "audio/wav", durationMs: 12_000 });
    expect(asset.sha256).toBe(createHash("sha256").update(wav()).digest("hex"));
    expect(asset.peaksKey).toBe(key.replace("original.wav", "peaks.json"));
    const stored = await storage.readBytes(asset.peaksKey!, { start: 0, end: 100 });
    expect(JSON.parse(new TextDecoder().decode(stored))).toEqual([0.1, 0.5, 0.9]);

    // The timing sheet is a draft with one blank row per verse, ready for the editor.
    expect(recording.timingSets).toHaveLength(1);
    const timing = recording.timingSets[0];
    expect(timing).toMatchObject({ version: 1, state: "DRAFT" });
    expect(timing.verses.map((v) => v.verse).sort((a, b) => a - b)).toEqual([1, 2, 3, 4]);
    expect(timing.verses.every((v) => v.startMs === null && v.endMs === null)).toBe(true);
  });

  it("never replaces a recording of the same passage and genre: it becomes Default 2, 3", async () => {
    const passage = { chapter: 3, verseStart: 1, endChapter: 3, verseEnd: 2 };
    const first = await service().createDraft(input(await upload(), passage), adminEmail);
    const second = await service().createDraft(input(await upload(), passage), adminEmail);
    const third = await service().createDraft(input(await upload(), passage), adminEmail);
    const other = await service().createDraft(
      input(await upload(), { ...passage, genre: { kind: "builtin", slug: "rock" } }),
      adminEmail,
    );
    expect([first, second, third, other].every((r) => r.ok)).toBe(true);

    const arrangements = await Promise.all(
      [first, second, third, other].map(async (r) =>
        r.ok
          ? (await prisma.recording.findUniqueOrThrow({ where: { id: r.id } })).arrangementNo
          : 0,
      ),
    );
    expect(arrangements).toEqual([1, 2, 3, 1]); // another genre starts again at 1
    // All four still exist.
    expect(
      await prisma.recording.count({ where: { chapter: 3, createdBy: { email: adminEmail } } }),
    ).toBe(4);
  });

  it("creates a custom genre once, in Title Case, and reuses it", async () => {
    const name = `folk ${tag} acoustic`;
    const a = await service().createDraft(
      input(await upload(), { chapter: 4, endChapter: 4, genre: { kind: "custom", name } }),
      adminEmail,
    );
    const b = await service().createDraft(
      input(await upload(), {
        chapter: 5,
        endChapter: 5,
        genre: { kind: "custom", name: name.toUpperCase() },
      }),
      adminEmail,
    );
    expect(a.ok && b.ok).toBe(true);
    const genres = await prisma.genre.findMany({ where: { slug: { contains: tag } } });
    expect(genres).toHaveLength(1);
    expect(genres[0]).toMatchObject({
      isCustom: true,
      name: `Folk ${tag.charAt(0).toUpperCase()}${tag.slice(1)} Acoustic`,
    });
  });

  it("uses an existing built-in genre when a custom name matches it", async () => {
    const before = await prisma.genre.count();
    const result = await service().createDraft(
      input(await upload(), { chapter: 6, endChapter: 6, genre: { kind: "custom", name: "pop" } }),
      adminEmail,
    );
    expect(result.ok).toBe(true);
    expect(await prisma.genre.count()).toBe(before);
  });

  it("makes a timing row for every verse of a recording that crosses chapters", async () => {
    const result = await service().createDraft(
      input(await upload(), { chapter: 7, verseStart: 29, endChapter: 8, verseEnd: 2 }),
      adminEmail,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const rows = await prisma.verseTiming.findMany({
      where: { timingSet: { recordingId: result.id } },
      orderBy: [{ chapter: "asc" }, { verse: "asc" }],
    });
    expect(rows.map((r) => `${r.chapter}:${r.verse}`)).toEqual(["7:29", "7:30", "8:1", "8:2"]);
  });
});

describe("createDraft refuses bad requests and leaves nothing behind", () => {
  const count = () => prisma.recording.count({ where: { createdBy: { email: adminEmail } } });

  it("a passage that doesn't exist", async () => {
    const before = await count();
    const result = await service().createDraft(input(await upload(), { verseEnd: 99 }), adminEmail);
    expect(result).toMatchObject({ ok: false, status: 400 });
    expect(await count()).toBe(before);
  });

  it("a file that hasn't been uploaded", async () => {
    const result = await service().createDraft(
      input(`recordings/${tag}-missing-aaaa/original.wav`),
      adminEmail,
    );
    expect(result).toMatchObject({ ok: false, status: 404 });
  });

  it("a file that isn't really audio", async () => {
    const html = new TextEncoder().encode("<!doctype html><p>not audio</p>");
    const result = await service().createDraft(input(await upload(html)), adminEmail);
    expect(result).toMatchObject({ ok: false, status: 422 });
  });

  it("an upload that is already attached to a recording", async () => {
    const key = await upload();
    expect((await service().createDraft(input(key), adminEmail)).ok).toBe(true);
    expect(
      await service().createDraft(input(key, { chapter: 9, endChapter: 9 }), adminEmail),
    ).toMatchObject({
      ok: false,
      status: 409,
    });
  });

  it("anything that is not an original upload key", async () => {
    const result = await service().createDraft(input("../../etc/passwd"), adminEmail);
    expect(result).toMatchObject({ ok: false, status: 400 });
  });
});
