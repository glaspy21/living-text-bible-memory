import { Suspense } from "react";
import { RangePicker } from "@/client/components/range/range-picker";
import { Main, PageTitle } from "@/client/components/shell/regions";
import { booksWithMusic } from "@/server/library";
import { bookVerseCounts } from "@/server/scripture";
import { parseStep } from "@/shared/memorize/steps";
import { formatPassageParam, parsePassageParam } from "@/shared/scripture/passage-param";
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
  const { p, from, step } = await searchParams;
  const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
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

  // Opened from the reader, Steps or Flashcards: "Select Range" goes back to that screen (and step).
  const from_ = first(from);
  const screen: "steps" | "flashcards" | "read" | undefined =
    from_ === "steps" || from_ === "flashcards" || from_ === "read" ? from_ : undefined;
  const returnTo = screen
    ? { screen, ...(screen === "steps" && first(step) && { step: parseStep(first(step)) }) }
    : undefined;

  return (
    <RangePicker
      // A new passage (or screen to return to) starts the picker afresh: Next keeps a page's state
      // when it is visited again with other parameters, which would show the previous range.
      key={`${formatPassageParam(initial)}|${screen ?? ""}|${returnTo?.step ?? ""}`}
      initial={initial}
      initialCounts={counts}
      musicBooks={[...music]}
      returnTo={returnTo}
    />
  );
}

export default function VerseRangePage({ searchParams }: PageProps<"/memorize/range">) {
  return (
    <Main>
      <div className="mx-auto flex h-full w-full max-w-[720px] flex-col">
        <div className="shrink-0">
          <PageTitle title="Choose verses" />
        </div>
        <Suspense fallback={<p className="text-muted">Loading…</p>}>
          <Range searchParams={searchParams} />
        </Suspense>
      </div>
    </Main>
  );
}
