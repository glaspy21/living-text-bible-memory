import { bookBySlug } from "./books";
import type { PassageRef, Verse, VerseRef } from "./types";

/** Negative if a comes first, positive if b does, 0 if they are the same verse. */
export function compareRefs(a: VerseRef, b: VerseRef): number {
  return a.chapter - b.chapter || a.verse - b.verse;
}

/** True when the passage's start is not after its end and both numbers are positive whole numbers. */
export function isValidPassage(ref: PassageRef): boolean {
  const whole = (n: number) => Number.isInteger(n) && n >= 1;
  return (
    [ref.start.chapter, ref.start.verse, ref.end.chapter, ref.end.verse].every(whole) &&
    compareRefs(ref.start, ref.end) <= 0
  );
}

/** The verses that fall inside a passage, in order. */
export function versesInPassage(verses: readonly Verse[], ref: PassageRef): Verse[] {
  return verses.filter((v) => compareRefs(v, ref.start) >= 0 && compareRefs(v, ref.end) <= 0);
}

/**
 * A readable reference: "John 1:1", "John 1:1–18", or across chapters "John 1:51–2:5".
 * Falls back to the slug when the book is unknown.
 */
export function formatReference(ref: PassageRef): string {
  const name = bookBySlug(ref.book)?.name ?? ref.book;
  const { start, end } = ref;
  const from = `${start.chapter}:${start.verse}`;
  if (compareRefs(start, end) === 0) return `${name} ${from}`;
  if (start.chapter === end.chapter) return `${name} ${from}–${end.verse}`;
  return `${name} ${from}–${end.chapter}:${end.verse}`;
}

/**
 * Every verse in a passage, in order, given each chapter's verse count (chapter n is
 * `counts[n - 1]`). Chapters or verses beyond the counts are left out.
 */
export function expandPassage(ref: PassageRef, counts: readonly number[]): VerseRef[] {
  const verses: VerseRef[] = [];
  for (let chapter = ref.start.chapter; chapter <= ref.end.chapter; chapter++) {
    const first = chapter === ref.start.chapter ? ref.start.verse : 1;
    const last = Math.min(
      chapter === ref.end.chapter ? ref.end.verse : Number.POSITIVE_INFINITY,
      counts[chapter - 1] ?? 0,
    );
    for (let verse = first; verse <= last; verse++) verses.push({ chapter, verse });
  }
  return verses;
}
