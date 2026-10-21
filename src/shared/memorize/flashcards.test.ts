import { describe, expect, it } from "vitest";
import { inOrder, moveCard, shuffledFrom } from "./flashcards";

describe("moveCard", () => {
  it("steps forward and back", () => {
    expect(moveCard(2, 1, 5)).toBe(3);
    expect(moveCard(2, -1, 5)).toBe(1);
  });

  it("wraps around both ends of the deck", () => {
    expect(moveCard(4, 1, 5)).toBe(0);
    expect(moveCard(0, -1, 5)).toBe(4);
  });

  it("stays put in a deck of one, and in an empty deck", () => {
    expect(moveCard(0, 1, 1)).toBe(0);
    expect(moveCard(0, -1, 1)).toBe(0);
    expect(moveCard(0, 1, 0)).toBe(0);
  });
});

describe("shuffledFrom", () => {
  it("starts on the given card and contains every card exactly once", () => {
    for (const first of [0, 3, 6]) {
      for (const seed of [0, 0.25, 0.5, 0.99]) {
        const order = shuffledFrom(7, first, () => seed);
        expect(order[0]).toBe(first);
        expect([...order].sort((a, b) => a - b)).toEqual(inOrder(7));
      }
    }
  });

  it("is exact for a given random sequence", () => {
    // Without card 1 the rest is [0, 2, 3]; random() = 0 always swaps with slot 0, rotating it.
    expect(shuffledFrom(4, 1, () => 0)).toEqual([1, 2, 3, 0]);
    // random() just under 1 never moves anything: the rest stays in order.
    expect(shuffledFrom(4, 1, () => 0.999999)).toEqual([1, 0, 2, 3]);
  });

  it("actually reorders the rest with real randomness", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 40; i++) seen.add(shuffledFrom(6, 2).join());
    expect(seen.size).toBeGreaterThan(1);
  });

  it("handles decks of zero and one card", () => {
    expect(shuffledFrom(0, 0)).toEqual([]);
    expect(shuffledFrom(1, 0)).toEqual([0]);
  });
});
