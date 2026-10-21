import { bookBySlug } from "./books";
import { parsePassageParam } from "./passage-param";

/** What the header's reference button shows, and which book and chapter the selector marks. */
export type HeaderReference = { label: string; book: string; chapter: number };

/** The chapter the app opens on when nothing else is known (also where Continue starts). */
export const DEFAULT_CHAPTER = { book: "john", chapter: 1 } as const;

const chapterRef = (book: string, chapter: number): HeaderReference => ({
  label: `${bookBySlug(book)?.name ?? book} ${chapter}`,
  book,
  chapter,
});

/**
 * The header always shows Scripture navigation, never the page name:
 * - in the reader, the chapter being read;
 * - on the memorize screens, the book and chapter where the passage being studied (`p` in the link) starts;
 * - anywhere else, the chapter read most recently on this device, else John 1.
 */
export function headerReference(
  pathname: string,
  passageParam: string | null,
  lastRead?: { book: string; chapter: number } | null,
): HeaderReference {
  const path = pathname.replace(/\/+$/, "") || "/";
  if (path.startsWith("/read/")) {
    const [, , slug = "", chapter = ""] = path.split("/");
    const book = bookBySlug(decodeURIComponent(slug));
    if (book && /^\d+$/.test(chapter)) return chapterRef(book.slug, Number(chapter));
  }
  const passage = path.startsWith("/memorize") ? parsePassageParam(passageParam) : null;
  if (passage) {
    // Only the book and chapter (where the passage starts), never the verse numbers.
    return chapterRef(passage.book, passage.start.chapter);
  }
  const fallback = lastRead && bookBySlug(lastRead.book) ? lastRead : DEFAULT_CHAPTER;
  return chapterRef(fallback.book, fallback.chapter);
}

/** The header text while a chapter has been picked in the selector but not opened yet. */
export const previewLabel = (book: string, chapter: number) => chapterRef(book, chapter).label;
