import { describe, expect, it } from "vitest";
import { formatPassageParam, parsePassageParam, withPassage } from "./passage-param";
import { isSelected, tapVerse, type Selection } from "./selection";
import type { PassageRef } from "./types";

const ref = (book: string, sc: number, sv: number, ec: number, ev: number): PassageRef => ({
  book,
  start: { chapter: sc, verse: sv },
  end: { chapter: ec, verse: ev },
});

describe("passage param", () => {
  it("round-trips single verses, ranges and cross-chapter ranges", () => {
    for (const passage of [
      ref("john", 1, 1, 1, 1),
      ref("john", 1, 1, 1, 18),
      ref("john", 1, 51, 2, 5),
      ref("1-john", 3, 16, 3, 18),
      ref("song-of-solomon", 2, 1, 2, 4),
    ]) {
      expect(parsePassageParam(formatPassageParam(passage))).toEqual(passage);
    }
  });

  it("writes the expected text", () => {
    expect(formatPassageParam(ref("john", 1, 1, 1, 18))).toBe("john 1:1-18");
    expect(formatPassageParam(ref("john", 1, 51, 2, 5))).toBe("john 1:51-2:5");
    expect(formatPassageParam(ref("john", 3, 16, 3, 16))).toBe("john 3:16");
  });

  it("rejects anything that is not a real passage", () => {
    for (const bad of [
      null,
      undefined,
      "",
      "john",
      "john 1",
      "nonsense 1:1",
      "john 1:18-1",
      "john 2:1-1:5",
      "john 0:1",
      "john 22:1",
      "john 1:1-22:3",
      "john 1:1; drop table",
      "../john 1:1",
    ]) {
      expect(parsePassageParam(bad), String(bad)).toBeNull();
    }
  });

  it("accepts different case and stray spaces", () => {
    expect(parsePassageParam("  John 1:1-3 ")).toEqual(ref("john", 1, 1, 1, 3));
  });

  it("builds a link carrying the passage", () => {
    expect(withPassage("/memorize", ref("john", 1, 1, 1, 18))).toBe("/memorize?p=john+1%3A1-18");
  });
});

const v = (verse: number, chapter = 1) => ({ chapter, verse });

describe("tapVerse", () => {
  it("selects one verse on the first tap", () => {
    expect(tapVerse(null, v(5))).toEqual({ start: v(5), end: v(5), anchor: v(5) });
  });

  it("completes a range on the second tap, in either direction", () => {
    const first = tapVerse(null, v(5));
    expect(tapVerse(first, v(9))).toEqual({ start: v(5), end: v(9), anchor: null });
    expect(tapVerse(first, v(2))).toEqual({ start: v(2), end: v(5), anchor: null });
  });

  it("switches a single selected verse off when it is tapped again", () => {
    const first = tapVerse(null, v(5));
    expect(tapVerse(first, v(5))).toBeNull();
    expect(tapVerse({ start: v(5), end: v(5), anchor: null }, v(5))).toBeNull();
    // A range is not a single verse: tapping inside it starts a new selection.
    expect(tapVerse({ start: v(2), end: v(5), anchor: null }, v(5))).toEqual({
      start: v(5),
      end: v(5),
      anchor: v(5),
    });
  });

  it("starts over on the third tap", () => {
    const done: Selection = { start: v(2), end: v(5), anchor: null };
    expect(tapVerse(done, v(8))).toEqual({ start: v(8), end: v(8), anchor: v(8) });
  });
});

describe("isSelected", () => {
  const sel: Selection = { start: v(3), end: v(5), anchor: null };
  it("is true for verses inside the selection, inclusive", () => {
    expect([2, 3, 4, 5, 6].map((n) => isSelected(sel, v(n)))).toEqual([
      false,
      true,
      true,
      true,
      false,
    ]);
    expect(isSelected(null, v(1))).toBe(false);
  });
});
