import { compareRefs } from "./refs";
import type { PassageRef, VerseRef } from "./types";

/**
 * The only ESV text the app may show for now: John 1–2 (owner decision, PROJECT.md §7).
 * Widen this list only after Crossway permission is confirmed.
 */
export type EsvScopeRange = { book: string; from: VerseRef; to: VerseRef };

export const ESV_SCOPE: readonly EsvScopeRange[] = [
  { book: "john", from: { chapter: 1, verse: 1 }, to: { chapter: 2, verse: 999 } },
];

/** True when every verse of the passage lies inside one permitted range. */
export function isWithinEsvScope(
  ref: PassageRef,
  scope: readonly EsvScopeRange[] = ESV_SCOPE,
): boolean {
  return scope.some(
    (r) =>
      r.book === ref.book && compareRefs(ref.start, r.from) >= 0 && compareRefs(ref.end, r.to) <= 0,
  );
}

/** A whole chapter as a passage, for scope checks. */
export function chapterPassage(book: string, chapter: number): PassageRef {
  return {
    book,
    start: { chapter, verse: 1 },
    end: { chapter, verse: 999 },
  };
}
