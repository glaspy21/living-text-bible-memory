import { bookBySlug } from "@/shared/scripture/books";
import { isValidPassage, splitByBook, versesInPassage } from "@/shared/scripture/refs";
import type { PassageRef, PassageVerse, Verse } from "@/shared/scripture/types";
import { ScriptureUnavailableError } from "./types";

/** Build a passage from chapter reads, so each source only has to know how to fetch a chapter. */
export async function passageFromChapters(
  ref: PassageRef,
  getChapter: (book: string, chapter: number) => Promise<Verse[]>,
): Promise<PassageVerse[]> {
  if (!isValidPassage(ref)) {
    throw new ScriptureUnavailableError("That is not a valid passage.", "not-found");
  }
  const verses: PassageVerse[] = [];
  for (const part of splitByBook(ref)) {
    const last = Math.min(part.end.chapter, bookBySlug(part.book)?.chapterCount ?? 0);
    const chapters: number[] = [];
    for (let c = part.start.chapter; c <= last; c++) chapters.push(c);
    const all = (await Promise.all(chapters.map((c) => getChapter(part.book, c)))).flat();
    verses.push(...versesInPassage(all, part).map((v) => ({ book: part.book, ...v })));
  }
  if (verses.length === 0) {
    throw new ScriptureUnavailableError("No text for that passage.", "not-found");
  }
  return verses;
}
