import "server-only";
import { bookBySlug } from "@/shared/scripture/books";
import type { PlayableRecording } from "@/shared/audio/playlist";
import type { PassageRef } from "@/shared/scripture/types";
import type { PrismaClient } from "@/server/db/generated/client";

export type PlayableGenre = { slug: string; name: string };

export type PlayableSet = {
  recordings: PlayableRecording[];
  /** Genres that have at least one recording touching the passage, in a steady order. */
  genres: PlayableGenre[];
};

/**
 * Published recordings (with their published timing) that touch a passage's chapters.
 * Drafts, and recordings whose timing was never published, are invisible to listeners.
 */
export function createPlayback(client: Pick<PrismaClient, "recording">) {
  return {
    async playableFor(passage: PassageRef): Promise<PlayableSet> {
      const book = bookBySlug(passage.book);
      if (!book) return { recordings: [], genres: [] };

      const rows = await client.recording.findMany({
        where: {
          status: "PUBLISHED",
          publishedTimingId: { not: null },
          bookId: book.id,
          chapter: { lte: passage.end.chapter },
          endChapter: { gte: passage.start.chapter },
        },
        orderBy: [{ arrangementNo: "asc" }, { createdAt: "asc" }],
        select: {
          id: true,
          arrangementNo: true,
          genre: { select: { slug: true, name: true } },
          originalAsset: { select: { id: true, durationMs: true } },
          publishedTiming: {
            select: {
              verses: { select: { chapter: true, verse: true, startMs: true, endMs: true } },
            },
          },
        },
      });

      const recordings: PlayableRecording[] = rows.map((r) => ({
        id: r.id,
        assetId: r.originalAsset.id,
        genreSlug: r.genre.slug,
        arrangementNo: r.arrangementNo,
        durationMs: r.originalAsset.durationMs,
        verses: r.publishedTiming?.verses ?? [],
      }));

      const genres = new Map<string, PlayableGenre>();
      for (const r of rows) genres.set(r.genre.slug, r.genre);
      return {
        recordings,
        genres: [...genres.values()].sort((a, b) => a.name.localeCompare(b.name)),
      };
    },
  };
}
