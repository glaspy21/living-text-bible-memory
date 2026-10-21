import { describe, expect, it } from "vitest";
import { tapVerse, verseMarking, type Selection } from "./selection";

const v = (chapter: number, verse: number) => ({ chapter, verse });

describe("verseMarking", () => {
  it("marks nothing without a selection", () => {
    expect(verseMarking(null, v(1, 3))).toEqual({ inRange: false, edge: false });
  });

  it("tints every verse of a range but puts the gold edge only on its first and last", () => {
    const range: Selection = { start: v(1, 3), end: v(1, 7), anchor: null };
    const marks = [2, 3, 4, 5, 6, 7, 8].map((n) => verseMarking(range, v(1, n)));
    expect(marks.map((m) => m.inRange)).toEqual([false, true, true, true, true, true, false]);
    expect(marks.map((m) => m.edge)).toEqual([false, true, false, false, false, true, false]);
  });

  it("gives a single tapped verse the edge (it is both start and end)", () => {
    const first = tapVerse(null, v(2, 5));
    expect(verseMarking(first, v(2, 5))).toEqual({ inRange: true, edge: true });
    expect(verseMarking(first, v(2, 6))).toEqual({ inRange: false, edge: false });
  });

  it("works across chapters: only the two outer verses carry the edge", () => {
    const range: Selection = { start: v(1, 50), end: v(2, 3), anchor: null };
    expect(verseMarking(range, v(1, 50)).edge).toBe(true);
    expect(verseMarking(range, v(1, 51))).toEqual({ inRange: true, edge: false });
    expect(verseMarking(range, v(2, 1))).toEqual({ inRange: true, edge: false });
    expect(verseMarking(range, v(2, 3)).edge).toBe(true);
    expect(verseMarking(range, v(2, 4)).inRange).toBe(false);
  });

  it("follows a second tap in either direction", () => {
    const back = tapVerse(tapVerse(null, v(1, 9)), v(1, 4));
    expect(verseMarking(back, v(1, 4)).edge).toBe(true);
    expect(verseMarking(back, v(1, 9)).edge).toBe(true);
    expect(verseMarking(back, v(1, 6))).toEqual({ inRange: true, edge: false });
  });
});
