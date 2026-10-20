import { describe, expect, it } from "vitest";
import { BOOKS, bookBySlug } from "./books";

const chapters = (t: "OLD" | "NEW") =>
  BOOKS.filter((b) => b.testament === t).reduce((n, b) => n + b.chapterCount, 0);

describe("books", () => {
  it("has 39 Old Testament and 27 New Testament books in order", () => {
    expect(BOOKS).toHaveLength(66);
    expect(BOOKS.filter((b) => b.testament === "OLD")).toHaveLength(39);
    expect(BOOKS.map((b) => b.id)).toEqual(Array.from({ length: 66 }, (_, i) => i + 1));
    expect(BOOKS[0].name).toBe("Genesis");
    expect(BOOKS[39].name).toBe("Matthew");
    expect(BOOKS[65].name).toBe("Revelation");
  });

  it("has 929 Old Testament and 260 New Testament chapters (1,189 total)", () => {
    expect(chapters("OLD")).toBe(929);
    expect(chapters("NEW")).toBe(260);
  });

  it("has unique OSIS codes and slugs", () => {
    expect(new Set(BOOKS.map((b) => b.osis)).size).toBe(66);
    expect(new Set(BOOKS.map((b) => b.slug)).size).toBe(66);
  });

  it("finds books by URL slug", () => {
    expect(bookBySlug("1-john")?.osis).toBe("1John");
    expect(bookBySlug("song-of-solomon")?.chapterCount).toBe(8);
    expect(bookBySlug("John")?.id).toBe(43);
    expect(bookBySlug("nope")).toBeUndefined();
  });
});
