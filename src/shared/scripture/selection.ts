import { compareRefs } from "./refs";
import type { VerseRef } from "./types";

/**
 * Tap-to-select on the reader: the first tap picks one verse and waits for a second tap, which
 * completes the range (in either direction). A third tap starts over.
 */
export type Selection = {
  start: VerseRef;
  end: VerseRef;
  /** Set after the first tap; the next tap completes the range from here. */
  anchor: VerseRef | null;
};

export function tapVerse(current: Selection | null, tapped: VerseRef): Selection {
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
