"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { Attribution } from "@/client/components/scripture/attribution";
import { recordRecent } from "@/client/lib/recent-store";
import { adjacentChapter } from "@/shared/scripture/books";
import { CHAPTER_VIEW_EVENT } from "@/client/lib/chapter-view";
import type { TranslationCode, Verse } from "@/shared/scripture/types";
import { ChapterText } from "./chapter-text";
import { useReaderSelection } from "./reader-selection";

export type LoadedChapter = {
  chapter: number;
  translation: TranslationCode;
  note: string | null;
  verses: Verse[];
};

const lastVerseOf = (c: LoadedChapter) => c.verses[c.verses.length - 1]?.verse ?? 1;

/**
 * The chapter, then the next one as you keep scrolling (within the book). The chapter in view
 * drives the address bar, the header, "recently studied" and what Memorize uses when nothing is
 * selected. At the end of the book it offers the next book instead.
 */
export function ContinuousChapters({
  book,
  bookName,
  chapterCount,
  initial,
}: {
  book: string;
  bookName: string;
  chapterCount: number;
  initial: LoadedChapter;
}) {
  const { setCurrent } = useReaderSelection();
  const [chapters, setChapters] = useState<LoadedChapter[]>([initial]);
  const [failed, setFailed] = useState(false);
  const [inView, setInView] = useState(initial.chapter);
  const loading = useRef(false);
  const sentinel = useRef<HTMLDivElement>(null);
  const sections = useRef(new Map<number, HTMLElement>());

  const last = chapters[chapters.length - 1].chapter;
  const hasMore = last < chapterCount;

  const loadNext = useCallback(async () => {
    if (loading.current) return;
    loading.current = true;
    try {
      const response = await fetch(`/api/scripture/chapter?book=${book}&chapter=${last + 1}`);
      if (!response.ok) throw new Error("not ok");
      const body = (await response.json()) as Omit<LoadedChapter, "chapter">;
      setChapters((all) =>
        all.some((c) => c.chapter === last + 1) ? all : [...all, { chapter: last + 1, ...body }],
      );
      setFailed(false);
    } catch {
      setFailed(true);
    } finally {
      loading.current = false;
    }
  }, [book, last]);

  // Load the next chapter shortly before the end is reached. A fresh observer after each
  // addition also covers short chapters that leave the end still in sight.
  useEffect(() => {
    const end = sentinel.current;
    if (!end || !hasMore || failed) return;
    const observer = new IntersectionObserver(
      (entries) => entries.some((e) => e.isIntersecting) && void loadNext(),
      { rootMargin: "0px 0px 400px 0px" },
    );
    observer.observe(end);
    return () => observer.disconnect();
  }, [hasMore, failed, loadNext, chapters.length]);

  // The chapter crossing a thin band near the top of the screen is the one being read. It only
  // counts once the reader has scrolled, so a short chapter followed by the next one on screen
  // doesn't move the address bar before anyone has moved.
  const crossing = useRef(new Set<number>());
  const scrolled = useRef(false);
  useEffect(() => {
    const update = () => {
      if (scrolled.current && crossing.current.size > 0) setInView(Math.max(...crossing.current));
    };
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const chapter = Number((entry.target as HTMLElement).dataset.chapter);
          if (entry.isIntersecting) crossing.current.add(chapter);
          else crossing.current.delete(chapter);
        }
        update();
      },
      { rootMargin: "-35% 0px -60% 0px" },
    );
    sections.current.forEach((element) => observer.observe(element));
    // Scroll events don't bubble, so listen in the capture phase for the page's own scroller.
    const onScroll = () => {
      if (scrolled.current) return;
      scrolled.current = true;
      update();
    };
    document.addEventListener("scroll", onScroll, { capture: true, passive: true });
    return () => {
      observer.disconnect();
      document.removeEventListener("scroll", onScroll, { capture: true });
    };
  }, [chapters.length]);

  // Follow the chapter in view: address bar, header, recents and the whole-chapter default.
  const applied = useRef(initial.chapter);
  useEffect(() => {
    if (inView === applied.current) return;
    const shown = chapters.find((c) => c.chapter === inView);
    if (!shown) return;
    applied.current = inView;
    setCurrent(shown.chapter, lastVerseOf(shown));
    // The router doesn't notice the address bar being rewritten, so tell the header directly.
    window.dispatchEvent(
      new CustomEvent(CHAPTER_VIEW_EVENT, {
        detail: { base: `/read/${book}/${initial.chapter}`, book, chapter: shown.chapter },
      }),
    );
    const url = new URL(window.location.href);
    if (url.pathname !== `/read/${book}/${shown.chapter}`) {
      url.pathname = `/read/${book}/${shown.chapter}`;
      // A verse chosen in the header menu belongs to the chapter that was opened.
      if (shown.chapter !== initial.chapter) url.searchParams.delete("v");
      window.history.replaceState(window.history.state, "", url);
    }
    // The opened chapter is recorded by the page itself; the ones scrolled on to are recorded here.
    if (shown.chapter !== initial.chapter) recordRecent(book, shown.chapter);
  }, [inView, chapters, initial.chapter, book, setCurrent]);

  const translations = [...new Set(chapters.map((c) => c.translation))];
  const nextBook = !hasMore ? adjacentChapter(book, last, 1) : null;

  return (
    <>
      {chapters.map((loaded, index) => (
        <section
          key={loaded.chapter}
          data-chapter={loaded.chapter}
          ref={(element) => {
            if (element) sections.current.set(loaded.chapter, element);
            else sections.current.delete(loaded.chapter);
          }}
        >
          {index > 0 && (
            <h2
              className="mt-10 font-serif text-[30px] font-medium tracking-[.02em] text-heading max-[520px]:text-2xl"
              data-testid="chapter-heading"
            >
              {bookName} {loaded.chapter}
            </h2>
          )}
          {loaded.note && (
            <p className="mt-2 font-serif text-[15px] text-muted italic" role="note">
              {loaded.note}
            </p>
          )}
          <ChapterText verses={loaded.verses} arrive={index === 0} />
        </section>
      ))}
      <div ref={sentinel} aria-hidden="true" />
      {hasMore && !failed && (
        <p className="mt-6 text-center text-xs text-muted" data-testid="more-loading">
          Loading {bookName} {last + 1}…
        </p>
      )}
      {failed && (
        <p className="mt-6 text-center text-muted" role="alert">
          The next chapter could not be loaded.{" "}
          <button type="button" className="text-gold underline" onClick={() => setFailed(false)}>
            Try again
          </button>
        </p>
      )}
      {nextBook && nextBook.book.slug !== book && (
        <Link
          href={`/read/${nextBook.book.slug}/${nextBook.chapter}`}
          className="wipe mt-8 flex w-full items-center justify-center rounded-[9px] border border-line p-[13px] font-serif text-[19px] text-gold2"
        >
          Continue to {nextBook.book.name} {nextBook.chapter} ›
        </Link>
      )}
      <div className="mt-6 space-y-2">
        {translations.map((t) => (
          <Attribution key={t} translation={t} />
        ))}
      </div>
    </>
  );
}
