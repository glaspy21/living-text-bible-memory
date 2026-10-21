import "server-only";
import { db } from "@/server/db/client";
import { createAvailability } from "./availability";

const availability = createAvailability(db);

/**
 * The dots and "recording available" notes are a courtesy, so if the database is unreachable the
 * reader still works and simply shows no music, instead of failing the whole page.
 */
async function orElse<T>(fallback: T, read: () => Promise<T>): Promise<T> {
  try {
    return await read();
  } catch (error) {
    console.warn(
      "Music availability could not be read (is DATABASE_URL set?):",
      error instanceof Error ? error.message : error,
    );
    return fallback;
  }
}

export const booksWithMusic = () => orElse(new Set<string>(), availability.booksWithMusic);
export const chapterHasMusic = (book: string, chapter: number) =>
  orElse(false, () => availability.chapterHasMusic(book, chapter));
