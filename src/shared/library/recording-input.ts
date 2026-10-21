import { DEFAULT_GENRES } from "../music/genres";
import { bookBySlug } from "../scripture/books";
import { isTranslationCode } from "../scripture/translations";
import type { TranslationCode } from "../scripture/types";
import { titleCase } from "../text/title-case";

/** What the admin's metadata form sends when saving a new recording (the Upload and Metadata steps). */
export type GenreChoice = { kind: "builtin"; slug: string } | { kind: "custom"; name: string };

export type RecordingInput = {
  /** The key of the verified upload. */
  key: string;
  translation: TranslationCode;
  book: string;
  chapter: number;
  verseStart: number;
  /** Equals `chapter` unless the recording runs on into later chapters. */
  endChapter: number;
  verseEnd: number;
  genre: GenreChoice;
  description?: string;
};

export type CheckedRecording = Omit<RecordingInput, "genre" | "description"> & {
  genre: GenreChoice;
  /** Trimmed; null when empty. */
  description: string | null;
};

export type RecordingCheck =
  { ok: true; value: CheckedRecording } | { ok: false; errors: string[] };

export const MAX_GENRE_NAME = 40;
export const MAX_DESCRIPTION = 500;
const GENRE_NAME = /^[\p{L}\p{N}][\p{L}\p{N} &'’-]*$/u;

/**
 * Check a new recording's passage and genre against the book (`counts[n - 1]` is chapter n's verse
 * count). Gathers every problem so the form can show them together; custom genre names come back
 * in Title Case.
 */
export function checkRecordingInput(
  input: RecordingInput,
  counts: readonly number[],
): RecordingCheck {
  const errors: string[] = [];
  const book = bookBySlug(input.book);
  if (!isTranslationCode(input.translation)) errors.push("Choose a translation.");
  if (!book) errors.push("Choose a book.");

  const whole = (n: number) => Number.isInteger(n) && n >= 1;
  if (book) {
    const verses = (chapter: number) => counts[chapter - 1] ?? 0;
    if (!whole(input.chapter) || input.chapter > book.chapterCount) {
      errors.push(`${book.name} has chapters 1–${book.chapterCount}.`);
    } else if (!whole(input.verseStart) || input.verseStart > verses(input.chapter)) {
      errors.push(`${book.name} ${input.chapter} has verses 1–${verses(input.chapter)}.`);
    }
    if (!whole(input.endChapter) || input.endChapter > book.chapterCount) {
      errors.push(`The last chapter must be between 1 and ${book.chapterCount}.`);
    } else if (input.endChapter < input.chapter) {
      errors.push("The recording can't end in an earlier chapter than it starts.");
    } else if (!whole(input.verseEnd) || input.verseEnd > verses(input.endChapter)) {
      errors.push(`${book.name} ${input.endChapter} has verses 1–${verses(input.endChapter)}.`);
    } else if (input.endChapter === input.chapter && input.verseEnd < input.verseStart) {
      errors.push("The last verse can't come before the first.");
    }
  }

  let genre: GenreChoice = input.genre;
  if (input.genre.kind === "builtin") {
    if (!DEFAULT_GENRES.some((g) => g.slug === (input.genre as { slug: string }).slug)) {
      errors.push("Choose a genre.");
    }
  } else {
    const name = titleCase(input.genre.name.replace(/\s+/g, " "));
    if (!name) errors.push("Enter a name for the custom genre.");
    else if (name.length > MAX_GENRE_NAME)
      errors.push(`Keep the genre name to ${MAX_GENRE_NAME} characters.`);
    else if (!GENRE_NAME.test(name))
      errors.push("Use letters, numbers, spaces, & ' and - in the genre name.");
    genre = { kind: "custom", name };
  }

  const description = (input.description ?? "").trim();
  if (description.length > MAX_DESCRIPTION) {
    errors.push(`Keep the description to ${MAX_DESCRIPTION} characters.`);
  }

  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, value: { ...input, genre, description: description || null } };
}
