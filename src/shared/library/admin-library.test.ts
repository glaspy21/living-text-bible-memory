import { describe, expect, it } from "vitest";
import {
  arrangementLabel,
  attentionFor,
  parseFilter,
  statusesFor,
  timingProgress,
} from "./admin-library";

describe("parseFilter", () => {
  it("accepts the four filters and falls back to all", () => {
    expect(parseFilter("published")).toBe("published");
    expect(parseFilter("ready")).toBe("ready");
    expect(parseFilter("drafts")).toBe("drafts");
    expect(parseFilter(undefined)).toBe("all");
    expect(parseFilter("nonsense")).toBe("all");
    expect(parseFilter(["ready", "drafts"])).toBe("ready");
  });

  it("maps filters to statuses", () => {
    expect(statusesFor("all")).toBeNull();
    expect(statusesFor("published")).toEqual(["PUBLISHED"]);
    expect(statusesFor("ready")).toEqual(["READY"]);
    expect(statusesFor("drafts")).toEqual(["DRAFT"]);
  });
});

describe("arrangementLabel", () => {
  it("numbers only after the first", () => {
    expect(arrangementLabel("Default", 1)).toBe("Default");
    expect(arrangementLabel("Default", 2)).toBe("Default 2");
  });
});

describe("timingProgress", () => {
  it("counts verses that have both a start and an end", () => {
    expect(
      timingProgress([
        { startMs: 0, endMs: 1000 },
        { startMs: 1000, endMs: null },
        { startMs: null, endMs: null },
        { startMs: 0, endMs: 0 },
      ]),
    ).toEqual({ timed: 2, total: 4 });
    expect(timingProgress([])).toEqual({ timed: 0, total: 0 });
  });
});

describe("attentionFor", () => {
  const progress = (timed: number, total: number) => ({ timed, total });
  it("flags unfinished drafts with how far they are", () => {
    expect(
      attentionFor({ status: "DRAFT", hasPendingDraft: false, progress: progress(0, 4) }),
    ).toBe("Verse timing not started");
    expect(
      attentionFor({ status: "DRAFT", hasPendingDraft: false, progress: progress(0, 0) }),
    ).toBe("Verse timing not started");
    expect(
      attentionFor({ status: "DRAFT", hasPendingDraft: false, progress: progress(3, 4) }),
    ).toBe("1 of 4 verses still untimed");
    expect(
      attentionFor({ status: "DRAFT", hasPendingDraft: false, progress: progress(4, 4) }),
    ).toBe("Timing done — review and mark ready");
  });

  it("leaves ready and published recordings alone unless a new draft is waiting", () => {
    expect(
      attentionFor({ status: "READY", hasPendingDraft: false, progress: progress(4, 4) }),
    ).toBeNull();
    expect(
      attentionFor({ status: "PUBLISHED", hasPendingDraft: false, progress: progress(4, 4) }),
    ).toBeNull();
    expect(
      attentionFor({ status: "PUBLISHED", hasPendingDraft: true, progress: progress(2, 4) }),
    ).toBe("New draft waiting to be published");
  });
});
