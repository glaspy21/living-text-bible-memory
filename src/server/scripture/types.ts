import type { PassageRef, PassageVerse, TranslationCode, Verse } from "@/shared/scripture/types";

/** What the reader, steps and flashcards ask of a translation. They never talk to a source directly. */
export interface ScriptureProvider {
  readonly translation: TranslationCode;
  /** Every verse of one chapter, in order. */
  getChapter(book: string, chapter: number): Promise<Verse[]>;
  /** The verses of a passage, which may cross chapters. */
  getPassage(ref: PassageRef): Promise<PassageVerse[]>;
  /** The last verse number of a chapter (feeds the verse-range grid). */
  verseCount(book: string, chapter: number): Promise<number>;
}

/** The text can't be shown: unknown book/chapter, outside the ESV scope, or the source is down. */
export class ScriptureUnavailableError extends Error {
  constructor(
    message: string,
    readonly reason: "not-found" | "out-of-scope" | "source-error",
  ) {
    super(message);
    this.name = "ScriptureUnavailableError";
  }
}
