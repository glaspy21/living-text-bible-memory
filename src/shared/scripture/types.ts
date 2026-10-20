/** Shared shapes for Scripture text, whichever translation provides it. */

export type TranslationCode = "WEB" | "ESV";

/** One verse of text. */
export type Verse = { chapter: number; verse: number; text: string };

/** A position in a book. Ordered by chapter, then verse. */
export type VerseRef = { chapter: number; verse: number };

/** A passage: a book plus a run of verses that may cross chapters (confirmed behavior). */
export type PassageRef = { book: string; start: VerseRef; end: VerseRef };
