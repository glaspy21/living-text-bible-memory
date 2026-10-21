import { describe, expect, it } from "vitest";
import {
  clampView,
  filledCount,
  fitPxPerSec,
  formatTimeMs,
  hitHandle,
  markAt,
  msToX,
  parseTimeInput,
  rulerStepMs,
  sameTiming,
  setBoundary,
  xToMs,
  zoomAt,
  type TimingRow,
} from "./timing";

const row = (
  verse: number,
  startMs: number | null = null,
  endMs: number | null = null,
): TimingRow => ({
  chapter: 1,
  verse,
  startMs,
  endMs,
  ackGap: false,
  ackOverlap: false,
});

describe("parseTimeInput", () => {
  it.each([
    ["65", 65000],
    ["1:05", 65000],
    ["1:05.250", 65250],
    ["1:05.5", 65500],
    ["0:00.007", 7],
    ["65,25", 65250],
    [" 2:00 ", 120000],
  ])("reads %s", (text, ms) => expect(parseTimeInput(text)).toBe(ms));
  it.each(["", "abc", "1:75", "-3", "1:2:3", "1.2345", "1:"])("rejects %j", (text) =>
    expect(parseTimeInput(text)).toBeNull(),
  );
  it("round-trips through formatTimeMs", () => {
    for (const ms of [0, 7, 999, 1000, 65250, 3599999]) {
      expect(parseTimeInput(formatTimeMs(ms))).toBe(ms);
    }
  });
});

describe("formatTimeMs", () => {
  it("pads and handles empty values", () => {
    expect(formatTimeMs(65250)).toBe("1:05.250");
    expect(formatTimeMs(null)).toBe("");
    expect(formatTimeMs(Number.NaN)).toBe("");
    expect(formatTimeMs(-5)).toBe("0:00.000");
  });
});

describe("setBoundary", () => {
  it("sets, rounds and clamps into the recording", () => {
    const rows = [row(1), row(2)];
    expect(setBoundary(rows, 0, "start", 1234.6, 10000)[0].startMs).toBe(1235);
    expect(setBoundary(rows, 0, "end", 99999, 10000)[0].endMs).toBe(10000);
    expect(setBoundary(rows, 0, "start", -40, 10000)[0].startMs).toBe(0);
  });
  it("can clear a boundary", () => {
    expect(setBoundary([row(1, 100, 200)], 0, "end", null, 1000)[0].endMs).toBeNull();
  });
  it("keeps odd values (end before start, overlaps) for validation to flag", () => {
    const rows = setBoundary([row(1, 5000, 6000)], 0, "end", 1000, 10000);
    expect(rows[0]).toMatchObject({ startMs: 5000, endMs: 1000 });
  });
  it("clears acknowledgements next to a moved boundary only", () => {
    const rows = [row(1, 0, 100), row(2, 200, 300), row(3, 400, 500)].map((r) => ({
      ...r,
      ackGap: true,
      ackOverlap: true,
    }));
    const moved = setBoundary(rows, 1, "start", 250, 1000);
    expect(moved.map((r) => r.ackGap)).toEqual([false, false, true]);
    const movedEnd = setBoundary(rows, 1, "end", 350, 1000);
    expect(movedEnd.map((r) => r.ackGap)).toEqual([true, false, false]);
  });
  it("leaves acknowledgements alone when nothing changed", () => {
    const rows = [{ ...row(1, 100, 200), ackGap: true }];
    expect(setBoundary(rows, 0, "start", 100, 1000)[0].ackGap).toBe(true);
  });
  it("ignores an index that does not exist", () => {
    expect(setBoundary([row(1)], 4, "start", 5, 100)).toEqual([row(1)]);
  });
  it("does not change its input", () => {
    const rows = [row(1)];
    setBoundary(rows, 0, "start", 5, 100);
    expect(rows[0].startMs).toBeNull();
  });
});

