import { describe, expect, it } from "vitest";
import { headerReference, previewLabel } from "./header-reference";

describe("headerReference", () => {
  it("shows the chapter being read in the reader", () => {
    expect(headerReference("/read/psalms/23", null)).toEqual({
      label: "Psalms 23",
      book: "psalms",
      chapter: 23,
    });
    expect(headerReference("/read/1-john/3", "john 1:1")).toMatchObject({ label: "1 John 3" });
  });

  it("shows the passage being studied on the memorize screens", () => {
    for (const path of [
      "/memorize",
      "/memorize/steps",
      "/memorize/flashcards",
      "/memorize/range",
    ]) {
      expect(headerReference(path, "john 1:3-6")).toEqual({
        label: "John 1",
        book: "john",
        chapter: 1,
      });
    }
    expect(headerReference("/memorize/steps", "john 1:51-2:5")).toMatchObject({
      label: "John 1",
      chapter: 1,
    });
  });

  it("never shows a page name: no passage means the last chapter read, else John 1", () => {
    expect(headerReference("/", null)).toMatchObject({ label: "John 1" });
    expect(headerReference("/memorize/flashcards", null)).toMatchObject({ label: "John 1" });
    expect(headerReference("/", null, { book: "ruth", chapter: 2 })).toMatchObject({
      label: "Ruth 2",
    });
    expect(headerReference("/memorize", "nonsense", { book: "ruth", chapter: 2 })).toMatchObject({
      label: "Ruth 2",
    });
  });

  it("falls back for unknown books, bad chapters and bare /read", () => {
    expect(headerReference("/read", null)).toMatchObject({ label: "John 1" });
    expect(headerReference("/read/nowhere/3", null)).toMatchObject({ label: "John 1" });
    expect(headerReference("/", null, { book: "nowhere", chapter: 3 })).toMatchObject({
      label: "John 1",
    });
  });

  it("ignores a passage outside the memorize screens", () => {
    expect(headerReference("/", "psalms 23:1-3")).toMatchObject({ label: "John 1" });
  });
});

describe("previewLabel", () => {
  it("puts the chosen chapter next to the book name", () => {
    expect(previewLabel("song-of-solomon", 2)).toBe("Song of Solomon 2");
  });
});
