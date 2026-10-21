import { describe, expect, it } from "vitest";
import {
  STEPS,
  revealStep,
  wordsOf,
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
  it("defaults to single for Listen and to several verses for Sing", () => {
    expect(focusModeFor("listen", null)).toBe("single");
    expect(focusModeFor("sing", null)).toBe("multi");
  });

  it("always shows one verse in Recall, whatever was chosen", () => {
    expect(focusModeFor("recall", null)).toBe("single");
    expect(focusModeFor("recall", true)).toBe("single");
    expect(focusModeFor("recall", false)).toBe("single");
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

describe("Recall words", () => {
  it("splits a verse into its words", () => {
    expect(wordsOf("  In the   beginning\nwas ")).toEqual(["In", "the", "beginning", "was"]);
    expect(wordsOf("")).toEqual([]);
  });
});

describe("revealStep", () => {
  const totals = [3, 2, 4]; // three verses of 3, 2 and 4 words

  it("reveal word goes on word by word, into the next verse", () => {
    let state = { shown: {} as Record<number, number>, focus: 0 };
    const words: number[][] = [];
    for (let i = 0; i < 9; i++) {
      const next = revealStep("reveal-word", state.shown, state.focus, totals);
      expect(next).not.toBeNull();
      state = next!;
      words.push([state.focus, state.shown[state.focus]]);
    }
    expect(words).toEqual([
      [0, 1],
      [0, 2],
      [0, 3],
      [1, 1],
      [1, 2],
      [2, 1],
      [2, 2],
      [2, 3],
      [2, 4],
    ]);
    expect(revealStep("reveal-word", state.shown, state.focus, totals)).toBeNull();
  });

  it("reveal verse completes the current verse, then the next, to the end of the range", () => {
    const first = revealStep("reveal-verse", {}, 0, totals)!;
    expect(first).toEqual({ shown: { 0: 3 }, focus: 0 });
    const second = revealStep("reveal-verse", first.shown, first.focus, totals)!;
    expect(second).toEqual({ shown: { 0: 3, 1: 2 }, focus: 1 });
    const third = revealStep("reveal-verse", second.shown, second.focus, totals)!;
    expect(third.focus).toBe(2);
    expect(revealStep("reveal-verse", third.shown, third.focus, totals)).toBeNull();
  });

  it("reveal verse finishes a verse that is part way through", () => {
    expect(revealStep("reveal-verse", { 1: 1 }, 1, totals)).toEqual({
      shown: { 1: 2 },
      focus: 1,
    });
  });

  it("hide word and hide verse work backwards through the verses", () => {
    const all = { 0: 3, 1: 2, 2: 4 };
    const word = revealStep("hide-word", all, 2, totals)!;
    expect(word).toEqual({ shown: { ...all, 2: 3 }, focus: 2 });
    const verse = revealStep("hide-verse", word.shown, word.focus, totals)!;
    expect(verse).toEqual({ shown: { 0: 3, 1: 2, 2: 0 }, focus: 2 });
    const before = revealStep("hide-verse", verse.shown, verse.focus, totals)!;
    expect(before).toEqual({ shown: { 0: 3, 1: 0, 2: 0 }, focus: 1 });
    // A hidden word reaches back into the verse before when this one is all hidden.
    expect(revealStep("hide-word", { 0: 3, 1: 0 }, 1, totals)).toEqual({
      shown: { 0: 2, 1: 0 },
      focus: 0,
    });
  });

  it("has nothing to hide when nothing shows", () => {
    expect(revealStep("hide-word", {}, 2, totals)).toBeNull();
    expect(revealStep("hide-verse", { 2: 0 }, 2, totals)).toBeNull();
  });
});
