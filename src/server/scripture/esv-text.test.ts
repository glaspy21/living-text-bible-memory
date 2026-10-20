import { describe, expect, it } from "vitest";
import { parseEsvText } from "./esv-text";

describe("parseEsvText", () => {
  it("splits the text at verse markers", () => {
    const text = "  [1] First verse.  [2] Second\n   verse. (ESV)";
    expect(parseEsvText(2, text)).toEqual([
      { chapter: 2, verse: 1, text: "First verse." },
      { chapter: 2, verse: 2, text: "Second verse." },
    ]);
  });

  it("returns nothing for text without verse markers", () => {
    expect(parseEsvText(1, "No numbers here")).toEqual([]);
    expect(parseEsvText(1, "")).toEqual([]);
  });
});
