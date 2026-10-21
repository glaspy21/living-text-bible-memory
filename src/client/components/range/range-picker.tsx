"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import {
  BookSelectorPanel,
  anchorBelow,
  type PanelAnchor,
} from "@/client/components/shell/book-selector";
import { cn } from "@/client/lib/cn";
import { formatPassageParam, withPassage } from "@/shared/scripture/passage-param";
import {
  markVerse,
  pickEndpoint,
  rangeLength,
  startRange,
  tapRangeVerse,
  type RangeState,
} from "@/shared/scripture/range-selection";
import { adjacentChapter, bookBySlug } from "@/shared/scripture/books";
import { formatReference, splitByBook } from "@/shared/scripture/refs";
import type { BookVerseRef, PassageRef } from "@/shared/scripture/types";

const HINTS = {
  first: "Now tap the closing verse.",
  start: "Tap the new start verse.",
  end: "Tap the new end verse.",
  none: "Tap a start verse, then an end verse. Tap Start or End below to change either one.",
} as const;

/** "3:16", or with the book's name when the range runs across books. */
const endpointLabel = (at: BookVerseRef, sameBook: boolean) =>
  `${sameBook ? "" : `${bookBySlug(at.book)?.name ?? at.book} `}${at.chapter}:${at.verse}`;

const chip = "rounded-full border px-3.5 py-1.5 text-[13px] transition-colors";

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
export function RangePicker({
  initial,
  initialCounts,
  musicBooks,
}: {
  initial: PassageRef;
  /** Verses in each chapter of the books already known (chapter n is `counts[n - 1]`). */
  initialCounts: Readonly<Record<string, readonly number[]>>;
  musicBooks: readonly string[];
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

  // Verse counts for the book on show and every book the range touches, loaded as needed.
  const needed = [view.book, ...splitByBook(passage).map((part) => part.book)].filter(
    (slug, i, all) => all.indexOf(slug) === i,
  );
  const missing = needed.filter((slug) => counts[slug] === undefined).join(",");
  useEffect(() => {
    for (const slug of missing.split(",").filter(Boolean)) {
      fetch(`/api/scripture/verse-counts?book=${encodeURIComponent(slug)}`)
        .then((response) => (response.ok ? response.json() : Promise.reject(new Error("failed"))))
        .then((body: { counts: number[] }) => setCounts((c) => ({ ...c, [slug]: body.counts })))
        .catch(() => setCounts((c) => ({ ...c, [slug]: [] })));
    }
  }, [missing]);

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

  const chooseChapter = (chosen: { slug: string }, chapter: number) =>
    setView({ book: chosen.slug, chapter });
  const step = (direction: 1 | -1) => {
    const next = adjacentChapter(view.book, view.chapter, direction);
    if (next) setView({ book: next.book.slug, chapter: next.chapter });
  };
  const hasPrev = adjacentChapter(view.book, view.chapter, -1) !== null;
  const hasNext = adjacentChapter(view.book, view.chapter, 1) !== null;

  const verses = counts[view.book]?.[view.chapter - 1] ?? 0;
  const hint = HINTS[range.picking ?? "none"];
  const total = rangeLength(range, (slug) => counts[slug]);

  return (
    <div data-testid="range-picker" data-interactive={interactive}>
      <div className="flex items-center gap-2">
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
        className="mt-4 grid grid-cols-[repeat(auto-fill,minmax(54px,1fr))] gap-[9px] max-[520px]:grid-cols-5"
        role="group"
        aria-label={`${book.name} ${view.chapter} verses`}
      >
        {Array.from({ length: verses }, (_, i) => i + 1).map((verse) => {
          const mark = markVerse(range, { book: view.book, chapter: view.chapter, verse });
          return (
            <button
              key={verse}
              type="button"
              aria-label={`Verse ${verse}`}
              aria-pressed={mark !== "none"}
              data-mark={mark}
              onClick={() =>
                update(tapRangeVerse(range, { book: view.book, chapter: view.chapter, verse }))
              }
              className={cn(
                "h-12 rounded-lg border font-serif text-xl",
                mark === "endpoint" &&
                  "border-[#e8cb8a] bg-gradient-to-b from-[#e8c97e] to-[#c99c44] font-semibold text-[#17110a]",
                mark === "inside" && "border-gold-dim bg-[rgba(212,168,79,.22)] text-gold2",
                mark === "none" && "border-line bg-[#0d0d0d] text-text hover:border-gold",
              )}
            >
              {verse}
            </button>
          );
        })}
      </div>

      <p className="mt-4 font-serif text-base text-muted" role="status">
        {hint}
      </p>

      <div className="mt-[22px] flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {(["start", "end"] as const).map((which) => (
            <button
              key={which}
              type="button"
              aria-pressed={range.picking === which}
              onClick={() => update(pickEndpoint(range, which))}
              className={cn(
                chip,
                range.picking === which
                  ? "border-gold bg-[rgba(212,168,79,.18)] text-gold2"
                  : "border-line text-muted hover:border-gold",
              )}
            >
              {which === "start" ? "Start" : "End"}:{" "}
              {endpointLabel(range[which], range.start.book === range.end.book)}
            </button>
          ))}
        </div>
        <span className="font-serif" data-testid="range-summary">
          {formatReference(passage)} · {total} {total === 1 ? "verse" : "verses"}
        </span>
      </div>

      <Link
        href={withPassage("/memorize", passage)}
        className="mt-6 inline-flex w-full items-center justify-center rounded-[7px] border border-[#d8b872] bg-gradient-to-b from-[#e0c07a] to-[#a8843f] px-5 py-[7px] font-serif text-[19px] text-[#120d03] transition-transform duration-200 active:scale-[0.97]"
      >
        Memorize {formatReference(passage)}
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
