import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createPlayback } from "../../src/server/library/playback";
import { testClient } from "./test-db";

const prisma = testClient();
const playback = createPlayback(prisma);
const tag = `pb${Date.now()}`;
let userId = "";

/** A recording of Esther chapter..endChapter with an optional published timing. */
async function makeRecording(opts: {
  chapter: number;
  endChapter: number;
  status: "DRAFT" | "PUBLISHED";
  genre: string;
  arrangementNo?: number;
  publish?: boolean;
}) {
  const [translation, genre] = await Promise.all([
    prisma.translation.findUniqueOrThrow({ where: { code: "WEB" } }),
    prisma.genre.findUniqueOrThrow({ where: { slug: opts.genre } }),
  ]);
  const asset = await prisma.audioAsset.create({
    data: {
      storageKey: `${tag}/${opts.chapter}-${opts.genre}-${opts.status}-${opts.arrangementNo ?? 1}.mp3`,
      mime: "audio/mpeg",
      bytes: 1,
      durationMs: 60_000,
      sha256: "x",
    },
  });
  const recording = await prisma.recording.create({
    data: {
      translationId: translation.id,
      bookId: 17, // Esther
      chapter: opts.chapter,
      verseStart: 1,
      endChapter: opts.endChapter,
      verseEnd: 3,
      genreId: genre.id,
      arrangementNo: opts.arrangementNo ?? 1,
      status: opts.status,
      originalAssetId: asset.id,
      createdById: userId,
    },
  });
  if (opts.publish !== false) {
    const timing = await prisma.timingSet.create({
      data: {
        recordingId: recording.id,
        version: 1,
        state: "PUBLISHED",
        createdById: userId,
        verses: {
          create: [
            { chapter: opts.chapter, verse: 1, startMs: 0, endMs: 2000 },
            { chapter: opts.chapter, verse: 2, startMs: 2000, endMs: 5000 },
          ],
        },
      },
    });
    await prisma.recording.update({
      where: { id: recording.id },
      data: { publishedTimingId: timing.id },
    });
  }
  return recording;
}

const esther = (from: number, to: number) => ({
  book: "esther",
  start: { chapter: from, verse: 1 },
  end: { chapter: to, verse: 3 },
});

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

describe("playableFor", () => {
  it("returns only published recordings that have published timing", async () => {
    await makeRecording({ chapter: 2, endChapter: 2, status: "PUBLISHED", genre: "pop" });
    await makeRecording({ chapter: 2, endChapter: 2, status: "DRAFT", genre: "rock" });
    await makeRecording({
      chapter: 2,
      endChapter: 2,
      status: "PUBLISHED",
      genre: "rnb",
      publish: false, // published but its timing never was
    });
    const { recordings, genres } = await playback.playableFor(esther(2, 2));
    expect(recordings).toHaveLength(1);
    expect(recordings[0]).toMatchObject({ genreSlug: "pop", durationMs: 60_000 });
    expect(recordings[0].verses).toHaveLength(2);
    expect(genres.map((g) => g.slug)).toEqual(["pop"]);
  });

  it("finds recordings that span the passage's chapters, and not others", async () => {
    await makeRecording({ chapter: 4, endChapter: 5, status: "PUBLISHED", genre: "pop" });
    expect((await playback.playableFor(esther(5, 5))).recordings).toHaveLength(1);
    expect((await playback.playableFor(esther(4, 6))).recordings).toHaveLength(1);
    expect((await playback.playableFor(esther(6, 7))).recordings).toHaveLength(0);
    expect((await playback.playableFor(esther(3, 3))).recordings).toHaveLength(0);
  });

  it("orders several recordings by arrangement", async () => {
    await makeRecording({
      chapter: 8,
      endChapter: 8,
      status: "PUBLISHED",
      genre: "pop",
      arrangementNo: 2,
    });
    await makeRecording({
      chapter: 8,
      endChapter: 8,
      status: "PUBLISHED",
      genre: "pop",
      arrangementNo: 1,
    });
    const { recordings, genres } = await playback.playableFor(esther(8, 8));
    expect(recordings.map((r) => r.arrangementNo)).toEqual([1, 2]);
    expect(genres).toHaveLength(1);
  });

  it("returns nothing for an unknown book", async () => {
    expect(
      await playback.playableFor({
        book: "nonsense",
        start: { chapter: 1, verse: 1 },
        end: { chapter: 1, verse: 1 },
      }),
    ).toEqual({ recordings: [], genres: [] });
  });
});
