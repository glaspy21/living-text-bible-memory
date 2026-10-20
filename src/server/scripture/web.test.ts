import { describe, expect, it } from "vitest";
import { ScriptureUnavailableError } from "./types";
import { WebProvider } from "./web";

// These read the real imported text, so they also guard the import.
const web = new WebProvider();

describe("WebProvider", () => {
  it("reads a whole chapter", async () => {
    const verses = await web.getChapter("john", 1);
    expect(verses).toHaveLength(51);
    expect(verses[0]).toEqual({
      chapter: 1,
      verse: 1,
      text: "In the beginning was the Word, and the Word was with God, and the Word was God.",
    });
  });

  it("reads a passage inside a chapter", async () => {
    const verses = await web.getPassage({
      book: "john",
      start: { chapter: 1, verse: 1 },
      end: { chapter: 1, verse: 3 },
    });
    expect(verses.map((v) => v.verse)).toEqual([1, 2, 3]);
  });

  it("reads a passage that crosses chapters", async () => {
    const verses = await web.getPassage({
      book: "john",
      start: { chapter: 1, verse: 50 },
      end: { chapter: 2, verse: 2 },
    });
    expect(verses.map((v) => `${v.chapter}:${v.verse}`)).toEqual(["1:50", "1:51", "2:1", "2:2"]);
  });

  it("reports the last verse of a chapter", async () => {
    expect(await web.verseCount("john", 2)).toBe(25);
    expect(await web.verseCount("psalms", 117)).toBe(2);
  });

  it("has all 66 books with the right chapter counts", async () => {
    const { BOOKS } = await import("@/shared/scripture/books");
    for (const book of BOOKS) {
      const last = await web.getChapter(book.slug, book.chapterCount);
      expect(last.length, book.name).toBeGreaterThan(0);
    }
  });

  it("refuses unknown books, chapters and backwards passages", async () => {
    await expect(web.getChapter("nonsense", 1)).rejects.toBeInstanceOf(ScriptureUnavailableError);
    await expect(web.getChapter("john", 22)).rejects.toBeInstanceOf(ScriptureUnavailableError);
    await expect(web.getChapter("john", 0)).rejects.toBeInstanceOf(ScriptureUnavailableError);
    await expect(
      web.getPassage({
        book: "john",
        start: { chapter: 1, verse: 9 },
        end: { chapter: 1, verse: 2 },
      }),
    ).rejects.toBeInstanceOf(ScriptureUnavailableError);
  });

  it("keeps the Acts 8:37 gap that the WEB leaves out", async () => {
    const verses = await web.getChapter("acts", 8);
    expect(verses.some((v) => v.verse === 37)).toBe(false);
    expect(verses.some((v) => v.verse === 36)).toBe(true);
  });
});
