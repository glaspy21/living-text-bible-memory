"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import {
  BookSelectorPanel,
  anchorBelow,
  type PanelAnchor,
} from "@/client/components/shell/book-selector";
import { cn } from "@/client/lib/cn";
import { formatPassageParam, withPassage } from "@/shared/scripture/passage-param";
import {
  markVerse,
  startRange,
  tapRangeVerse,
  type RangeState,
} from "@/shared/scripture/range-selection";
import { BOOKS, adjacentChapter, bookBySlug } from "@/shared/scripture/books";
import { formatReference, splitByBook } from "@/shared/scripture/refs";
import type { BookVerseRef, PassageRef } from "@/shared/scripture/types";

const stripBook = ({ chapter, verse }: BookVerseRef) => ({ chapter, verse });

/** A range as a passage; it ends in another book only when it really runs into one. */
function passageOf({ start, end }: { start: BookVerseRef; end: BookVerseRef }): PassageRef {
  return {
    book: start.book,
    start: stripBook(start),
    end: stripBook(end),
    ...(end.book !== start.book && { endBook: end.book }),
  };
}

/**
 * Pick a passage: any run of verses with no length limit, free to cross chapters and books.
 * Reusable: it reads and writes the passage as `?p=`, so any screen can send people here and take
 * them back. Browsing to another book keeps the selection, so a range can start in one book and
 * end in a later one.
 */
/** "John 1:3–6" shown with air around the dash: "John 1:3 – 6". */
function spacedDash(reference: string): string {
  return reference.replace(/–/g, " – ");
}

