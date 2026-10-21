import { compareRefs } from "./refs";
import type { VerseRef } from "./types";

/**
 * Tap-to-select on the reader: the first tap picks one verse and waits for a second tap, which
 * completes the range (in either direction). A third tap starts over. Tapping the one verse that
 * is selected switches it off again (nothing selected, so Memorize uses the whole chapter).
 */
export type Selection = {
  start: VerseRef;
  end: VerseRef;
  /** Set after the first tap; the next tap completes the range from here. */
  anchor: VerseRef | null;
};

export function tapVerse(current: Selection | null, tapped: VerseRef): Selection | null {
  if (
    current &&
    compareRefs(current.start, tapped) === 0 &&
    compareRefs(current.end, tapped) === 0
  ) {
    return null;
  }
  if (current?.anchor) {
    const [start, end] =
      compareRefs(current.anchor, tapped) <= 0
        ? [current.anchor, tapped]
        : [tapped, current.anchor];
    return { start, end, anchor: null };
  }
  return { start: tapped, end: tapped, anchor: tapped };
}

export function isSelected(selection: Selection | null, verse: VerseRef): boolean {
  return (
    selection !== null &&
    compareRefs(verse, selection.start) >= 0 &&
    compareRefs(verse, selection.end) <= 0
  );
}

/**
 * How a verse is marked on the reader: every verse in the chosen range gets the same tinted
 * background, and only the first and last verse of the range (or the single tapped verse) also
 * get the gold edge on the left.
 */
export function verseMarking(
  selection: Selection | null,
  verse: VerseRef,
): { inRange: boolean; edge: boolean } {
  if (!isSelected(selection, verse) || !selection) return { inRange: false, edge: false };
  return {
    inRange: true,
    edge: compareRefs(verse, selection.start) === 0 || compareRefs(verse, selection.end) === 0,
  };
}
