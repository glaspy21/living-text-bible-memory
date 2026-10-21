import "server-only";
import { bookBySlug } from "@/shared/scripture/books";
import type { PassageRef, PassageVerse, Verse } from "@/shared/scripture/types";
import { passageFromChapters } from "./passage";
import { ScriptureUnavailableError, type ScriptureProvider } from "./types";

/** One book as stored: chapters → [verse number, text]. */
type StoredBook = [number, string][][];

/** Loads a book's stored text by slug. Replaceable so tests need no files. */
export type BookLoader = (slug: string) => Promise<StoredBook>;

const loadFromDisk: BookLoader = async (slug) =>
  (await import(`./web-data/${slug}.json`)).default as StoredBook;

/** The World English Bible (public domain), read from the JSON imported by scripts/import-web.ts. */
export class WebProvider implements ScriptureProvider {
  readonly translation = "WEB" as const;
  private readonly books = new Map<string, Promise<StoredBook>>();

  constructor(private readonly load: BookLoader = loadFromDisk) {}

  private book(slug: string): Promise<StoredBook> {
    let loading = this.books.get(slug);
    if (!loading) {
      loading = this.load(slug);
      this.books.set(slug, loading);
    }
    return loading;
  }

  async getChapter(bookSlug: string, chapter: number): Promise<Verse[]> {
    const info = bookBySlug(bookSlug);
    if (!info || !Number.isInteger(chapter) || chapter < 1 || chapter > info.chapterCount) {
      throw new ScriptureUnavailableError(`There is no ${bookSlug} ${chapter}.`, "not-found");
    }
    const stored = (await this.book(info.slug))[chapter - 1];
    return stored.map(([verse, text]) => ({ chapter, verse, text }));
  }

  getPassage(ref: PassageRef): Promise<PassageVerse[]> {
    return passageFromChapters(ref, (b, c) => this.getChapter(b, c));
  }

  async verseCount(book: string, chapter: number): Promise<number> {
    const verses = await this.getChapter(book, chapter);
    return verses[verses.length - 1]?.verse ?? 0;
  }
}
