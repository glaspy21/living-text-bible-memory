/** Pure rules for the admin library and dashboard: filters, labels and "needs attention". */

export type RecordingStatus = "DRAFT" | "READY" | "PUBLISHED";

export const LIBRARY_FILTERS = ["all", "published", "ready", "drafts"] as const;
export type LibraryFilter = (typeof LIBRARY_FILTERS)[number];

export const FILTER_LABELS: Record<LibraryFilter, string> = {
  all: "All",
  published: "Published",
  ready: "Ready for review",
  drafts: "Drafts",
};

/** The filter named in a query string; anything unknown (or missing) shows everything. */
export function parseFilter(raw: string | string[] | undefined): LibraryFilter {
  const value = Array.isArray(raw) ? raw[0] : raw;
  return (LIBRARY_FILTERS as readonly string[]).includes(value ?? "")
    ? (value as LibraryFilter)
    : "all";
}

/** The recording statuses a filter shows, or null for all of them. */
export function statusesFor(filter: LibraryFilter): RecordingStatus[] | null {
  switch (filter) {
    case "published":
      return ["PUBLISHED"];
    case "ready":
      return ["READY"];
    case "drafts":
      return ["DRAFT"];
    default:
      return null;
  }
}

export const STATUS_LABELS: Record<RecordingStatus, string> = {
  DRAFT: "Draft",
  READY: "Ready for review",
  PUBLISHED: "Published",
};

/** "Default", "Default 2", "Default 3": the number is shown only after the first. */
export function arrangementLabel(title: string, arrangementNo: number): string {
  return arrangementNo > 1 ? `${title} ${arrangementNo}` : title;
}

/** How much of a timing sheet is filled in: verses with both a start and an end. */
export type TimingProgress = { timed: number; total: number };

export function timingProgress(
  verses: readonly { startMs: number | null; endMs: number | null }[],
): TimingProgress {
  return {
    total: verses.length,
    timed: verses.filter((v) => v.startMs !== null && v.endMs !== null).length,
  };
}

export type LibraryRow = {
  id: string;
  /** "John 1:1–18", ready to show. */
  reference: string;
  bookSlug: string;
  bookName: string;
  chapter: number;
  verseStart: number;
  endChapter: number;
  verseEnd: number;
  genreName: string;
  title: string;
  arrangementNo: number;
  translation: string;
  status: RecordingStatus;
  durationMs: number;
  createdAt: Date;
  updatedAt: Date;
  /** Progress of the timing sheet being worked on (the pending draft, else the published one). */
  progress: TimingProgress;
  /** Published, with a newer unpublished draft waiting. */
  hasPendingDraft: boolean;
  attention: string | null;
};

export type AttentionInput = {
  status: RecordingStatus;
  /** A newer, unpublished timing draft exists (published recordings only). */
  hasPendingDraft: boolean;
  progress: TimingProgress;
};

/**
 * Why a recording needs the admin's attention, or null when it doesn't. A ready or fully
 * published recording is fine; everything else is waiting on the admin.
 */
export function attentionFor(input: AttentionInput): string | null {
  const { status, hasPendingDraft, progress } = input;
  if (status === "PUBLISHED") {
    return hasPendingDraft ? "New draft waiting to be published" : null;
  }
  if (status === "READY") return null;
  if (progress.total === 0 || progress.timed === 0) return "Verse timing not started";
  if (progress.timed < progress.total) {
    return `${progress.total - progress.timed} of ${progress.total} verses still untimed`;
  }
  return "Timing done — review and mark ready";
}
