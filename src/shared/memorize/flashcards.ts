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
 * A random order of the deck (Fisher–Yates). `random` returns a number in [0, 1) and is
 * injectable so tests are exact. With more than one card the result is never the same order as
 * `previous`, so pressing Shuffle always visibly changes something.
 */
export function shuffled(
  size: number,
  random: () => number = Math.random,
  previous?: readonly number[],
): number[] {
  const attempt = () => {
    const order = inOrder(size);
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }
    return order;
  };
  let order = attempt();
  // A second, deterministic step if the shuffle landed on the same order: rotate by one.
  if (size > 1 && previous && order.every((v, i) => v === previous[i])) {
    order = [...order.slice(1), order[0]];
  }
  return order;
}
