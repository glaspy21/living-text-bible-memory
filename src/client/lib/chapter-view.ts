/**
 * Sent by the reader as continuous scrolling moves on to another chapter. `base` is the page
 * the reader was opened on (the router's path for it never changes while scrolling), so the
 * header only applies the news to that same page.
 */
export const CHAPTER_VIEW_EVENT = "lt:chapter-view";

export type ChapterViewDetail = { base: string; book: string; chapter: number };

/** Sent by the selector when a verse is chosen, so the reader scrolls it to the top even when the address is unchanged. */
export const GO_TO_VERSE_EVENT = "lt:go-to-verse";

export type GoToVerseDetail = { book: string; chapter: number; verse: number };
