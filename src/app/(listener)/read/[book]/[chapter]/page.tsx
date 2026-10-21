import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Attribution } from "@/client/components/scripture/attribution";
import { ChapterNav } from "@/client/components/reader/chapter-nav";
import { ChapterText } from "@/client/components/reader/chapter-text";
import { ReaderSelectionProvider } from "@/client/components/reader/reader-selection";
import { MemorizeBar, SelectionPanel } from "@/client/components/reader/selection-panel";
import { Main, RightPanel } from "@/client/components/shell/regions";
import { chapterHasMusic } from "@/server/library";
import { getPreferredTranslation } from "@/server/scripture/preference";
import { loadReaderChapter } from "@/server/scripture/reader";
import { ScriptureUnavailableError } from "@/server/scripture/types";
import { bookBySlug } from "@/shared/scripture/books";

type Params = PageProps<"/read/[book]/[chapter]">["params"];

async function Reader({ params }: { params: Params }) {
  const { book: slug, chapter: rawChapter } = await params;
  const book = bookBySlug(decodeURIComponent(slug));
  const chapter = /^\d+$/.test(rawChapter) ? Number(rawChapter) : NaN;
  if (!book || !(chapter >= 1 && chapter <= book.chapterCount)) notFound();

  const preferred = await getPreferredTranslation();
  const [loaded, hasMusic] = await Promise.all([
    loadReaderChapter(book.slug, chapter, preferred).catch((error) => {
      if (error instanceof ScriptureUnavailableError) notFound();
      throw error;
    }),
    chapterHasMusic(book.slug, chapter),
  ]);
  const lastVerse = loaded.verses[loaded.verses.length - 1]?.verse ?? 1;

  return (
    <ReaderSelectionProvider book={book.slug} chapter={chapter} lastVerse={lastVerse}>
      <Main player>
        <div className="mx-auto w-full max-w-[720px]">
          <header className="mb-2 flex items-start justify-between gap-4">
            <h1 className="font-serif text-[34px] font-medium tracking-[.02em] text-heading max-[520px]:sr-only">
              {book.name} {chapter}
            </h1>
            <ChapterNav book={book.slug} chapter={chapter} />
          </header>
          {loaded.note && (
            <p className="mt-2 font-serif text-[15px] text-muted italic" role="note">
              {loaded.note}
            </p>
          )}
          <ChapterText verses={loaded.verses} />
          <MemorizeBar />
          <Attribution translation={loaded.translation} className="mt-6" />
        </div>
      </Main>
      <RightPanel label="Memorize">
        <SelectionPanel music={{ available: hasMusic }} />
      </RightPanel>
    </ReaderSelectionProvider>
  );
}

export default function ReaderPage({ params }: PageProps<"/read/[book]/[chapter]">) {
  return (
    <Suspense
      fallback={
        <Main player>
          <p className="text-muted">Loading…</p>
        </Main>
      }
    >
      <Reader params={params} />
    </Suspense>
  );
}
