import { Suspense } from "react";
import { RangePicker } from "@/client/components/range/range-picker";
import { Main, PageTitle } from "@/client/components/shell/regions";
import { booksWithMusic } from "@/server/library";
import { bookVerseCounts } from "@/server/scripture";
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
  const endBook = parsed.endBook ?? parsed.book;
  const slugs = [...new Set([parsed.book, endBook])];
  const [countList, music] = await Promise.all([
    Promise.all(slugs.map((slug) => bookVerseCounts(slug))),
    booksWithMusic(),
  ]);
  const counts = Object.fromEntries(slugs.map((slug, i) => [slug, countList[i]]));

  // A reference to a verse that doesn't exist (e.g. John 1:99) is clamped to the chapter's end.
  const clamp = (slug: string, c: number, v: number) => ({
    chapter: c,
    verse: Math.max(1, Math.min(v, counts[slug][c - 1] ?? 1)),
  });
  const initial: PassageRef = {
    book: parsed.book,
    start: clamp(parsed.book, parsed.start.chapter, parsed.start.verse),
    end: clamp(endBook, parsed.end.chapter, parsed.end.verse),
    ...(parsed.endBook && { endBook: parsed.endBook }),
  };

  return <RangePicker initial={initial} initialCounts={counts} musicBooks={[...music]} />;
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
