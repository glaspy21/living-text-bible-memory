import { describe, expect, it } from "vitest";
import { inOrder, moveCard, shuffled } from "./flashcards";

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

describe("shuffled", () => {
  it("contains every card exactly once", () => {
    for (const seed of [0, 0.25, 0.5, 0.99]) {
      const order = shuffled(7, () => seed);
      expect([...order].sort((a, b) => a - b)).toEqual(inOrder(7));
    }
  });

  it("is exact for a given random sequence", () => {
    // random() = 0 always swaps with index 0: [0,1,2,3] → rotates the deck.
    expect(shuffled(4, () => 0)).toEqual([1, 2, 3, 0]);
  });

  it("changes the order when asked to differ from the previous one", () => {
    const identity = inOrder(5);
    // random() just under 1 always picks the last slot, so nothing moves: the identity order.
    const order = shuffled(5, () => 0.999999, identity);
    expect(order).not.toEqual(identity);
    expect([...order].sort((a, b) => a - b)).toEqual(identity);
  });

  it("handles decks of zero and one card", () => {
    expect(shuffled(0)).toEqual([]);
    expect(shuffled(1, Math.random, [0])).toEqual([0]);
  });
});
