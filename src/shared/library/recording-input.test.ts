import { describe, expect, it } from "vitest";
import { checkRecordingInput, type RecordingInput } from "./recording-input";

const COUNTS = [51, 25, 36]; // John 1–3 (a shortened book is enough here)

const input = (over: Partial<RecordingInput> = {}): RecordingInput => ({
  key: "recordings/abc12345-def/original.mp3",
  translation: "WEB",
  book: "john",
  chapter: 1,
  verseStart: 1,
  endChapter: 1,
  verseEnd: 18,
  genre: { kind: "builtin", slug: "pop" },
  ...over,
});

const errorsFor = (over: Partial<RecordingInput>) => {
  const result = checkRecordingInput(input(over), COUNTS);
  return result.ok ? [] : result.errors;
};

describe("checkRecordingInput", () => {
  it("accepts a normal passage, a single verse, a whole chapter and a cross-chapter recording", () => {
    for (const over of [
      {},
      { verseStart: 5, verseEnd: 5 },
      { verseStart: 1, verseEnd: 51 },
      { chapter: 1, verseStart: 40, endChapter: 2, verseEnd: 10 },
    ]) {
      expect(checkRecordingInput(input(over), COUNTS).ok).toBe(true);
    }
  });

  it("rejects chapters and verses that don't exist", () => {
    expect(errorsFor({ chapter: 22 })[0]).toContain("chapters 1–21");
    expect(errorsFor({ chapter: 0 })).not.toEqual([]);
    expect(errorsFor({ verseStart: 52, verseEnd: 52 })[0]).toContain("verses 1–51");
    expect(errorsFor({ verseEnd: 99 })[0]).toContain("verses 1–51");
    expect(errorsFor({ verseStart: 1.5 })).not.toEqual([]);
  });

  it("rejects a passage that ends before it starts", () => {
    expect(errorsFor({ verseStart: 10, verseEnd: 3 })[0]).toContain("can't come before");
    expect(errorsFor({ chapter: 2, endChapter: 1 })[0]).toContain("earlier chapter");
  });

  it("rejects an unknown book or translation", () => {
    expect(errorsFor({ book: "nonsense" })[0]).toContain("Choose a book");
    expect(errorsFor({ translation: "KJV" as "WEB" })[0]).toContain("translation");
  });

  it("reports every problem at once", () => {
    expect(errorsFor({ book: "nonsense", translation: "x" as "WEB" }).length).toBeGreaterThan(1);
  });

  it("accepts the built-in genres and rejects others", () => {
    expect(checkRecordingInput(input({ genre: { kind: "builtin", slug: "rnb" } }), COUNTS).ok).toBe(
      true,
    );
    expect(errorsFor({ genre: { kind: "builtin", slug: "metal" } })[0]).toContain("Choose a genre");
  });

  it("puts custom genre names in Title Case", () => {
    const result = checkRecordingInput(
      input({ genre: { kind: "custom", name: "  folk   acoustic " } }),
      COUNTS,
    );
    expect(result.ok && result.value.genre).toEqual({ kind: "custom", name: "Folk Acoustic" });
  });

  it("rejects empty, too long and odd custom genre names", () => {
    expect(errorsFor({ genre: { kind: "custom", name: "   " } })[0]).toContain("Enter a name");
    expect(errorsFor({ genre: { kind: "custom", name: "x".repeat(41) } })[0]).toContain(
      "40 characters",
    );
    expect(errorsFor({ genre: { kind: "custom", name: "<script>" } })[0]).toContain("Use letters");
    expect(
      checkRecordingInput(input({ genre: { kind: "custom", name: "R&B Gospel" } }), COUNTS).ok,
    ).toBe(true);
  });

  it("trims the description and rejects a very long one", () => {
    const result = checkRecordingInput(input({ description: "  A quiet arrangement.  " }), COUNTS);
    expect(result.ok && result.value.description).toBe("A quiet arrangement.");
    const empty = checkRecordingInput(input({ description: "   " }), COUNTS);
    expect(empty.ok && empty.value.description).toBeNull();
    expect(errorsFor({ description: "x".repeat(501) })[0]).toContain("500 characters");
  });
});
