/**
 * Reads USFM (the format ebible.org publishes the World English Bible in) into plain verse text.
 * Used only by the one-off import script; the app reads the resulting JSON.
 */

/** Verse text per chapter: `chapters[1]` is chapter 1, `chapters[1][0]` is verse 1's text. */
export type ParsedBook = { chapters: Record<number, Record<number, string>> };

/** Remove inline markup, keeping only the words a reader sees. */
export function cleanVerseText(raw: string): string {
  return (
    raw
      // Footnotes and cross references, including their contents.
      .replace(/\\f\s[\s\S]*?\\f\*/g, "")
      .replace(/\\x\s[\s\S]*?\\x\*/g, "")
      // Word-level tags: \w word|strong="G1"\w*  →  word
      .replace(/\\\+?w\s+([^|\\]*?)(?:\|[^\\]*)?\\\+?w\*/g, "$1")
      // Any other closing or opening character marker, keeping its text.
      .replace(/\\\+?[a-z]+\d?\*/gi, "")
      .replace(/\\\+?(?:add|nd|wj|it|bd|em|sc|qs|tl|k|pn|bk|sig|ord|dc|ior|qt)\s/gi, "")
      .replace(/\s+/g, " ")
      .trim()
  );
}

/** Marker lines that start a new block of text but are not part of any verse. */
const NON_VERSE_BLOCK =
  /^\\(?:s\d?|r|d|sp|ms\d?|mr|mt\d?|h|toc\d|rem|id|ide|cl|cp|b|mte\d?)(?:\s|$)/;

/** Parse one book's USFM into chapters of verse text. Verse bridges (`\v 5-6`) stay on the first number. */
export function parseUsfm(usfm: string): ParsedBook {
  const chapters: ParsedBook["chapters"] = {};
  let chapter = 0;
  let verse = 0;
  let open = false; // true while lines continue the current verse

  const append = (text: string) => {
    if (!chapter || !verse || !text) return;
    const verses = (chapters[chapter] ??= {});
    verses[verse] = verses[verse] ? `${verses[verse]} ${text}` : text;
  };

  for (const rawLine of usfm.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;

    const chapterMatch = /^\\c\s+(\d+)/.exec(line);
    if (chapterMatch) {
      chapter = Number(chapterMatch[1]);
      verse = 0;
      open = false;
      continue;
    }
    if (NON_VERSE_BLOCK.test(line)) {
      open = false;
      continue;
    }

    // A line may start a verse (`\v 3 text`), optionally after a paragraph marker (`\q1 \v 3 text`).
    const verseMatch = /^(?:\\[a-z]+\d?\s+)?\\v\s+(\d+)(?:-\d+)?[a-z]?\s*(.*)$/.exec(line);
    if (verseMatch) {
      verse = Number(verseMatch[1]);
      open = true;
      append(cleanVerseText(verseMatch[2]));
      continue;
    }

    // Poetry and paragraph lines continuing the current verse: `\q1 text`, `\p text`.
    const body = line.replace(/^\\(?:p|m|mi|pi\d?|q\d?|qm\d?|li\d?|nb|qr|qc)\s*/, "");
    if (open && !body.startsWith("\\c ")) {
      const text = cleanVerseText(body);
      // Skip lines that are only a marker, like a bare `\p`.
      if (text && !/^\\[a-z]+\d?$/.test(text)) append(text);
    }
  }
  return { chapters };
}

/** Chapters as ordered arrays, ready to store: `result[0]` is chapter 1. */
export function toChapterArrays(book: ParsedBook): { verse: number; text: string }[][] {
  const numbers = Object.keys(book.chapters)
    .map(Number)
    .sort((a, b) => a - b);
  return numbers.map((n) =>
    Object.entries(book.chapters[n])
      .map(([verse, text]) => ({ verse: Number(verse), text }))
      .sort((a, b) => a.verse - b.verse),
  );
}
