import { describe, expect, it } from "vitest";
import {
  STEPS,
  dashLines,
  focusLabel,
  focusModeFor,
  hidesText,
  parseStep,
  stepAfter,
  visibility,
} from "./steps";

describe("the steps", () => {
  it("are exactly Listen, Sing, Recall, Chain, in that order", () => {
    expect(STEPS.map((s) => s.label)).toEqual(["Listen", "Sing", "Recall", "Chain"]);
    expect(STEPS.every((s) => s.help.length > 0)).toBe(true);
  });

  it("parse from the URL, defaulting to Listen", () => {
    expect(parseStep("recall")).toBe("recall");
    for (const bad of [null, undefined, "", "Recall", "flashcards", "5"]) {
      expect(parseStep(bad)).toBe("listen");
    }
  });

  it("wrap around in both directions", () => {
    expect(stepAfter("listen", 1)).toBe("sing");
    expect(stepAfter("chain", 1)).toBe("listen");
    expect(stepAfter("listen", -1)).toBe("chain");
    expect(stepAfter("recall", -1)).toBe("sing");
  });

  it("hide the text only in Recall and Chain", () => {
    expect(STEPS.filter((s) => hidesText(s.id)).map((s) => s.id)).toEqual(["recall", "chain"]);
  });
});

describe("focus mode", () => {
  it("defaults to single for Listen and Recall and to several verses for Sing", () => {
    expect(focusModeFor("listen", null)).toBe("single");
    expect(focusModeFor("sing", null)).toBe("multi");
    expect(focusModeFor("recall", null)).toBe("single");
  });

  it("follows the listener's toggle once they have chosen", () => {
    expect(focusModeFor("listen", true)).toBe("multi");
    expect(focusModeFor("sing", false)).toBe("single");
  });

  it("always shows the whole passage in Chain, whatever was chosen", () => {
    expect(focusModeFor("chain", null)).toBe("whole");
    expect(focusModeFor("chain", false)).toBe("whole");
    expect(focusModeFor("chain", true)).toBe("whole");
  });
});

describe("visibility", () => {
  it("focuses one verse and hides the others in single mode", () => {
    expect([0, 1, 2].map((i) => visibility("single", i, 1))).toEqual(["gone", "focused", "gone"]);
  });

  it("fades the others in multi mode, never hiding them", () => {
    expect([0, 1, 2].map((i) => visibility("multi", i, 1))).toEqual(["faded", "focused", "faded"]);
  });

  it("shows everything plainly in the whole-passage view", () => {
    expect([0, 1, 2].map((i) => visibility("whole", i, 1))).toEqual(["plain", "plain", "plain"]);
  });
});

describe("focusLabel", () => {
  it("describes each mode", () => {
    expect(focusLabel("single", 4, 3, 7)).toBe("Verse 4 of 3–7");
    expect(focusLabel("multi", 4, 3, 7)).toBe("Focus: verse 4 · click a verse to move focus");
    expect(focusLabel("whole", 4, 3, 7)).toBe("Whole passage");
  });
});

describe("dashLines", () => {
  it("uses one full line for a short verse", () => {
    expect(dashLines(40)).toEqual([100]);
    expect(dashLines(0)).toEqual([100]);
  });

  it("adds a line per ~70 characters, with a shorter last line", () => {
    const lines = dashLines(150);
    expect(lines).toHaveLength(3);
    expect(lines.slice(0, 2)).toEqual([100, 100]);
    expect(lines[2]).toBeGreaterThanOrEqual(55);
    expect(lines[2]).toBeLessThan(90);
  });

  it("is the same every time for the same verse", () => {
    expect(dashLines(123)).toEqual(dashLines(123));
  });
});
