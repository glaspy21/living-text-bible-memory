import { describe, expect, it } from "vitest";
import { END_MODES, ICON_NAMES } from "./icons";

describe("icon set", () => {
  it("has exactly three end modes: loop, stop, next", () => {
    expect(END_MODES.map((m) => m.id)).toEqual(["loop", "stop", "next"]);
  });

  it("never uses the pause icon for an end mode", () => {
    expect(END_MODES.map((m) => m.id)).not.toContain("pause");
  });

  it("keeps cards (Flashcards) and shuffle (Shuffle) as separate icons", () => {
    expect(ICON_NAMES).toContain("cards");
    expect(ICON_NAMES).toContain("shuffle");
  });
});
