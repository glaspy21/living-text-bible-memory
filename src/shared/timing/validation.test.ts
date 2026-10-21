import { describe, expect, it } from "vitest";
import type { TimingRow } from "./timing";
import { acknowledgeAll, describeIssue, validateTiming } from "./validation";

const row = (
  verse: number,
  startMs: number | null,
  endMs: number | null,
  over: Partial<TimingRow> = {},
): TimingRow => ({ chapter: 1, verse, startMs, endMs, ackGap: false, ackOverlap: false, ...over });

const kinds = (rows: TimingRow[], duration = 10000) =>
  validateTiming(rows, duration).issues.map((i) => `${i.kind}@${i.index}`);

describe("validateTiming", () => {
  it("passes a clean, contiguous sheet", () => {
    const result = validateTiming([row(1, 0, 1000), row(2, 1000, 2000), row(3, 2000, 3000)], 10000);
    expect(result.issues).toEqual([]);
    expect(result.ok).toBe(true);
    expect(result.timed).toBe(3);
  });
  it("is not ok for an empty sheet", () => {
    expect(validateTiming([], 1000).ok).toBe(false);
  });
  it("flags missing boundaries as errors", () => {
    expect(kinds([row(1, null, null), row(2, 0, null)])).toEqual([
      "missing-start@0",
      "missing-end@0",
      "missing-end@1",
    ]);
    expect(validateTiming([row(1, null, 5)], 10).ok).toBe(false);
  });
  it("flags an end at or before its start", () => {
    expect(kinds([row(1, 500, 500)])).toEqual(["end-not-after-start@0"]);
    expect(kinds([row(1, 900, 100)])).toEqual(["end-not-after-start@0"]);
  });
  it("flags times outside the recording", () => {
    expect(kinds([row(1, 0, 10001)])).toEqual(["outside-recording@0"]);
    expect(kinds([row(1, -1, 5)])).toEqual(["outside-recording@0"]);
    expect(kinds([row(1, 0, 10000)])).toEqual([]);
  });
  it("flags a verse that begins before the one above it", () => {
    const issues = kinds([row(1, 2000, 3000), row(2, 1000, 1500)]);
    expect(issues).toEqual(["out-of-order@1"]);
  });
  it("reports gaps and overlaps with their size, as warnings", () => {
    const result = validateTiming([row(1, 0, 1000), row(2, 1500, 2500), row(3, 2400, 3000)], 10000);
    expect(result.errors).toEqual([]);
    expect(result.warnings.map((w) => [w.kind, w.index, w.ms])).toEqual([
      ["gap", 0, 500],
      ["overlap", 1, 100],
    ]);
    expect(result.ok).toBe(false);
  });
  it("an acknowledged gap or overlap no longer blocks", () => {
    const rows = [
      row(1, 0, 1000, { ackGap: true }),
      row(2, 1500, 2500, { ackOverlap: true }),
      row(3, 2400, 3000),
    ];
    const result = validateTiming(rows, 10000);
    expect(result.warnings.every((w) => w.acknowledged)).toBe(true);
    expect(result.unacknowledged).toEqual([]);
    expect(result.ok).toBe(true);
  });
  it("an acknowledgement of the other kind does not count", () => {
    const result = validateTiming(
      [row(1, 0, 1000, { ackOverlap: true }), row(2, 1500, 2000)],
      10000,
    );
    expect(result.ok).toBe(false);
  });
  it("errors can't be acknowledged away", () => {
    const rows = [row(1, 500, 100, { ackGap: true, ackOverlap: true })];
    expect(validateTiming(rows, 1000).ok).toBe(false);
  });
  it("does not report a gap or overlap next to a verse missing a boundary", () => {
    expect(kinds([row(1, 0, null), row(2, 500, 900)])).toEqual(["missing-end@0"]);
  });
  it("counts only fully timed verses", () => {
    expect(validateTiming([row(1, 0, 5), row(2, 5, null)], 10).timed).toBe(1);
  });
});

describe("acknowledgeAll", () => {
  const rows = [row(1, 0, 1000), row(2, 1500, 2500), row(3, 2400, 3000)];
  it("acknowledges every gap and leaves overlaps alone", () => {
    const next = acknowledgeAll(rows, 10000, "gap");
    expect(next.map((r) => r.ackGap)).toEqual([true, false, false]);
    expect(next.map((r) => r.ackOverlap)).toEqual([false, false, false]);
  });
  it("acknowledges every overlap", () => {
    expect(acknowledgeAll(rows, 10000, "overlap").map((r) => r.ackOverlap)).toEqual([
      false,
      true,
      false,
    ]);
  });
  it("does not change its input", () => {
    acknowledgeAll(rows, 10000, "gap");
    expect(rows[0].ackGap).toBe(false);
  });
});

describe("describeIssue", () => {
  it("names the verses", () => {
    const [gap] = validateTiming([row(1, 0, 1000), row(2, 1500, 2000)], 10000).issues;
    expect(describeIssue(gap, ["1", "2"])).toBe("0.50 s of silence between verse 1 and verse 2.");
    const [missing] = validateTiming([row(1, null, 5)], 10).issues;
    expect(describeIssue(missing, ["1:7"])).toBe("Verse 1:7 has no start time.");
  });
});
