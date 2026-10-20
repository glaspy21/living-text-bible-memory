import type { Verse } from "@/shared/scripture/types";

/**
 * Turn the ESV API's plain text ("[1] In the beginning… [2] He was…") into verses.
 * We ask the API for no headings, footnotes or references, so only verse markers remain.
 */
export function parseEsvText(chapter: number, text: string): Verse[] {
  const parts = text.split(/\[(\d+)\]/);
  const verses: Verse[] = [];
  // parts = [before, "1", text1, "2", text2, …]
  for (let i = 1; i < parts.length; i += 2) {
    const clean = parts[i + 1]
      .replace(/\(ESV\)\s*$/, "")
      .replace(/\s+/g, " ")
      .trim();
    if (clean) verses.push({ chapter, verse: Number(parts[i]), text: clean });
  }
  return verses;
}
