"use client";

import {
  Fragment,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Attribution } from "@/client/components/scripture/attribution";
import { recordRecent } from "@/client/lib/recent-store";
import { adjacentChapter, bookBySlug } from "@/shared/scripture/books";
import { CHAPTER_VIEW_EVENT } from "@/client/lib/chapter-view";
import type { TranslationCode, Verse } from "@/shared/scripture/types";
import { ChapterNav } from "./chapter-nav";
import { ChapterText } from "./chapter-text";
import { useReaderSelection } from "./reader-selection";

export type LoadedChapter = {
  book: string;
  chapter: number;
  translation: TranslationCode;
  note: string | null;
  verses: Verse[];
};

type Place = { book: string; chapter: number };

const keyOf = (c: Place) => `${c.book}/${c.chapter}`;
const lastVerseOf = (c: LoadedChapter) => c.verses[c.verses.length - 1]?.verse ?? 1;
const neighbour = (c: Place, step: 1 | -1): Place | null => {
  const next = adjacentChapter(c.book, c.chapter, step);
  return next && { book: next.book.slug, chapter: next.chapter };
};

/**
 * The chapter, then the next ones as you keep scrolling down and the earlier ones as you scroll up,
 * running on from book to book in the order of a modern Bible (Genesis 1 to Revelation 22). The
 * chapter in view drives the address bar, the header, "recently studied" and what Memorize uses
 * when nothing is selected.
 */
