/** Shared shapes for Scripture text, whichever translation provides it. */

export type TranslationCode = "WEB" | "ESV";

/** One verse of text. */
export type Verse = { chapter: number; verse: number; text: string };

/** A position in a book. Ordered by chapter, then verse. */
export type VerseRef = { chapter: number; verse: number };

/** A verse together with its book (slug), for anything that can span books. */
export type BookVerseRef = VerseRef & { book: string };

/** A verse of text together with its book, as returned for a passage. */
export type PassageVerse = Verse & { book: string };

/**
 * A passage: a run of verses that may cross chapters (confirmed) and books (owner request).
 * `book` is where it starts; `endBook` is where it ends when that is a later book (otherwise it
 * ends in `book`).
 */
export type PassageRef = { book: string; start: VerseRef; end: VerseRef; endBook?: string };
