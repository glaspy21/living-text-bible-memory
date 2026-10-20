import { describe, expect, it } from "vitest";
import { parseRange } from "./byte-range";

const SIZE = 1000;

describe("parseRange", () => {
  it("serves the whole file when there is no Range header", () => {
    expect(parseRange(null, SIZE)).toEqual({ kind: "full" });
    expect(parseRange("", SIZE)).toEqual({ kind: "full" });
  });

  it("handles open-ended, bounded and suffix ranges", () => {
    expect(parseRange("bytes=500-", SIZE)).toEqual({
      kind: "partial",
      range: { start: 500, end: 999 },
    });
    expect(parseRange("bytes=0-99", SIZE)).toEqual({
      kind: "partial",
      range: { start: 0, end: 99 },
    });
    expect(parseRange("bytes=-200", SIZE)).toEqual({
      kind: "partial",
      range: { start: 800, end: 999 },
    });
  });

  it("clamps an end past the file and a suffix longer than the file", () => {
    expect(parseRange("bytes=900-5000", SIZE)).toEqual({
      kind: "partial",
      range: { start: 900, end: 999 },
    });
    expect(parseRange("bytes=-5000", SIZE)).toEqual({
      kind: "partial",
      range: { start: 0, end: 999 },
    });
  });

  it("reports ranges that start beyond the file or run backwards as unsatisfiable", () => {
    expect(parseRange("bytes=1000-", SIZE)).toEqual({ kind: "unsatisfiable" });
    expect(parseRange("bytes=500-100", SIZE)).toEqual({ kind: "unsatisfiable" });
    expect(parseRange("bytes=-0", SIZE)).toEqual({ kind: "unsatisfiable" });
  });

  it("ignores malformed or multi-range headers", () => {
    for (const h of ["bytes=abc", "items=0-5", "bytes=0-5,10-15", "bytes=-", "bytes 0-5"]) {
      expect(parseRange(h, SIZE)).toEqual({ kind: "full" });
    }
  });
});