describe("markAt", () => {
  it("starts the first unstarted verse", () => {
    const next = markAt([row(1), row(2)], 1500, 10000);
    expect(next[0].startMs).toBe(1500);
    expect(next[1].startMs).toBeNull();
  });
  it("then ends it", () => {
    const next = markAt([row(1, 1500), row(2)], 4000, 10000);
    expect(next[0].endMs).toBe(4000);
  });
  it("starting the next verse closes an open previous one at the same moment", () => {
    const rows = [row(1, 1000, null), row(2)];
    // verse 1 is open and comes first: mark ends it
    expect(markAt(rows, 3000, 10000)[0].endMs).toBe(3000);
    // with verse 1 ended, the next mark starts verse 2
    const ended = markAt(rows, 3000, 10000);
    expect(markAt(ended, 3200, 10000)[1].startMs).toBe(3200);
  });
  it("closes the previous verse when starting the next if it has no end", () => {
    const rows = [row(1, 1000, 2000), row(2), row(3)];
    expect(markAt(rows, 2500, 10000)[1].startMs).toBe(2500);
  });
  it("does nothing when everything is set", () => {
    const rows = [row(1, 1, 2)];
    expect(markAt(rows, 9, 10)).toEqual(rows);
  });
});

describe("counting and comparing", () => {
  it("counts verses with both boundaries", () => {
    expect(filledCount([row(1, 1, 2), row(2, 3), row(3)])).toBe(1);
  });
  it("compares boundaries and acknowledgements", () => {
    expect(sameTiming([row(1, 1, 2)], [row(1, 1, 2)])).toBe(true);
    expect(sameTiming([row(1, 1, 2)], [row(1, 1, 3)])).toBe(false);
    expect(sameTiming([row(1, 1, 2)], [{ ...row(1, 1, 2), ackGap: true }])).toBe(false);
    expect(sameTiming([row(1)], [row(1), row(2)])).toBe(false);
  });
});

describe("the waveform window", () => {
  const view = { startMs: 2000, pxPerSec: 100 };
  it("converts between time and pixels", () => {
    expect(msToX(3000, view)).toBe(100);
    expect(xToMs(100, view)).toBe(3000);
    expect(xToMs(msToX(4321, view), view)).toBeCloseTo(4321);
  });
  it("fits the recording to the width", () => {
    expect(fitPxPerSec(10000, 1000)).toBe(100);
    expect(fitPxPerSec(0, 1000)).toBe(2);
    expect(fitPxPerSec(1e9, 1000)).toBe(2);
  });
  it("keeps the window inside the recording", () => {
    expect(clampView({ startMs: -500, pxPerSec: 100 }, 10000, 500).startMs).toBe(0);
    expect(clampView({ startMs: 9999, pxPerSec: 100 }, 10000, 500).startMs).toBe(5000);
    expect(clampView({ startMs: 5, pxPerSec: 100 }, 1000, 500).startMs).toBe(0);
    expect(clampView({ startMs: 0, pxPerSec: 99999 }, 1000, 500).pxPerSec).toBe(2000);
  });
  it("zooms about the pointer", () => {
    const zoomed = zoomAt(view, 2, 200, 60000, 1000);
    expect(zoomed.pxPerSec).toBe(200);
    expect(xToMs(200, zoomed)).toBeCloseTo(xToMs(200, view));
  });
  it("picks a readable ruler step", () => {
    expect(rulerStepMs(100)).toBe(1000);
    expect(rulerStepMs(2)).toBe(60000);
    expect(rulerStepMs(5000)).toBe(20);
  });
  it("finds the nearest handle within reach", () => {
    const rows = [row(1, 3000, 4000), row(2, 4030, 6000)];
    // x for 4000ms = 200, for 4030ms = 203
    expect(hitHandle(rows, 201, view)).toEqual({ index: 0, which: "end" });
    expect(hitHandle(rows, 203, view)).toEqual({ index: 1, which: "start" });
    expect(hitHandle(rows, 50, view)).toBeNull();
    expect(hitHandle([row(1)], 0, view)).toBeNull();
  });
});
