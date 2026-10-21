import { describe, expect, it } from "vitest";
import { addRecent, parseRecent, relativeDay, type RecentChapter } from "./recent";

const DAY = 24 * 60 * 60 * 1000;

const at = (book: string, chapter: number, openedAt = 1): RecentChapter => ({
  book,
  chapter,
  openedAt,
});

describe("addRecent", () => {
  it("puts the newest chapter first", () => {
    expect(addRecent([at("john", 1)], at("psalms", 23))).toEqual([at("psalms", 23), at("john", 1)]);
  });

  it("moves a repeated chapter up instead of listing it twice", () => {
    const list = [at("psalms", 23), at("john", 1), at("exodus", 23)];
    expect(addRecent(list, at("john", 1, 99))).toEqual([
      at("john", 1, 99),
      at("psalms", 23),
      at("exodus", 23),
    ]);
  });

  it("keeps different chapters of the same book separate, and caps the length", () => {
    const list = addRecent([at("john", 1)], at("john", 2));
    expect(list).toHaveLength(2);
    const many = Array.from({ length: 5 }, (_, i) => at("psalms", i + 1));
    expect(addRecent(many, at("john", 1), 3)).toHaveLength(3);
  });
});

describe("parseRecent", () => {
  it("reads a valid list", () => {
    const raw = JSON.stringify([at("john", 1, 5)]);
    expect(parseRecent(raw)).toEqual([at("john", 1, 5)]);
  });

  it("returns an empty list for nothing, junk or the wrong shape", () => {
    for (const raw of [null, undefined, "", "not json", "{}", "42", "null"]) {
      expect(parseRecent(raw)).toEqual([]);
    }
  });

  it("drops entries that are not real chapters", () => {
    const raw = JSON.stringify([
      at("john", 1),
      at("nonsense", 1),
      at("john", 22),
      at("john", 0),
      { book: "john", chapter: 1.5, openedAt: 1 },
      { book: "john", chapter: 1 },
      { book: 5, chapter: 1, openedAt: 1 },
      null,
      "x",
    ]);
    expect(parseRecent(raw)).toEqual([at("john", 1)]);
  });
});

describe("relativeDay", () => {
  const now = new Date(2026, 9, 20, 15, 0).getTime();
  const daysAgo = (n: number, hour = 9) => new Date(2026, 9, 20 - n, hour, 0).getTime();

  it("names today and yesterday by calendar day, not by 24 hours", () => {
    expect(relativeDay(daysAgo(0, 1), now)).toBe("Today");
    expect(relativeDay(daysAgo(1, 23), now)).toBe("Yesterday");
  });

  it("counts days up to a week, then shows the date", () => {
    expect(relativeDay(daysAgo(3), now)).toBe("3 days ago");
    expect(relativeDay(daysAgo(10), now)).toBe("Oct 10");
  });

  it("treats a time in the future as today", () => {
    expect(relativeDay(now + 5 * DAY, now)).toBe("Today");
  });
});