export function ContinuousChapters({
  initial,
  header,
}: {
  initial: LoadedChapter;
  /** The opened chapter's title row; it stays with that chapter when earlier ones load above it. */
  header: ReactNode;
}) {
  const { setCurrent } = useReaderSelection();
  const [chapters, setChapters] = useState<LoadedChapter[]>([initial]);
  const [failed, setFailed] = useState(false);
  const [failedPrev, setFailedPrev] = useState(false);
  // Earlier chapters are brought in only once the reader goes upward, so opening a chapter shows
  // it at the top, as before, and scrolling down to a verse is not disturbed by content above.
  const [wantsUp, setWantsUp] = useState(false);
  const [inView, setInView] = useState<Place>(initial);
  const loading = useRef(false);
  const loadingPrev = useRef(false);
  const sentinel = useRef<HTMLDivElement>(null);
  const topSentinel = useRef<HTMLDivElement>(null);
  const sections = useRef(new Map<string, HTMLElement>());
  // Where the first section sat before earlier chapters were added above it, so the page can be
  // moved by exactly that much and nothing appears to jump.
  const anchor = useRef<{ key: string; top: number } | null>(null);
  // Scrolling we did ourselves must not count as the reader having started to read.
  const ownScroll = useRef(false);

  const firstChapter = chapters[0];
  const lastChapter = chapters[chapters.length - 1];
  const after = neighbour(lastChapter, 1);
  const before = neighbour(firstChapter, -1);
  const afterKey = after && keyOf(after);
  const beforeKey = before && keyOf(before);

  const fetchChapter = useCallback(async (place: Place): Promise<LoadedChapter> => {
    const response = await fetch(
      `/api/scripture/chapter?book=${place.book}&chapter=${place.chapter}`,
    );
    if (!response.ok) throw new Error("not ok");
    return { ...place, ...((await response.json()) as Omit<LoadedChapter, "book" | "chapter">) };
  }, []);

  const loadNext = useCallback(async () => {
    if (loading.current || !after) return;
    loading.current = true;
    try {
      const loaded = await fetchChapter(after);
      setChapters((all) => (all.some((c) => keyOf(c) === keyOf(loaded)) ? all : [...all, loaded]));
      setFailed(false);
    } catch {
      setFailed(true);
    } finally {
      loading.current = false;
    }
  }, [after, fetchChapter]);

  const loadPrev = useCallback(async () => {
    if (loadingPrev.current || !before) return;
    loadingPrev.current = true;
    try {
      const loaded = await fetchChapter(before);
      const key = keyOf(firstChapter);
      const top = sections.current.get(key)?.getBoundingClientRect().top;
      if (top !== undefined) anchor.current = { key, top };
      setChapters((all) => (all.some((c) => keyOf(c) === keyOf(loaded)) ? all : [loaded, ...all]));
      setFailedPrev(false);
    } catch {
      setFailedPrev(true);
    } finally {
      loadingPrev.current = false;
    }
  }, [before, firstChapter, fetchChapter]);

  // Keep what the reader is looking at where it was when a chapter is added above it.
  useLayoutEffect(() => {
    const held = anchor.current;
    anchor.current = null;
    if (!held) return;
    const section = sections.current.get(held.key);
    const scroller = section?.closest("main");
    if (!section || !scroller) return;
    const shift = section.getBoundingClientRect().top - held.top;
    if (shift === 0) return;
    const scrollTop = scroller.scrollTop;
    scroller.scrollTop += shift;
    // The scroll event for this move is ours; the next one is the reader's.
    ownScroll.current = scroller.scrollTop !== scrollTop;
  }, [beforeKey]);

  // Load the previous chapter shortly before the top is reached.
  useEffect(() => {
    const top = topSentinel.current;
    if (!top || !beforeKey || failedPrev || !wantsUp) return;
    const observer = new IntersectionObserver(
      (entries) => entries.some((e) => e.isIntersecting) && void loadPrev(),
      { rootMargin: "400px 0px 0px 0px" },
    );
    observer.observe(top);
    return () => observer.disconnect();
  }, [beforeKey, failedPrev, wantsUp, loadPrev, chapters.length]);

  // Load the next chapter shortly before the end is reached. A fresh observer after each
  // addition also covers short chapters that leave the end still in sight.
  useEffect(() => {
    const end = sentinel.current;
    if (!end || !afterKey || failed) return;
    const observer = new IntersectionObserver(
      (entries) => entries.some((e) => e.isIntersecting) && void loadNext(),
      { rootMargin: "0px 0px 400px 0px" },
    );
    observer.observe(end);
    return () => observer.disconnect();
  }, [afterKey, failed, loadNext, chapters.length]);

  // The chapter of the verse at the top of the screen is the one being read: the first verse with
  // any part still in view. The heading holds until that verse has scrolled completely out, and
  // changes the moment a verse of the earlier chapter appears above it. It only counts once the reader has scrolled, so a short chapter followed by
  // the next one on screen doesn't move the address bar before anyone has moved.
  const scrolled = useRef(false);
  useEffect(() => {
    const update = () => {
      if (!scrolled.current) return;
      const scroller = [...sections.current.values()][0]?.closest("main");
      if (!scroller) return;
      const edge = scroller.getBoundingClientRect().top;
      // In page order: chapters added above are kept after the others in the map.
      for (const section of scroller.querySelectorAll<HTMLElement>("section[data-chapter]")) {
        if (section.getBoundingClientRect().bottom <= edge) continue;
        const first = [...section.querySelectorAll<HTMLElement>("[data-verse]")].find(
          (row) => row.getBoundingClientRect().bottom > edge,
        );
        if (!first) continue;
        const place = { book: section.dataset.book!, chapter: Number(section.dataset.chapter) };
        setInView((now) => (keyOf(now) === keyOf(place) ? now : place));
        return;
      }
    };
    let frame = 0;
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(update);
    };
    // Scroll events don't bubble, so listen in the capture phase for the page's own scroller.
    let lastTop = 0;
    const onScroll = (event: Event) => {
      const top = (event.target as HTMLElement).scrollTop ?? 0;
      const wentUp = top < lastTop;
      lastTop = top;
      if (ownScroll.current) {
        ownScroll.current = false;
        schedule();
        return;
      }
      if (wentUp) setWantsUp(true);
      scrolled.current = true;
      schedule();
    };
    // Trying to go up from the very top produces no scroll, so these count as going up too.
    const onWheel = (event: WheelEvent) => event.deltaY < 0 && setWantsUp(true);
    const onTouch = () => setWantsUp(true);
    const onKey = (event: KeyboardEvent) =>
      ["ArrowUp", "PageUp", "Home"].includes(event.key) && setWantsUp(true);
    document.addEventListener("scroll", onScroll, { capture: true, passive: true });
    document.addEventListener("wheel", onWheel, { passive: true });
    document.addEventListener("touchmove", onTouch, { passive: true });
    document.addEventListener("keydown", onKey);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("scroll", onScroll, { capture: true });
      document.removeEventListener("wheel", onWheel);
      document.removeEventListener("touchmove", onTouch);
      document.removeEventListener("keydown", onKey);
    };
  }, [chapters.length]);

  // Follow the chapter in view: address bar, header, recents and the whole-chapter default.
  const applied = useRef(keyOf(initial));
  useEffect(() => {
    if (keyOf(inView) === applied.current) return;
    const shown = chapters.find((c) => keyOf(c) === keyOf(inView));
    if (!shown) return;
    applied.current = keyOf(shown);
    setCurrent(shown.book, shown.chapter, lastVerseOf(shown));
    // The router doesn't notice the address bar being rewritten, so tell the header directly.
    window.dispatchEvent(
      new CustomEvent(CHAPTER_VIEW_EVENT, {
        detail: {
          base: `/read/${initial.book}/${initial.chapter}`,
          book: shown.book,
          chapter: shown.chapter,
        },
      }),
    );
    const url = new URL(window.location.href);
    if (url.pathname !== `/read/${shown.book}/${shown.chapter}`) {
      url.pathname = `/read/${shown.book}/${shown.chapter}`;
      // A verse chosen in the header menu belongs to the chapter that was opened.
      if (keyOf(shown) !== keyOf(initial)) url.searchParams.delete("v");
      window.history.replaceState(window.history.state, "", url);
    }
    // The opened chapter is recorded by the page itself; the ones scrolled to are recorded here.
    if (keyOf(shown) !== keyOf(initial)) recordRecent(shown.book, shown.chapter);
  }, [inView, chapters, initial, setCurrent]);

  const translations = [...new Set(chapters.map((c) => c.translation))];

  return (
    <>
      <div ref={topSentinel} aria-hidden="true" />
      {failedPrev && (
        <p className="mb-6 text-center text-muted" role="alert">
          The previous chapter could not be loaded.{" "}
          <button
            type="button"
            className="text-gold underline"
            onClick={() => setFailedPrev(false)}
          >
            Try again
          </button>
        </p>
      )}
      {chapters.map((loaded) => {
        const key = keyOf(loaded);
        return (
          <section
            key={key}
            data-book={loaded.book}
            data-chapter={loaded.chapter}
            ref={(element) => {
              if (element) sections.current.set(key, element);
              else sections.current.delete(key);
            }}
          >
            {key === keyOf(initial) ? (
              <Fragment key="title">{header}</Fragment>
            ) : (
              <div className="mt-10 mb-2 flex items-center justify-between gap-4">
                <h2
                  className="font-serif text-[30px] font-medium tracking-[.02em] text-heading max-[520px]:text-2xl"
                  data-testid="chapter-heading"
                >
                  {bookBySlug(loaded.book)?.name} {loaded.chapter}
                </h2>
                <ChapterNav book={loaded.book} chapter={loaded.chapter} />
              </div>
            )}
            {loaded.note && (
              <p className="mt-2 font-serif text-[15px] text-muted italic" role="note">
                {loaded.note}
              </p>
            )}
            <ChapterText
              book={loaded.book}
              verses={loaded.verses}
              arrive={key === keyOf(initial)}
            />
          </section>
        );
      })}
      <div ref={sentinel} aria-hidden="true" />
      {after && !failed && (
        <p className="mt-6 text-center text-xs text-muted" data-testid="more-loading">
          Loading {bookBySlug(after.book)?.name} {after.chapter}…
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
      <div className="mt-6 space-y-2">
        {translations.map((t) => (
          <Attribution key={t} translation={t} />
        ))}
      </div>
    </>
  );
}
