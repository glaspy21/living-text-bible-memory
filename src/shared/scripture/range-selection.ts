import { compareBookRefs as compareRefs, splitByBook } from "./refs";
import type { BookVerseRef as VerseRef } from "./types";

/**
 * The verse-range selector's state. Tapping works like this:
 * - Tap a verse: it becomes a one-verse selection and the selector waits for a closing verse (`first`).
 * - Tap another: the range runs between the two, whichever comes first (the endpoints may be in
 *   different chapters, or different books).
 * - Tap Start or End first, and the next tap moves only that endpoint (the other is dragged along
 *   if the move would cross it).
 * There is no length limit.
 */
export type Picking = "first" | "start" | "end" | null;

export type RangeState = { start: VerseRef; end: VerseRef; picking: Picking };

export function startRange(start: VerseRef, end: VerseRef = start): RangeState {
  return compareRefs(start, end) <= 0
    ? { start, end, picking: null }
    : { start: end, end: start, picking: null };
}

/** Choose which endpoint the next tap will move. Choosing it again cancels. */
export function pickEndpoint(state: RangeState, which: "start" | "end"): RangeState {
  return { ...state, picking: state.picking === which ? null : which };
}

export function tapRangeVerse(state: RangeState, tapped: VerseRef): RangeState {
  switch (state.picking) {
    case "start":
      return {
        start: tapped,
        end: compareRefs(state.end, tapped) < 0 ? tapped : state.end,
        picking: null,
      };
    case "end":
      return {
        start: compareRefs(state.start, tapped) > 0 ? tapped : state.start,
        end: tapped,
        picking: null,
      };
    case "first": {
      // `start` is the verse tapped first.
      const first = state.start;
      return compareRefs(first, tapped) <= 0
        ? { start: first, end: tapped, picking: null }
        : { start: tapped, end: first, picking: null };
    }
    default:
      return { start: tapped, end: tapped, picking: "first" };
  }
}

/** How a verse shows in the grid. */
export type VerseMark = "endpoint" | "inside" | "none";

export function markVerse(state: RangeState, verse: VerseRef): VerseMark {
  if (compareRefs(verse, state.start) === 0 || compareRefs(verse, state.end) === 0)
    return "endpoint";
  return compareRefs(verse, state.start) > 0 && compareRefs(verse, state.end) < 0
    ? "inside"
    : "none";
}

/**
 * Number of verses in the range, given each chapter's verse count (chapter n is `counts[n - 1]`),
 * either for one book or, across books, per book (a book whose counts aren't known counts as empty).
 */
export function rangeLength(
  state: RangeState,
  counts: readonly number[] | ((book: string) => readonly number[] | undefined),
): number {
  const countsOf = typeof counts === "function" ? counts : () => counts;
  let total = 0;
  for (const part of splitByBook({
    book: state.start.book,
    endBook: state.end.book,
    start: state.start,
    end: state.end,
  })) {
    const known = countsOf(part.book) ?? [];
    for (let c = part.start.chapter; c <= part.end.chapter; c++) {
      const first = c === part.start.chapter ? part.start.verse : 1;
      const last =
        c === part.end.chapter
          ? Math.min(part.end.verse, known[c - 1] ?? part.end.verse)
          : (known[c - 1] ?? 0);
      total += Math.max(0, last - first + 1);
    }
  }
  return total;
}
