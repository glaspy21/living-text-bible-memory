import { describe, expect, it } from "vitest";
import { chapterPassage, isWithinEsvScope } from "./esv-scope";
import { compareRefs, formatReference, isValidPassage, versesInPassage } from "./refs";
import type { PassageRef, Verse } from "./types";

const ref = (book: string, sc: number, sv: number, ec: number, ev: number): PassageRef => ({
  book,
  start: { chapter: sc, verse: sv },
  end: { chapter: ec, verse: ev },
});

describe("compareRefs", () => {
  it("orders by chapter, then verse", () => {
    expect(compareRefs({ chapter: 1, verse: 9 }, { chapter: 2, verse: 1 })).toBeLessThan(0);
    expect(compareRefs({ chapter: 2, verse: 3 }, { chapter: 2, verse: 1 })).toBeGreaterThan(0);
    expect(compareRefs({ chapter: 2, verse: 1 }, { chapter: 2, verse: 1 })).toBe(0);
  });
});

describe("isValidPassage", () => {
  it("accepts single verses, ranges and cross-chapter ranges", () => {
    expect(isValidPassage(ref("john", 1, 1, 1, 1))).toBe(true);
    expect(isValidPassage(ref("john", 1, 1, 1, 18))).toBe(true);
    expect(isValidPassage(ref("john", 1, 51, 2, 5))).toBe(true);
  });

  it("rejects backwards, zero and fractional references", () => {
    expect(isValidPassage(ref("john", 1, 5, 1, 4))).toBe(false);
    expect(isValidPassage(ref("john", 2, 1, 1, 9))).toBe(false);
    expect(isValidPassage(ref("john", 0, 1, 1, 1))).toBe(false);
    expect(isValidPassage(ref("john", 1, 1.5, 1, 3))).toBe(false);
  });
});

describe("formatReference", () => {
  it("writes single, same-chapter and cross-chapter references", () => {
    expect(formatReference(ref("john", 1, 1, 1, 1))).toBe("John 1:1");
    expect(formatReference(ref("john", 1, 1, 1, 18))).toBe("John 1:1–18");
    expect(formatReference(ref("john", 1, 51, 2, 5))).toBe("John 1:51–2:5");
    expect(formatReference(ref("song-of-solomon", 2, 1, 2, 4))).toBe("Song of Solomon 2:1–4");
  });
});

describe("versesInPassage", () => {
  const verses: Verse[] = [
    { chapter: 1, verse: 50, text: "a" },
    { chapter: 1, verse: 51, text: "b" },
    { chapter: 2, verse: 1, text: "c" },
    { chapter: 2, verse: 2, text: "d" },
  ];

  it("keeps only verses inside the range, across a chapter break", () => {
    expect(versesInPassage(verses, ref("john", 1, 51, 2, 1)).map((v) => v.text)).toEqual([
      "b",
      "c",
    ]);
  });
});

describe("ESV scope", () => {
  it("allows John 1 and 2, including across the chapter break", () => {
    expect(isWithinEsvScope(chapterPassage("john", 1))).toBe(true);
    expect(isWithinEsvScope(chapterPassage("john", 2))).toBe(true);
    expect(isWithinEsvScope(ref("john", 1, 40, 2, 10))).toBe(true);
  });

  it("refuses everything else", () => {
    expect(isWithinEsvScope(chapterPassage("john", 3))).toBe(false);
    expect(isWithinEsvScope(ref("john", 2, 20, 3, 2))).toBe(false);
    expect(isWithinEsvScope(chapterPassage("genesis", 1))).toBe(false);
    expect(isWithinEsvScope(chapterPassage("1-john", 1))).toBe(false);
  });
});
