import { describe, expect, it } from "vitest";
import { resolveSegments, type PlayableRecording } from "../audio/playlist";
import { isWithinEsvScope } from "./esv-scope";
import { formatPassageParam, parsePassageParam } from "./passage-param";
import { expandPassageAcrossBooks, formatReference, isValidPassage, splitByBook } from "./refs";
import { tapVerse, verseMarking } from "./selection";
import type { PassageRef } from "./types";

const lukeToJohn: PassageRef = {
  book: "luke",
  start: { chapter: 24, verse: 50 },
  end: { chapter: 1, verse: 3 },
  endBook: "john",
};

describe("a passage across books", () => {
  it("round-trips through the URL and rejects out-of-order books", () => {
    expect(formatPassageParam(lukeToJohn)).toBe("luke 24:50-john 1:3");
    expect(parsePassageParam("luke 24:50-john 1:3")).toEqual(lukeToJohn);
    expect(parsePassageParam("john 1:3-luke 24:50")).toBeNull();
    expect(parsePassageParam("luke 24:50-john 99:1")).toBeNull();
    // The old forms still parse, including a book whose slug starts with a digit.
    expect(parsePassageParam("john 1:51-2:5")?.endBook).toBeUndefined();
    expect(parsePassageParam("luke 24:50-1-john 1:1")?.endBook).toBe("1-john");
  });

  it("is valid in any verse order across books, and reads as a reference", () => {
    expect(isValidPassage(lukeToJohn)).toBe(true);
    expect(formatReference(lukeToJohn)).toBe("Luke 24:50–John 1:3");
  });

  it("splits at book boundaries, running through the books in between", () => {
    const parts = splitByBook({ ...lukeToJohn, endBook: "acts" });
    expect(parts.map((p) => p.book)).toEqual(["luke", "john", "acts"]);
    expect(parts[0].start).toEqual({ chapter: 24, verse: 50 });
    expect(parts[1].start).toEqual({ chapter: 1, verse: 1 });
    expect(parts[1].end.chapter).toBe(21);
    expect(parts[2].end).toEqual({ chapter: 1, verse: 3 });
  });

  it("lists every verse with its book", () => {
    const counts = (book: string) => (book === "luke" ? Array(24).fill(53) : [51, 25]);
    const verses = expandPassageAcrossBooks(lukeToJohn, counts);
    expect(verses.map((v) => `${v.book} ${v.chapter}:${v.verse}`)).toEqual([
      "luke 24:50",
      "luke 24:51",
      "luke 24:52",
      "luke 24:53",
      "john 1:1",
      "john 1:2",
      "john 1:3",
    ]);
  });

  it("is inside the ESV scope only when every book's share is", () => {
    const scope = [
      { book: "john", from: { chapter: 1, verse: 1 }, to: { chapter: 2, verse: 999 } },
    ];
    expect(isWithinEsvScope(lukeToJohn, scope)).toBe(false);
    expect(
      isWithinEsvScope(
        { ...lukeToJohn, book: "john", endBook: undefined, start: { chapter: 1, verse: 1 } },
        scope,
      ),
    ).toBe(true);
  });

  it("is selected by taps in two books, and marks only the outer verses", () => {
    const luke = { book: "luke", chapter: 24, verse: 50 };
    const john = { book: "john", chapter: 1, verse: 3 };
    const range = tapVerse(tapVerse(null, luke), john)!;
    expect(range.start).toEqual(luke);
    expect(range.end).toEqual(john);
    expect(verseMarking(range, luke).edge).toBe(true);
    expect(verseMarking(range, john).edge).toBe(true);
    expect(verseMarking(range, { book: "luke", chapter: 24, verse: 53 })).toEqual({
      inRange: true,
      edge: false,
    });
    expect(verseMarking(range, { book: "john", chapter: 1, verse: 4 }).inRange).toBe(false);
    // Tapping in the other order gives the same range.
    expect(tapVerse(tapVerse(null, john), luke)).toEqual(range);
  });

  it("plays each verse from the recording of its own book", () => {
    const rec = (book: string): PlayableRecording => ({
      id: book,
      book,
      assetId: `a-${book}`,
      genreSlug: "pop",
      arrangementNo: 1,
      durationMs: 10_000,
      verses: [{ chapter: 1, verse: 1, startMs: 0, endMs: 1000 }],
    });
    const segments = resolveSegments(
      [
        { book: "luke", chapter: 1, verse: 1 },
        { book: "john", chapter: 1, verse: 1 },
        { book: "acts", chapter: 1, verse: 1 },
      ],
      [rec("luke"), rec("john")],
      "pop",
    );
    expect(segments.map((s) => s?.assetId ?? null)).toEqual(["a-luke", "a-john", null]);
  });
});
