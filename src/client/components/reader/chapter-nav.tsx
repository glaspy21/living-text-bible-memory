import Link from "next/link";
import { adjacentChapter } from "@/shared/scripture/books";
import { cn } from "@/client/lib/cn";

const link =
  "wipe inline-flex items-center rounded-[7px] border border-line px-3 py-[5px] text-xs text-muted";

/** ‹ Prev / Next › for the reader. Crosses book boundaries; disabled at either end of the Bible. */
export function ChapterNav({ book, chapter }: { book: string; chapter: number }) {
  const prev = adjacentChapter(book, chapter, -1);
  const next = adjacentChapter(book, chapter, 1);
  const href = (c: NonNullable<typeof prev>) => `/read/${c.book.slug}/${c.chapter}`;
  return (
    <nav className="flex items-center gap-3" aria-label="Chapters">
      {prev ? (
        <Link href={href(prev)} className={link} rel="prev">
          ‹ Prev
        </Link>
      ) : (
        <span className={cn(link, "pointer-events-none opacity-40")} aria-disabled="true">
          ‹ Prev
        </span>
      )}
      {next ? (
        <Link href={href(next)} className={link} rel="next">
          Next ›
        </Link>
      ) : (
        <span className={cn(link, "pointer-events-none opacity-40")} aria-disabled="true">
          Next ›
        </span>
      )}
    </nav>
  );
}
