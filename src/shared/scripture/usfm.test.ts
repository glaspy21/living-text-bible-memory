import { describe, expect, it } from "vitest";
import { cleanVerseText, parseUsfm, toChapterArrays } from "./usfm";

describe("cleanVerseText", () => {
  it("keeps the words of tagged text and drops the tags", () => {
    expect(cleanVerseText('\\w In|strong="G1722"\\w* \\w the|strong="G1722"\\w* beginning')).toBe(
      "In the beginning",
    );
  });

  it("joins a word split by a tag, like a contraction", () => {
    expect(cleanVerseText('hasn’\\w t|strong="G3588"\\w* overcome')).toBe("hasn’t overcome");
  });

  it("removes footnotes along with their contents", () => {
    expect(cleanVerseText("overcome\\f + \\fr 1:5 \\ft Can also be “comprehended.”\\f* it.")).toBe(
      "overcome it.",
    );
  });

  it("keeps the text inside emphasis markers", () => {
    expect(cleanVerseText("\\add Jesus\\add* wept")).toBe("Jesus wept");
  });
});

const SAMPLE = `\\id JHN 43-JHN-web.sfm World English Bible
\\h John
\\mt1 John
\\c 1
\\p
\\v 1 In the beginning was the Word.
\\v 2 The same was in the beginning.
\\s Heading that is not Scripture
\\p
\\v 3 All things were made through him.
\\q1 Without him, nothing was made
\\q2 that has been made.
\\c 2
\\p
\\v 1 The third day.
\\v 2-3 A bridged pair.
`;

describe("parseUsfm", () => {
  const book = parseUsfm(SAMPLE);

  it("reads verses by chapter", () => {
    expect(book.chapters[1][1]).toBe("In the beginning was the Word.");
    expect(book.chapters[2][1]).toBe("The third day.");
  });

  it("ignores headings and titles", () => {
    expect(JSON.stringify(book)).not.toContain("Heading");
    expect(JSON.stringify(book)).not.toContain("World English Bible");
  });

  it("joins poetry lines into the verse they belong to", () => {
    expect(book.chapters[1][3]).toBe(
      "All things were made through him. Without him, nothing was made that has been made.",
    );
  });

  it("keeps a verse bridge on its first number", () => {
    expect(book.chapters[2][2]).toBe("A bridged pair.");
  });
});

describe("toChapterArrays", () => {
  it("orders chapters and verses", () => {
    const chapters = toChapterArrays(parseUsfm(SAMPLE));
    expect(chapters).toHaveLength(2);
    expect(chapters[0].map((v) => v.verse)).toEqual([1, 2, 3]);
  });
});
