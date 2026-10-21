import { describe, expect, it } from "vitest";
import {
  markVerse,
  pickEndpoint,
  rangeLength,
  startRange,
  tapRangeVerse,
  type RangeState,
} from "./range-selection";

const v = (verse: number, chapter = 1) => ({ book: "john", chapter, verse });
const state = (a: number, b: number, picking: RangeState["picking"] = null): RangeState => ({
  start: v(a),
  end: v(b),
  picking,
});

describe("tapping verses", () => {
  it("first tap picks one verse and waits; second tap completes the range", () => {
    const first = tapRangeVerse(state(3, 7), v(10));
    expect(first).toEqual({ start: v(10), end: v(10), picking: "first" });
    expect(tapRangeVerse(first, v(14))).toEqual(state(10, 14));
  });

  it("completes the range backwards too", () => {
    const first = tapRangeVerse(state(3, 7), v(10));
    expect(tapRangeVerse(first, v(4))).toEqual(state(4, 10));
  });

  it("tapping the same verse twice makes a one-verse range", () => {
    const first = tapRangeVerse(state(3, 7), v(5));
    expect(tapRangeVerse(first, v(5))).toEqual(state(5, 5));
  });

  it("works across chapters", () => {
    const first = tapRangeVerse(state(3, 7), v(51, 1));
    expect(tapRangeVerse(first, v(5, 2))).toEqual({
      start: v(51, 1),
      end: v(5, 2),
      picking: null,
    });
    // Tapping an earlier chapter second reverses the order.
    const later = tapRangeVerse(state(3, 7), v(2, 2));
    expect(tapRangeVerse(later, v(51, 1))).toEqual({
      start: v(51, 1),
      end: v(2, 2),
      picking: null,
    });
  });
});

describe("editing one endpoint", () => {
  it("moves the start and leaves the end", () => {
    const picking = pickEndpoint(state(3, 7), "start");
    expect(tapRangeVerse(picking, v(5))).toEqual(state(5, 7));
  });

  it("drags the end along when the new start passes it", () => {
    const picking = pickEndpoint(state(3, 7), "start");
    expect(tapRangeVerse(picking, v(12))).toEqual(state(12, 12));
  });

  it("moves the end and drags the start when the end goes before it", () => {
    expect(tapRangeVerse(pickEndpoint(state(3, 7), "end"), v(9))).toEqual(state(3, 9));
    expect(tapRangeVerse(pickEndpoint(state(3, 7), "end"), v(1))).toEqual(state(1, 1));
  });

  it("can move an endpoint into another chapter", () => {
    expect(tapRangeVerse(pickEndpoint(state(3, 7), "end"), v(4, 2))).toEqual({
      start: v(3),
      end: v(4, 2),
      picking: null,
    });
  });

  it("choosing the same endpoint again cancels, and a different one switches", () => {
    const start = pickEndpoint(state(3, 7), "start");
    expect(pickEndpoint(start, "start").picking).toBeNull();
    expect(pickEndpoint(start, "end").picking).toBe("end");
  });
});

describe("startRange", () => {
  it("orders its endpoints", () => {
    expect(startRange(v(9), v(2))).toEqual(state(2, 9));
    expect(startRange(v(4))).toEqual(state(4, 4));
  });
});

describe("markVerse", () => {
  it("marks endpoints, the verses between, and the rest", () => {
    const s = state(3, 6);
    expect([2, 3, 4, 6, 7].map((n) => markVerse(s, v(n)))).toEqual([
      "none",
      "endpoint",
      "inside",
      "endpoint",
      "none",
    ]);
  });

  it("understands ranges that span chapters", () => {
    const s: RangeState = { start: v(50, 1), end: v(2, 2), picking: null };
    expect(markVerse(s, v(51, 1))).toBe("inside");
    expect(markVerse(s, v(1, 2))).toBe("inside");
    expect(markVerse(s, v(3, 2))).toBe("none");
    expect(markVerse(s, v(49, 1))).toBe("none");
  });
});

describe("rangeLength", () => {
  const counts = [51, 25, 36];
  it("counts verses in one chapter", () => {
    expect(rangeLength(state(3, 7), counts)).toBe(5);
  });
  it("counts verses across chapters", () => {
    expect(rangeLength({ start: v(50, 1), end: v(2, 2), picking: null }, counts)).toBe(4);
    expect(rangeLength({ start: v(50, 1), end: v(1, 3), picking: null }, counts)).toBe(2 + 25 + 1);
  });
});

describe("rangeLength across books", () => {
  it("counts the end of one book and the start of the next", () => {
    const counts = (book: string) => (book === "luke" ? Array(24).fill(53) : [51, 25]);
    const state: RangeState = {
      start: { book: "luke", chapter: 24, verse: 50 },
      end: { book: "john", chapter: 1, verse: 3 },
      picking: null,
    };
    expect(rangeLength(state, counts)).toBe(4 + 3);
  });
});
