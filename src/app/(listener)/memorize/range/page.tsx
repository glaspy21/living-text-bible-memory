import { Suspense } from "react";
import { RangePicker } from "@/client/components/range/range-picker";
import { Main, PageTitle } from "@/client/components/shell/regions";
import { booksWithMusic } from "@/server/library";
import { bookVerseCounts } from "@/server/scripture";
import { bookBySlug } from "@/shared/scripture/books";
import { parsePassageParam } from "@/shared/scripture/passage-param";
import type { PassageRef } from "@/shared/scripture/types";

/** Where the selector starts when it is opened without a passage. */
const DEFAULT_PASSAGE: PassageRef = {
  book: "john",
  start: { chapter: 1, verse: 1 },
  end: { chapter: 1, verse: 1 },
};

async function Range({
  searchParams,
}: {
  searchParams: PageProps<"/memorize/range">["searchParams"];
}) {
  const { p } = await searchParams;
  const param = Array.isArray(p) ? p[0] : p;
  const parsed = parsePassageParam(param) ?? DEFAULT_PASSAGE;
  const book = bookBySlug(parsed.book)!;
  const [counts, music] = await Promise.all([bookVerseCounts(book.slug), booksWithMusic()]);

  // A reference to a verse that doesn't exist in this book (e.g. John 1:99) is clamped to the chapter's end.
  const clamp = (c: number, v: number) => ({
    chapter: c,
    verse: Math.max(1, Math.min(v, counts[c - 1] ?? 1)),
  });
  const initial: PassageRef = {
    book: book.slug,
    start: clamp(parsed.start.chapter, parsed.start.verse),
    end: clamp(parsed.end.chapter, parsed.end.verse),
  };

  return (
    <RangePicker
      key={book.slug}
      book={{ slug: book.slug, name: book.name, chapterCount: book.chapterCount }}
      counts={counts}
      initial={initial}
      musicBooks={[...music]}
    />
  );
}

export default function VerseRangePage({ searchParams }: PageProps<"/memorize/range">) {
  return (
    <Main>
      <div className="mx-auto w-full max-w-[720px]">
        <PageTitle title="Choose verses" />
        <Suspense fallback={<p className="text-muted">Loading…</p>}>
          <Range searchParams={searchParams} />
        </Suspense>
      </div>
    </Main>
  );
}
