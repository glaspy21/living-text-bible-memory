import { isValidPassage, versesInPassage } from "@/shared/scripture/refs";
import type { PassageRef, Verse } from "@/shared/scripture/types";
import { ScriptureUnavailableError } from "./types";

/** Build a passage from chapter reads, so each source only has to know how to fetch a chapter. */
export async function passageFromChapters(
  ref: PassageRef,
  getChapter: (book: string, chapter: number) => Promise<Verse[]>,
): Promise<Verse[]> {
  if (!isValidPassage(ref)) {
    throw new ScriptureUnavailableError("That is not a valid passage.", "not-found");
  }
  const chapters: number[] = [];
  for (let c = ref.start.chapter; c <= ref.end.chapter; c++) chapters.push(c);
  const all = (await Promise.all(chapters.map((c) => getChapter(ref.book, c)))).flat();
  const verses = versesInPassage(all, ref);
  if (verses.length === 0) {
    throw new ScriptureUnavailableError("No text for that passage.", "not-found");
  }
  return verses;
}
