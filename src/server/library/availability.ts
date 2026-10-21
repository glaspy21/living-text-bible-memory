import "server-only";
import { bookBySlug } from "@/shared/scripture/books";
import type { PrismaClient } from "@/server/db/generated/client";

/** Which passages have published music. Only PUBLISHED recordings count; drafts never show to listeners. */
export function createAvailability(client: Pick<PrismaClient, "recording">) {
  return {
    /** Slugs of the books that have at least one published recording (the dot in the book selector). */
    async booksWithMusic(): Promise<Set<string>> {
      const rows = await client.recording.findMany({
        where: { status: "PUBLISHED" },
        distinct: ["bookId"],
        select: { book: { select: { slug: true } } },
      });
      return new Set(rows.map((r) => r.book.slug));
    },

    /** The chapters of a book that a published recording covers, in order (for the reader's music note). */
    async chaptersWithMusic(bookSlug: string): Promise<number[]> {
      const book = bookBySlug(bookSlug);
      if (!book) return [];
      const rows = await client.recording.findMany({
        where: { status: "PUBLISHED", bookId: book.id },
        select: { chapter: true, endChapter: true },
      });
      const chapters = new Set<number>();
      for (const r of rows)
        for (let c = r.chapter; c <= Math.min(r.endChapter, book.chapterCount); c++)
          chapters.add(c);
      return [...chapters].sort((a, b) => a - b);
    },

    /** Every book's chapters with published music, for the reader that scrolls from book to book. */
    async chaptersWithMusicByBook(): Promise<Record<string, number[]>> {
      const rows = await client.recording.findMany({
        where: { status: "PUBLISHED" },
        select: { chapter: true, endChapter: true, book: { select: { slug: true } } },
      });
      const byBook = new Map<string, Set<number>>();
      for (const r of rows) {
        const book = bookBySlug(r.book.slug);
        if (!book) continue;
        const set = byBook.get(book.slug) ?? new Set<number>();
        for (let c = r.chapter; c <= Math.min(r.endChapter, book.chapterCount); c++) set.add(c);
        byBook.set(book.slug, set);
      }
      return Object.fromEntries(
        [...byBook].map(([slug, set]) => [slug, [...set].sort((a, b) => a - b)]),
      );
    },

    /** True when a published recording covers any part of the chapter (recordings may span chapters). */
    async chapterHasMusic(bookSlug: string, chapter: number): Promise<boolean> {
      const book = bookBySlug(bookSlug);
      if (!book) return false;
      const count = await client.recording.count({
        where: {
          status: "PUBLISHED",
          bookId: book.id,
          chapter: { lte: chapter },
          endChapter: { gte: chapter },
        },
      });
      return count > 0;
    },
  };
}
