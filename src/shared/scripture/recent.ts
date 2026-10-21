import { bookBySlug } from "./books";

/** A chapter the visitor opened, kept on their own device (no account needed). */
export type RecentChapter = { book: string; chapter: number; openedAt: number };

export const MAX_RECENT = 20;

/** Put a chapter at the front. Opening the same chapter again moves it up instead of repeating it. */
export function addRecent(
  list: readonly RecentChapter[],
  entry: RecentChapter,
  max = MAX_RECENT,
): RecentChapter[] {
  const rest = list.filter((r) => !(r.book === entry.book && r.chapter === entry.chapter));
  return [entry, ...rest].slice(0, max);
}

/**
 * Read the stored list. Anything unexpected (corrupt text, edited values, a book that doesn't
 * exist) is dropped rather than trusted, so a bad value can never break a page.
 */
export function parseRecent(raw: string | null | undefined): RecentChapter[] {
  if (!raw) return [];
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(data)) return [];

  const out: RecentChapter[] = [];
  for (const item of data) {
    if (typeof item !== "object" || item === null) continue;
    const { book, chapter, openedAt } = item as Record<string, unknown>;
    const info = typeof book === "string" ? bookBySlug(book) : undefined;
    if (
      !info ||
      typeof chapter !== "number" ||
      !Number.isInteger(chapter) ||
      chapter < 1 ||
      chapter > info.chapterCount ||
      typeof openedAt !== "number" ||
      !Number.isFinite(openedAt)
    ) {
      continue;
    }
    out.push({ book: info.slug, chapter, openedAt });
  }
  return out.slice(0, MAX_RECENT);
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** "Today", "Yesterday", "3 days ago", then a plain date. Day boundaries are the viewer's local midnight. */
export function relativeDay(openedAt: number, now: number): string {
  const startOfDay = (t: number) => {
    const d = new Date(t);
    return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  };
  const days = Math.round((startOfDay(now) - startOfDay(openedAt)) / DAY_MS);
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  return new Date(openedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
