/**
 * Sent by the reader as continuous scrolling moves on to another chapter. `base` is the page
 * the reader was opened on (the router's path for it never changes while scrolling), so the
 * header only applies the news to that same page.
 */
export const CHAPTER_VIEW_EVENT = "lt:chapter-view";

export type ChapterViewDetail = { base: string; book: string; chapter: number };
