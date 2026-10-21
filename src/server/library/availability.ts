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
