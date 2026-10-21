import { describe, expect, it } from "vitest";
import {
  chooseGenre,
  genreCoverage,
  nearestCovered,
  resolveSegments,
  type PlayableRecording,
  type VerseTimingRow,
} from "./playlist";

const v = (verse: number, chapter = 1) => ({ chapter, verse });
const verses = [v(1), v(2), v(3)];

const timing = (
  verse: number,
  startMs: number | null,
  endMs: number | null,
  chapter = 1,
): VerseTimingRow => ({
  chapter,
  verse,
  startMs,
  endMs,
});

const recording = (
  id: string,
  genreSlug: string,
  rows: VerseTimingRow[],
  arrangementNo = 1,
  durationMs = 60_000,
): PlayableRecording => ({
  id,
  assetId: `asset-${id}`,
  genreSlug,
  arrangementNo,
  durationMs,
  verses: rows,
});

const pop = recording("pop1", "pop", [
  timing(1, 0, 4000),
  timing(2, 4000, 9000),
  timing(3, 9000, 14000),
]);

describe("resolveSegments", () => {
  it("makes one segment per verse from the recording that covers it", () => {
    const segments = resolveSegments(verses, [pop], "pop");
    expect(segments.map((s) => s && [s.verse, s.startMs, s.endMs])).toEqual([
      [1, 0, 4000],
      [2, 4000, 9000],
      [3, 9000, 14000],
    ]);
    expect(segments[0]).toMatchObject({ recordingId: "pop1", assetId: "asset-pop1" });
  });

  it("never fills a gap from another genre", () => {
    const rock = recording("rock1", "rock", [
      timing(1, 0, 3000),
      timing(2, 3000, 6000),
      timing(3, 6000, 9000),
    ]);
    const partialPop = recording("pop2", "pop", [timing(1, 0, 4000), timing(3, 9000, 14000)]);
    const segments = resolveSegments(verses, [partialPop, rock], "pop");
    expect(segments.map((s) => s?.verse ?? null)).toEqual([1, null, 3]);
  });

  it("uses the earliest arrangement, or the chosen recording when given", () => {
    const second = recording("pop-b", "pop", [timing(1, 100, 3000)], 2);
    const first = recording("pop-a", "pop", [timing(1, 0, 4000)], 1);
    expect(resolveSegments([v(1)], [second, first], "pop")[0]?.recordingId).toBe("pop-a");
    expect(resolveSegments([v(1)], [second, first], "pop", "pop-b")[0]?.recordingId).toBe("pop-b");
  });

  it("falls back to another arrangement for verses the chosen one does not cover", () => {
    const chosen = recording("b", "pop", [timing(1, 0, 3000)], 2);
    const other = recording("a", "pop", [timing(1, 0, 4000), timing(2, 4000, 8000)], 1);
    const segments = resolveSegments([v(1), v(2)], [other, chosen], "pop", "b");
    expect(segments.map((s) => s?.recordingId)).toEqual(["b", "a"]);
  });

  it("ignores timings that are unfinished or invalid", () => {
    const bad = recording("bad", "pop", [
      timing(1, null, 4000), // no start
      timing(2, 5000, 5000), // empty span
      timing(3, 9000, 70_000), // past the end of the audio
    ]);
    expect(resolveSegments(verses, [bad], "pop")).toEqual([null, null, null]);
  });

  it("handles passages that cross chapters and recordings", () => {
    const ch1 = recording("c1", "pop", [timing(51, 0, 3000, 1)]);
    const ch2 = recording("c2", "pop", [timing(1, 0, 2500, 2), timing(2, 2500, 5000, 2)]);
    const passage = [v(51, 1), v(1, 2), v(2, 2)];
    const segments = resolveSegments(passage, [ch1, ch2], "pop");
    expect(segments.map((s) => s?.recordingId)).toEqual(["c1", "c2", "c2"]);
    expect(segments[1]).toMatchObject({ chapter: 2, verse: 1, startMs: 0 });
  });
});

describe("genreCoverage", () => {
  const rock = recording("rock1", "rock", [timing(1, 0, 3000), timing(2, 3000, 6000)]);

  it("reports each genre with music, complete ones first", () => {
    expect(genreCoverage(verses, [rock, pop])).toEqual([
      { genreSlug: "pop", covered: 3, total: 3, complete: true },
      { genreSlug: "rock", covered: 2, total: 3, complete: false },
    ]);
  });

  it("leaves out genres that cover nothing in the passage", () => {
    const elsewhere = recording("r&b", "r-and-b", [timing(9, 0, 2000)]);
    expect(genreCoverage(verses, [elsewhere])).toEqual([]);
  });
});

describe("nearestCovered", () => {
  const segments = resolveSegments(
    verses,
    [recording("p", "pop", [timing(1, 0, 1000), timing(3, 2000, 3000)])],
    "pop",
  );
  it("finds the next covered verse forwards and backwards", () => {
    expect(nearestCovered(segments, 1, 1)).toBe(2);
    expect(nearestCovered(segments, 1, -1)).toBe(0);
    expect(nearestCovered(segments, 0, 1)).toBe(0);
  });
  it("returns null when nothing is covered in that direction", () => {
    expect(nearestCovered(segments, 3, 1)).toBeNull();
    expect(nearestCovered([null, null], 0, 1)).toBeNull();
  });
});

describe("chooseGenre", () => {
  const complete = { genreSlug: "pop", covered: 3, total: 3, complete: true };
  const partial = { genreSlug: "rock", covered: 2, total: 3, complete: false };
  const other = { genreSlug: "rnb", covered: 3, total: 3, complete: true };

  it("has no genre when there is no music", () => {
    expect(chooseGenre([], "pop")).toBeNull();
  });

  it("keeps the remembered genre when it covers the whole passage", () => {
    expect(chooseGenre([complete, other], "rnb")).toBe("rnb");
  });

  it("otherwise takes the first genre that covers everything", () => {
    expect(chooseGenre([complete, other, partial], "rock")).toBe("pop");
    expect(chooseGenre([complete, partial])).toBe("pop");
  });

  it("falls back to partial coverage, preferring the remembered genre", () => {
    const less = { genreSlug: "rnb", covered: 1, total: 3, complete: false };
    expect(chooseGenre([partial, less], "rnb")).toBe("rnb");
    expect(chooseGenre([partial, less], "pop")).toBe("rock");
  });
});
