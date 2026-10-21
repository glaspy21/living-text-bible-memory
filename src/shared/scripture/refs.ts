import { BOOKS, bookBySlug } from "./books";
import type { BookVerseRef, PassageRef, Verse, VerseRef } from "./types";

/** Negative if a comes first, positive if b does, 0 if they are the same verse. */
export function compareRefs(a: VerseRef, b: VerseRef): number {
  return a.chapter - b.chapter || a.verse - b.verse;
}

/** The book a passage ends in. */
export const endBookOf = (ref: PassageRef): string => ref.endBook ?? ref.book;

/** Like `compareRefs`, but for verses that may be in different books (Bible order). */
export function compareBookRefs(a: BookVerseRef, b: BookVerseRef): number {
  return (bookBySlug(a.book)?.id ?? 0) - (bookBySlug(b.book)?.id ?? 0) || compareRefs(a, b);
}

/** True when the passage's start is not after its end and both numbers are positive whole numbers. */
export function isValidPassage(ref: PassageRef): boolean {
  const whole = (n: number) => Number.isInteger(n) && n >= 1;
  if (![ref.start.chapter, ref.start.verse, ref.end.chapter, ref.end.verse].every(whole)) {
    return false;
  }
  const first = bookBySlug(ref.book);
  const last = bookBySlug(endBookOf(ref));
  if (!first || !last || last.id < first.id) return false;
  return first.id === last.id ? compareRefs(ref.start, ref.end) <= 0 : true;
}

/**
 * A passage cut at book boundaries: one single-book passage per book it touches, the middle ones
 * whole. A passage within one book comes back as itself.
 */
export function splitByBook(ref: PassageRef): PassageRef[] {
  const first = bookBySlug(ref.book);
  const last = bookBySlug(endBookOf(ref));
  if (!first || !last || first.id === last.id)
    return [{ book: ref.book, start: ref.start, end: ref.end }];
  return BOOKS.filter((b) => b.id >= first.id && b.id <= last.id).map((b) => ({
    book: b.slug,
    start: b === first ? ref.start : { chapter: 1, verse: 1 },
    end: b === last ? ref.end : { chapter: b.chapterCount, verse: 999 },
  }));
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
  if (ref.endBook && ref.endBook !== ref.book) {
    const endName = bookBySlug(ref.endBook)?.name ?? ref.endBook;
    return `${name} ${start.chapter}:${start.verse}–${endName} ${end.chapter}:${end.verse}`;
  }
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

/** Every verse of a passage that may span books, in order, given each book's verse counts. */
export function expandPassageAcrossBooks(
  ref: PassageRef,
  countsOf: (book: string) => readonly number[],
): BookVerseRef[] {
  return splitByBook(ref).flatMap((part) =>
    expandPassage(part, countsOf(part.book)).map((v) => ({ book: part.book, ...v })),
  );
}