export function RangePicker({
  initial,
  initialCounts,
  musicBooks,
  returnTo,
}: {
  initial: PassageRef;
  /** Verses in each chapter of the books already known (chapter n is `counts[n - 1]`). */
  initialCounts: Readonly<Record<string, readonly number[]>>;
  musicBooks: readonly string[];
  /** The screen that sent people here: "done" goes back to it with the new passage. */
  returnTo?: { screen: "steps" | "flashcards" | "read"; step?: string };
}) {
  const [range, setRange] = useState<RangeState>(
    startRange(
      { book: initial.book, ...initial.start },
      { book: initial.endBook ?? initial.book, ...initial.end },
    ),
  );
  const [view, setView] = useState({ book: initial.book, chapter: initial.start.chapter });
  const [counts, setCounts] = useState<Record<string, readonly number[]>>({ ...initialCounts });
  const [anchor, setAnchor] = useState<PanelAnchor | null>(null);
  const dropdown = useRef<HTMLButtonElement>(null);
  // False on the server and during hydration, true once taps work (tests wait for this).
  const interactive = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  const book = bookBySlug(view.book)!;
  const passage = passageOf(range);

  // The books on show: the one chosen, then more are added above and below as the list is scrolled.
  const [span, setSpan] = useState(() => {
    const at = BOOKS.findIndex((b) => b.slug === initial.book);
    return { first: at, last: at };
  });
  const shown = BOOKS.slice(span.first, span.last + 1).map((b) => b.slug);

  // Verse counts for the books on show and every book the range touches, loaded as needed.
  const countsRef = useRef(counts);
  useEffect(() => {
    countsRef.current = counts;
  });
  const loading = useRef(new Map<string, Promise<void>>());
  const loadCounts = useCallback((slug: string): Promise<void> => {
    if (countsRef.current[slug] !== undefined) return Promise.resolve();
    let pending = loading.current.get(slug);
    if (!pending) {
      pending = fetch(`/api/scripture/verse-counts?book=${encodeURIComponent(slug)}`)
        .then((response) => (response.ok ? response.json() : Promise.reject(new Error("failed"))))
        .then((body: { counts: number[] }) => setCounts((c) => ({ ...c, [slug]: body.counts })))
        .catch(() => setCounts((c) => ({ ...c, [slug]: [] })))
        .then(() => {
          loading.current.delete(slug);
        });
      loading.current.set(slug, pending);
    }
    return pending;
  }, []);
  const needed = [...shown, ...splitByBook(passage).map((part) => part.book)].filter(
    (slug, i, all) => all.indexOf(slug) === i,
  );
  const missing = needed.filter((slug) => counts[slug] === undefined).join(",");
  useEffect(() => {
    for (const slug of missing.split(",").filter(Boolean)) void loadCounts(slug);
  }, [missing, loadCounts]);

  const update = (next: RangeState) => {
    setRange(next);
    const url = new URL(window.location.href);
    url.searchParams.set("p", formatPassageParam(passageOf(next)));
    window.history.replaceState(window.history.state, "", url);
  };

  const openChapters = () => {
    const rect = dropdown.current?.getBoundingClientRect();
    if (rect) setAnchor(anchorBelow(rect, rect.bottom + 6, window.innerWidth, "left"));
  };

  // The chapters are one scrolling list that runs on through the books in Bible order; the
  // dropdown and arrows jump within it.
  const scroller = useRef<HTMLDivElement>(null);
  const jump = useRef<{ book: string; chapter: number } | null>({
    book: initial.book,
    chapter: initial.start.chapter,
  });
  const growing = useRef(false);
  const heightBefore = useRef<number | null>(null);
  const scrollToChapter = (slug: string, chapter: number) => {
    const box = scroller.current;
    const section = box?.querySelector<HTMLElement>(
      `[data-book="${slug}"][data-chapter="${chapter}"]`,
    );
    if (!box || !section) return false;
    box.scrollTop = section.offsetTop;
    return true;
  };
  // A jump to a book that was not on show waits until its chapters are drawn.
  useLayoutEffect(() => {
    const wanted = jump.current;
    if (wanted && counts[wanted.book]?.length && scrollToChapter(wanted.book, wanted.chapter)) {
      jump.current = null;
    }
  });
  // Books added above push the list down: keep what was on screen where it was.
  useLayoutEffect(() => {
    const box = scroller.current;
    if (box && heightBefore.current !== null) {
      box.scrollTop += box.scrollHeight - heightBefore.current;
      heightBefore.current = null;
    }
  }, [span.first]);
  // Near either end of the list, bring in the next book (or the one before).
  const extend = () => {
    const box = scroller.current;
    if (!box || growing.current || jump.current) return;
    const above = box.scrollTop < 400 && span.first > 0;
    // Measured from the last chapter, not the scroll height, which includes the blank space after it.
    const sections = box.querySelectorAll<HTMLElement>("[data-chapter]");
    const end = sections.length
      ? sections[sections.length - 1].offsetTop + sections[sections.length - 1].offsetHeight
      : 0;
    const below = end - box.scrollTop - box.clientHeight < 600 && span.last < BOOKS.length - 1;
    if (!above && !below) return;
    const at = above ? span.first - 1 : span.last + 1;
    growing.current = true;
    void loadCounts(BOOKS[at].slug).then(() => {
      if (above) heightBefore.current = scroller.current?.scrollHeight ?? null;
      setSpan((s) =>
        above
          ? s.first === at + 1
            ? { ...s, first: at }
            : s
          : s.last === at - 1
            ? { ...s, last: at }
            : s,
      );
      growing.current = false;
    });
  };
  // Short books may not scroll at all, so look again whenever the list changes.
  useEffect(extend);
  const goTo = (slug: string, chapter: number) => {
    const at = BOOKS.findIndex((b) => b.slug === slug);
    if (at >= span.first && at <= span.last && counts[slug]?.length) {
      scrollToChapter(slug, chapter);
    } else {
      jump.current = { book: slug, chapter };
      setSpan({ first: at, last: at });
    }
    setView({ book: slug, chapter });
  };
  // The chapter at the top of the list is the one the dropdown names.
  const onScroll = () => {
    const box = scroller.current;
    if (!box) return;
    let top: HTMLElement | null = null;
    for (const section of box.querySelectorAll<HTMLElement>("[data-chapter]")) {
      if (section.offsetTop > box.scrollTop + 8) break;
      top = section;
    }
    if (top) {
      const [slug, chapter] = [top.dataset.book!, Number(top.dataset.chapter)];
      setView((v) => (v.book === slug && v.chapter === chapter ? v : { book: slug, chapter }));
    }
    extend();
  };
  const chooseChapter = (chosen: { slug: string }, chapter: number) => goTo(chosen.slug, chapter);
  const step = (direction: 1 | -1) => {
    const next = adjacentChapter(view.book, view.chapter, direction);
    if (next) goTo(next.book.slug, next.chapter);
  };
  const hasPrev = adjacentChapter(view.book, view.chapter, -1) !== null;
  const hasNext = adjacentChapter(view.book, view.chapter, 1) !== null;

  const returnHref = !returnTo
    ? withPassage("/memorize", passage)
    : returnTo.screen === "read"
      ? // `v` brings the first verse of the range to the top of the reader, `jump` without scrolling.
        `${withPassage(`/read/${passage.book}/${passage.start.chapter}`, passage)}&v=${passage.start.verse}&jump=1`
      : withPassage(`/memorize/${returnTo.screen}`, passage) +
        (returnTo.step ? `&step=${returnTo.step}` : "");

  return (
    <div
      data-testid="range-picker"
      data-interactive={interactive}
      className="flex min-h-0 flex-1 flex-col"
    >
      <div className="flex shrink-0 items-center gap-2">
        <button
          ref={dropdown}
          type="button"
          aria-haspopup="dialog"
          onClick={openChapters}
          className="flex w-full items-center justify-between rounded-[9px] border border-gold bg-[#0b0b0b] px-4 py-3 font-serif text-[21px]"
        >
          <span>
            {book.name} {view.chapter}
          </span>
          <small className="text-gold" aria-hidden="true">
            ▾
          </small>
        </button>
        <button
          type="button"
          aria-label="Previous chapter"
          disabled={!hasPrev}
          onClick={() => step(-1)}
          className="grid h-[52px] w-[52px] flex-none place-items-center rounded-[9px] border border-line text-gold disabled:opacity-30"
        >
          ‹
        </button>
        <button
          type="button"
          aria-label="Next chapter"
          disabled={!hasNext}
          onClick={() => step(1)}
          className="grid h-[52px] w-[52px] flex-none place-items-center rounded-[9px] border border-line text-gold disabled:opacity-30"
        >
          ›
        </button>
      </div>

      <div
        ref={scroller}
        onScroll={onScroll}
        data-testid="range-scroller"
        className="relative mt-4 min-h-0 flex-1 overflow-y-auto pr-1 [overflow-anchor:none]"
      >
        {shown.flatMap((slug) =>
          (counts[slug] ?? []).map((verses, i) => {
            const chapter = i + 1;
            const name = bookBySlug(slug)!.name;
            return (
              <section key={`${slug}-${chapter}`} data-book={slug} data-chapter={chapter}>
                <h3 className="mt-5 mb-2 font-serif text-lg text-gold first:mt-0">
                  {name} {chapter}
                </h3>
                <div
                  className="grid grid-cols-[repeat(auto-fill,minmax(54px,1fr))] gap-[9px] max-[520px]:grid-cols-5"
                  role="group"
                  aria-label={`${name} ${chapter} verses`}
                >
                  {Array.from({ length: verses }, (_, n) => n + 1).map((verse) => {
                    const at = { book: slug, chapter, verse };
                    const mark = markVerse(range, at);
                    return (
                      <button
                        key={verse}
                        type="button"
                        aria-label={`Verse ${verse}`}
                        aria-pressed={mark !== "none"}
                        data-mark={mark}
                        onClick={() => update(tapRangeVerse(range, at))}
                        className={cn(
                          "h-12 rounded-lg border font-serif text-xl",
                          mark === "endpoint" &&
                            "border-[#e8cb8a] bg-gradient-to-b from-[#e8c97e] to-[#c99c44] font-semibold text-[#17110a]",
                          mark === "inside" &&
                            "border-gold-dim bg-[rgba(212,168,79,.22)] text-gold2",
                          mark === "none" && "border-line bg-[#0d0d0d] text-text hover:border-gold",
                        )}
                      >
                        {verse}
                      </button>
                    );
                  })}
                </div>
              </section>
            );
          }),
        )}
        {/* Room after the last chapter so that any chapter can be scrolled to the top. */}
        <div aria-hidden="true" className="h-[70vh]" />
      </div>

      <p
        className="mt-4 shrink-0 text-center font-serif text-[30px] text-gold2"
        data-testid="range-summary"
      >
        {spacedDash(formatReference(passage))}
      </p>

      <Link
        href={returnHref}
        className="mt-3 inline-flex w-full shrink-0 items-center justify-center rounded-[7px] border border-[#d8b872] bg-gradient-to-b from-[#e0c07a] to-[#a8843f] px-5 py-[7px] font-serif text-[19px] text-[#120d03] transition-transform duration-200 active:scale-[0.97]"
      >
        Set Range
      </Link>

      {anchor && (
        <BookSelectorPanel
          anchor={anchor}
          attached={false}
          currentBook={view.book}
          currentChapter={view.chapter}
          musicBooks={new Set(musicBooks)}
          onClose={() => {
            setAnchor(null);
            dropdown.current?.focus();
          }}
          onSelect={chooseChapter}
        />
      )}
    </div>
  );
}
