/** Deck rules for flashcards: which card comes next, and shuffling. Pure, so they are easy to test. */

/** The next (+1) or previous (-1) card position, wrapping around the deck. */
export function moveCard(position: number, delta: 1 | -1, size: number): number {
  if (size <= 0) return 0;
  return (((position + delta) % size) + size) % size;
}

/** The deck in order: card i shows verse i of the passage. */
export function inOrder(size: number): number[] {
  return Array.from({ length: size }, (_, i) => i);
}

/**
 * A random order of the whole deck that starts with card `first`, so turning Shuffle on keeps
 * you on the card you are looking at and then visits every other card exactly once, in random
 * order (Fisher–Yates over the rest). `random` returns a number in [0, 1) and is injectable so
 * tests are exact.
 */
export function shuffledFrom(
  size: number,
  first: number,
  random: () => number = Math.random,
): number[] {
  if (size <= 0) return [];
  const rest = inOrder(size).filter((card) => card !== first);
  for (let i = rest.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [rest[i], rest[j]] = [rest[j], rest[i]];
  }
  return first >= 0 && first < size ? [first, ...rest] : rest;
}
