import "server-only";
import { bookBySlug } from "@/shared/scripture/books";
import { chapterPassage, isWithinEsvScope } from "@/shared/scripture/esv-scope";
import type { PassageRef, PassageVerse, Verse } from "@/shared/scripture/types";
import { TtlCache } from "./cache";
import { parseEsvText } from "./esv-text";
import { passageFromChapters } from "./passage";
import { ScriptureUnavailableError, type ScriptureProvider } from "./types";

const ENDPOINT = "https://api.esv.org/v3/passage/text/";

/** Plain text, verse numbers only: no headings, footnotes, references or copyright line. */
const PARAMS = {
  "include-passage-references": "false",
  "include-verse-numbers": "true",
  "include-first-verse-numbers": "true",
  "include-footnotes": "false",
  "include-footnote-body": "false",
  "include-headings": "false",
  "include-short-copyright": "false",
  "include-copyright": "false",
  "include-selahs": "true",
  "indent-poetry": "false",
  "indent-paragraphs": "0",
  "line-length": "0",
} as const;

// Held in memory only (never written to disk or the database), briefly, and never more than the
// chapters inside the permitted scope. Revisit with Crossway's written terms before widening.
const CACHE_TTL_MS = 60 * 60 * 1000;
const CACHE_MAX_CHAPTERS = 10;

export type EsvOptions = {
  apiKey: string;
  fetchImpl?: typeof fetch;
  now?: () => number;
};

/** The ESV through Crossway's API, server-side only, limited to the permitted scope (John 1–2). */
export class EsvProvider implements ScriptureProvider {
  readonly translation = "ESV" as const;
  private readonly fetchImpl: typeof fetch;
  private readonly cache: TtlCache<Verse[]>;

  constructor(private readonly options: EsvOptions) {
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.cache = new TtlCache(CACHE_TTL_MS, CACHE_MAX_CHAPTERS, options.now);
  }

  async getChapter(bookSlug: string, chapter: number): Promise<Verse[]> {
    const book = bookBySlug(bookSlug);
    if (!book || !Number.isInteger(chapter) || chapter < 1 || chapter > book.chapterCount) {
      throw new ScriptureUnavailableError(`There is no ${bookSlug} ${chapter}.`, "not-found");
    }
    // Checked before anything is fetched, so out-of-scope text never leaves Crossway's server.
    if (!isWithinEsvScope(chapterPassage(book.slug, chapter))) {
      throw new ScriptureUnavailableError(
        "The ESV is not available for this passage yet.",
        "out-of-scope",
      );
    }

    const key = `${book.slug}:${chapter}`;
    const cached = this.cache.get(key);
    if (cached) return cached;

    const url = new URL(ENDPOINT);
    url.searchParams.set("q", `${book.name} ${chapter}`);
    for (const [name, value] of Object.entries(PARAMS)) url.searchParams.set(name, value);

    let response: Response;
    try {
      response = await this.fetchImpl(url, {
        headers: { Authorization: `Token ${this.options.apiKey}` },
        cache: "no-store",
      });
    } catch {
      throw new ScriptureUnavailableError("The ESV service could not be reached.", "source-error");
    }
    if (!response.ok) {
      // The status is useful; the key and the body are never echoed.
      throw new ScriptureUnavailableError(
        `The ESV service answered ${response.status}.`,
        "source-error",
      );
    }
    const body = (await response.json()) as { passages?: string[] };
    const verses = parseEsvText(chapter, body.passages?.[0] ?? "");
    if (verses.length === 0) {
      throw new ScriptureUnavailableError("The ESV service returned no text.", "source-error");
    }
    this.cache.set(key, verses);
    return verses;
  }

  getPassage(ref: PassageRef): Promise<PassageVerse[]> {
    return passageFromChapters(ref, (b, c) => this.getChapter(b, c));
  }

  async verseCount(book: string, chapter: number): Promise<number> {
    const verses = await this.getChapter(book, chapter);
    return verses[verses.length - 1]?.verse ?? 0;
  }
}
