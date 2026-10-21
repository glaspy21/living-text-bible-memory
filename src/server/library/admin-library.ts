import "server-only";
import {
  attentionFor,
  statusesFor,
  timingProgress,
  type LibraryFilter,
  type RecordingStatus,
  type LibraryRow,
} from "@/shared/library/admin-library";
import { formatReference } from "@/shared/scripture/refs";
import type { PrismaClient } from "@/server/db/generated/client";

export type { LibraryRow };

export type DashboardSummary = {
  counts: Record<RecordingStatus, number>;
  total: number;
  /** Distinct passages (translation, book and verses) with at least one published recording. */
  passagesWithMusic: number;
  needsAttention: LibraryRow[];
  recent: LibraryRow[];
};

/** Reads for the admin library and dashboard. Nothing here changes data. */
export function createAdminLibrary(client: Pick<PrismaClient, "recording">) {
  async function rows(statuses: RecordingStatus[] | null): Promise<LibraryRow[]> {
    const found = await client.recording.findMany({
      where: statuses ? { status: { in: statuses } } : undefined,
      orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
      include: {
        book: { select: { slug: true, name: true } },
        genre: { select: { name: true } },
        translation: { select: { code: true } },
        originalAsset: { select: { durationMs: true } },
        timingSets: {
          where: { state: { in: ["DRAFT", "PUBLISHED"] } },
          orderBy: { version: "desc" },
          select: {
            id: true,
            state: true,
            verses: { select: { startMs: true, endMs: true } },
          },
        },
      },
    });

    return found.map((r) => {
      const draft = r.timingSets.find((t) => t.state === "DRAFT");
      const published = r.timingSets.find((t) => t.id === r.publishedTimingId);
      const hasPendingDraft = r.status === "PUBLISHED" && !!draft;
      const working = draft ?? published;
      const progress = timingProgress(working?.verses ?? []);
      return {
        id: r.id,
        reference: formatReference({
          book: r.book.slug,
          start: { chapter: r.chapter, verse: r.verseStart },
          end: { chapter: r.endChapter, verse: r.verseEnd },
        }),
        bookSlug: r.book.slug,
        bookName: r.book.name,
        chapter: r.chapter,
        verseStart: r.verseStart,
        endChapter: r.endChapter,
        verseEnd: r.verseEnd,
        genreName: r.genre.name,
        title: r.title,
        arrangementNo: r.arrangementNo,
        translation: r.translation.code,
        status: r.status,
        durationMs: r.originalAsset.durationMs,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
        progress,
        hasPendingDraft,
        attention: attentionFor({ status: r.status, hasPendingDraft, progress }),
      };
    });
  }

  return {
    list: (filter: LibraryFilter) => rows(statusesFor(filter)),

    async dashboard(): Promise<DashboardSummary> {
      const all = await rows(null);
      const counts: Record<RecordingStatus, number> = { DRAFT: 0, READY: 0, PUBLISHED: 0 };
      for (const r of all) counts[r.status] += 1;
      return {
        counts,
        total: all.length,
        passagesWithMusic: new Set(
          all
            .filter((r) => r.status === "PUBLISHED")
            .map(
              (r) =>
                `${r.translation}|${r.bookSlug}|${r.chapter}:${r.verseStart}-${r.endChapter}:${r.verseEnd}`,
            ),
        ).size,
        needsAttention: all.filter((r) => r.attention !== null),
        recent: all.slice(0, 5),
      };
    },
  };
}
