import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { seed } from "../../prisma/seed-data";
import { testClient } from "./test-db";

const prisma = testClient();
const tag = `t${Date.now()}`;
let userId = "";

/** A recording of John 1:1–18 (Pop) with its own audio asset. */
async function makeRecording(arrangementNo: number) {
  const [translation, genre] = await Promise.all([
    prisma.translation.findUniqueOrThrow({ where: { code: "WEB" } }),
    prisma.genre.findUniqueOrThrow({ where: { slug: "pop" } }),
  ]);
  const asset = await prisma.audioAsset.create({
    data: {
      storageKey: `${tag}/${arrangementNo}.mp3`,
      mime: "audio/mpeg",
      bytes: 1000,
      durationMs: 60_000,
      sha256: "x",
    },
  });
  return prisma.recording.create({
    data: {
      translationId: translation.id,
      bookId: 43,
      chapter: 1,
      verseStart: 1,
      endChapter: 1,
      verseEnd: 18,
      genreId: genre.id,
      arrangementNo,
      originalAssetId: asset.id,
      createdById: userId,
    },
  });
}

beforeAll(async () => {
  userId = (await prisma.user.create({ data: { email: `${tag}@example.test`, role: "ADMIN" } })).id;
});

afterAll(async () => {
  const recordings = await prisma.recording.findMany({ where: { createdById: userId } });
  const ids = recordings.map((r) => r.id);
  await prisma.recording.updateMany({
    where: { id: { in: ids } },
    data: { publishedTimingId: null },
  });
  await prisma.timingSet.deleteMany({ where: { recordingId: { in: ids } } });
  await prisma.recording.deleteMany({ where: { id: { in: ids } } });
  await prisma.audioAsset.deleteMany({ where: { storageKey: { startsWith: `${tag}/` } } });
  await prisma.user.delete({ where: { id: userId } });
  await prisma.$disconnect();
});

describe("reference data", () => {
  it("seeds 66 books, 2 translations and the 3 built-in genres", async () => {
    expect(await prisma.book.count()).toBe(66);
    expect(await prisma.translation.count()).toBe(2);
    const genres = await prisma.genre.findMany({
      where: { isCustom: false },
      orderBy: { name: "asc" },
    });
    expect(genres.map((g) => g.name)).toEqual(["Pop", "R&B", "Rock"]);
  });

  it("can be re-seeded without creating duplicates", async () => {
    await seed(prisma);
    expect(await prisma.book.count()).toBe(66);
    expect(await prisma.translation.count()).toBe(2);
  });

  it("stores the ESV copyright notice", async () => {
    const esv = await prisma.translation.findUniqueOrThrow({ where: { code: "ESV" } });
    expect(esv.licenseNote).toContain("Crossway");
  });
});

describe("recordings and timing", () => {
  it("allows several recordings of the same passage and genre", async () => {
    const a = await makeRecording(1);
    const b = await makeRecording(2);
    expect(a.id).not.toBe(b.id);
    expect(a.title).toBe("Default");
    expect(a.status).toBe("DRAFT");
  });

  it("keeps timing versions unique per recording", async () => {
    const rec = await makeRecording(3);
    await prisma.timingSet.create({
      data: { recordingId: rec.id, version: 1, createdById: userId },
    });
    await expect(
      prisma.timingSet.create({ data: { recordingId: rec.id, version: 1, createdById: userId } }),
    ).rejects.toThrow();
  });

  it("removes verse timings with their timing set", async () => {
    const rec = await makeRecording(4);
    const set = await prisma.timingSet.create({
      data: {
        recordingId: rec.id,
        version: 1,
        createdById: userId,
        verses: { create: [{ chapter: 1, verse: 1, startMs: 0, endMs: 4200 }] },
      },
    });
    await prisma.timingSet.delete({ where: { id: set.id } });
    expect(await prisma.verseTiming.count({ where: { timingSetId: set.id } })).toBe(0);
  });

  it("points a recording at its published timing version", async () => {
    const rec = await makeRecording(5);
    const set = await prisma.timingSet.create({
      data: { recordingId: rec.id, version: 1, state: "PUBLISHED", createdById: userId },
    });
    const updated = await prisma.recording.update({
      where: { id: rec.id },
      data: { publishedTimingId: set.id, status: "PUBLISHED" },
      include: { publishedTiming: true },
    });
    expect(updated.publishedTiming?.version).toBe(1);
  });
});
