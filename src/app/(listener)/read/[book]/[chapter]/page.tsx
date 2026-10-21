import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ChapterNav } from "@/client/components/reader/chapter-nav";
import { ContinuousChapters } from "@/client/components/reader/continuous-chapters";
import { RecentTracker } from "@/client/components/recent/recent-tracker";
import { ReaderPlayer } from "@/client/components/reader/reader-player";
import { ReaderSelectionProvider } from "@/client/components/reader/reader-selection";
import { MemorizeBar, SelectionPanel } from "@/client/components/reader/selection-panel";
import { Main, RightPanel } from "@/client/components/shell/regions";
import { chaptersWithMusic } from "@/server/library";
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
  const [loaded, musicChapters] = await Promise.all([
    loadReaderChapter(book.slug, chapter, preferred).catch((error) => {
      if (error instanceof ScriptureUnavailableError) notFound();
      throw error;
    }),
    chaptersWithMusic(book.slug),
  ]);
  const lastVerse = loaded.verses[loaded.verses.length - 1]?.verse ?? 1;

  return (
    <ReaderSelectionProvider
      // A new chapter, or a switch of translation, starts the reader afresh (chapters scrolled on to
      // were loaded in the old one).
      key={`${book.slug}-${chapter}-${preferred}-${loaded.translation}`}
      book={book.slug}
      chapter={chapter}
      lastVerse={lastVerse}
    >
      <RecentTracker book={book.slug} chapter={chapter} />
      <ReaderPlayer />
      <Main player>
        <div className="mx-auto w-full max-w-[720px]">
          <header className="mb-2 flex items-start justify-between gap-4">
            <h1 className="font-serif text-[34px] font-medium tracking-[.02em] text-heading max-[520px]:sr-only">
              {book.name} {chapter}
            </h1>
            <ChapterNav book={book.slug} chapter={chapter} />
          </header>
          <ContinuousChapters
            book={book.slug}
            bookName={book.name}
            chapterCount={book.chapterCount}
            initial={{ chapter, ...loaded }}
          />
          <MemorizeBar />
        </div>
      </Main>
      <RightPanel label="Memorize">
        <SelectionPanel musicChapters={musicChapters} />
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
