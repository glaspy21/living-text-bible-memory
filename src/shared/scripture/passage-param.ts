import { bookBySlug } from "./books";
import { isValidPassage } from "./refs";
import type { PassageRef } from "./types";

/**
 * A passage as one URL value, e.g. "john 1:1-18" or across chapters "john 1:51-2:5".
 * Reader, range selector, steps and flashcards pass the chosen passage this way (query `p`).
 */
export function formatPassageParam(ref: PassageRef): string {
  const { start, end } = ref;
  const from = `${ref.book} ${start.chapter}:${start.verse}`;
  if (start.chapter === end.chapter && start.verse === end.verse) return from;
  if (start.chapter === end.chapter) return `${from}-${end.verse}`;
  return `${from}-${end.chapter}:${end.verse}`;
}

const PATTERN = /^([a-z0-9-]+) (\d+):(\d+)(?:-(?:(\d+):)?(\d+))?$/;

/** Parse a `p` value. Returns null for anything that is not a real, in-order passage of a known book. */
export function parsePassageParam(value: string | null | undefined): PassageRef | null {
  const match = PATTERN.exec((value ?? "").trim().toLowerCase());
  if (!match) return null;
  const [, slug, c1, v1, c2, v2] = match;
  const book = bookBySlug(slug);
  if (!book) return null;

  const start = { chapter: Number(c1), verse: Number(v1) };
  const end =
    v2 === undefined
      ? start
      : { chapter: c2 === undefined ? start.chapter : Number(c2), verse: Number(v2) };
  const ref: PassageRef = { book: book.slug, start, end };
  if (!isValidPassage(ref) || end.chapter > book.chapterCount) return null;
  return ref;
}

/** A link to another screen that carries the passage. */
export function withPassage(path: string, ref: PassageRef): string {
  return `${path}?${new URLSearchParams({ p: formatPassageParam(ref) }).toString()}`;
}
