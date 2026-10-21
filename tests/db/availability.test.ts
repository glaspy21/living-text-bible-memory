import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { seed } from "../../prisma/seed-data";
import { createAvailability } from "../../src/server/library/availability";
import { testClient } from "./test-db";

const prisma = testClient();
const availability = createAvailability(prisma);
const tag = `a${Date.now()}`;
let userId = "";

/** A recording of a book from chapter..endChapter with the given status. */
async function makeRecording(
  bookId: number,
  chapter: number,
  endChapter: number,
  status: "DRAFT" | "PUBLISHED",
) {
  const [translation, genre] = await Promise.all([
    prisma.translation.findUniqueOrThrow({ where: { code: "WEB" } }),
    prisma.genre.findUniqueOrThrow({ where: { slug: "pop" } }),
  ]);
  const asset = await prisma.audioAsset.create({
    data: {
      storageKey: `${tag}/${bookId}-${chapter}-${status}.mp3`,
      mime: "audio/mpeg",
      bytes: 1,
      durationMs: 1000,
      sha256: "x",
    },
  });
  return prisma.recording.create({
    data: {
      translationId: translation.id,
      bookId,
      chapter,
      verseStart: 1,
      endChapter,
      verseEnd: 5,
      genreId: genre.id,
      arrangementNo: 1,
      status,
      originalAssetId: asset.id,
      createdById: userId,
    },
  });
}

beforeAll(async () => {
  await seed(prisma);
  userId = (await prisma.user.create({ data: { email: `${tag}@example.test`, role: "ADMIN" } })).id;
});

afterAll(async () => {
  await prisma.recording.deleteMany({ where: { createdById: userId } });
  await prisma.audioAsset.deleteMany({ where: { storageKey: { startsWith: `${tag}/` } } });
  await prisma.user.delete({ where: { id: userId } });
  await prisma.$disconnect();
});

describe("music availability", () => {
  it("counts only published recordings", async () => {
    await makeRecording(19, 23, 23, "PUBLISHED"); // Psalm 23, published
    await makeRecording(20, 1, 1, "DRAFT"); // Proverbs 1, draft
    const books = await availability.booksWithMusic();
    expect(books.has("psalms")).toBe(true);
    expect(books.has("proverbs")).toBe(false);
    expect(await availability.chapterHasMusic("psalms", 23)).toBe(true);
    expect(await availability.chapterHasMusic("proverbs", 1)).toBe(false);
  });

  it("covers every chapter a cross-chapter recording spans", async () => {
    await makeRecording(43, 1, 2, "PUBLISHED"); // John 1–2
    expect(await availability.chapterHasMusic("john", 1)).toBe(true);
    expect(await availability.chapterHasMusic("john", 2)).toBe(true);
    expect(await availability.chapterHasMusic("john", 3)).toBe(false);
  });

  it("says no for an unknown book", async () => {
    expect(await availability.chapterHasMusic("nonsense", 1)).toBe(false);
  });
});
