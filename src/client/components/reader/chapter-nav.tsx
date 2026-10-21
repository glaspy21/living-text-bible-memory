import Link from "next/link";
import { adjacentChapter } from "@/shared/scripture/books";
import { cn } from "@/client/lib/cn";

const triangle =
  "inline-flex h-9 w-9 items-center justify-center rounded-md text-heading transition-colors hover:bg-[rgba(201,164,92,.08)]";

function Triangle({ direction }: { direction: "left" | "right" }) {
  return (
    <svg width="14" height="16" viewBox="0 0 14 16" aria-hidden="true" fill="currentColor">
      <path d={direction === "left" ? "M12 1.5v13L2 8z" : "M2 1.5v13L12 8z"} />
    </svg>
  );
}

/**
 * Left and right triangles, in the chapter title's colour, to step one chapter back or on. They
 * cross book boundaries and are left out at either end of the Bible.
 */
export function ChapterNav({ book, chapter }: { book: string; chapter: number }) {
  const prev = adjacentChapter(book, chapter, -1);
  const next = adjacentChapter(book, chapter, 1);
  const href = (c: NonNullable<typeof prev>) => `/read/${c.book.slug}/${c.chapter}`;
  return (
    <nav className="flex items-center gap-1" aria-label="Chapters">
      {prev ? (
        <Link href={href(prev)} className={triangle} rel="prev" aria-label="Previous chapter">
          <Triangle direction="left" />
        </Link>
      ) : (
        <span className={cn(triangle, "pointer-events-none opacity-30")} aria-hidden="true">
          <Triangle direction="left" />
        </span>
      )}
      {next ? (
        <Link href={href(next)} className={triangle} rel="next" aria-label="Next chapter">
          <Triangle direction="right" />
        </Link>
      ) : (
        <span className={cn(triangle, "pointer-events-none opacity-30")} aria-hidden="true">
          <Triangle direction="right" />
        </span>
      )}
    </nav>
  );
}
