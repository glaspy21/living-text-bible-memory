"use client";

import Link from "next/link";
import { useRef, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
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
import { formatReference } from "@/shared/scripture/refs";
import type { PassageRef } from "@/shared/scripture/types";

const HINTS = {
  first: "Now tap the closing verse.",
  start: "Tap the new start verse.",
  end: "Tap the new end verse.",
  none: "Tap a start verse, then an end verse. Tap Start or End below to change either one.",
} as const;

const chip = "rounded-full border px-3.5 py-1.5 text-[13px] transition-colors";

/**
 * Pick a passage: any run of verses in one book, with no length limit and free to cross
 * chapters. Reusable: it reads and writes the passage as `?p=`, so any screen can send people
 * here and take them back.
 */
export function RangePicker({
  book,
  counts,
  initial,
  musicBooks,
}: {
  book: { slug: string; name: string; chapterCount: number };
  /** Verses in each chapter; chapter n is `counts[n - 1]`. */
  counts: readonly number[];
  initial: PassageRef;
  musicBooks: readonly string[];
}) {
  const router = useRouter();
  const [range, setRange] = useState<RangeState>(startRange(initial.start, initial.end));
  const [view, setView] = useState(initial.start.chapter);
  const [anchor, setAnchor] = useState<PanelAnchor | null>(null);
  const dropdown = useRef<HTMLButtonElement>(null);
  // False on the server and during hydration, true once taps work (tests wait for this).
  const interactive = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  const passage: PassageRef = { book: book.slug, start: range.start, end: range.end };

  const update = (next: RangeState) => {
    setRange(next);
    const url = new URL(window.location.href);
    url.searchParams.set(
      "p",
      formatPassageParam({ book: book.slug, start: next.start, end: next.end }),
    );
    window.history.replaceState(window.history.state, "", url);
  };

  const openChapters = () => {
    const rect = dropdown.current?.getBoundingClientRect();
    if (rect) setAnchor(anchorBelow(rect, rect.bottom + 6, window.innerWidth, "left"));
  };

  const chooseChapter = (chosen: { slug: string }, chapter: number) => {
    if (chosen.slug === book.slug) return setView(chapter);
    // A different book starts a fresh selection there.
    router.replace(
      withPassage("/memorize/range", {
        book: chosen.slug,
        start: { chapter, verse: 1 },
        end: { chapter, verse: 1 },
      }),
    );
  };

  const verses = counts[view - 1] ?? 0;
  const hint = HINTS[range.picking ?? "none"];
  const total = rangeLength(range, counts);

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
            {book.name} {view}
          </span>
          <small className="text-gold" aria-hidden="true">
            ▾
          </small>
        </button>
        <button
          type="button"
          aria-label="Previous chapter"
          disabled={view <= 1}
          onClick={() => setView(view - 1)}
          className="grid h-[52px] w-[52px] flex-none place-items-center rounded-[9px] border border-line text-gold disabled:opacity-30"
        >
          ‹
        </button>
        <button
          type="button"
          aria-label="Next chapter"
          disabled={view >= book.chapterCount}
          onClick={() => setView(view + 1)}
          className="grid h-[52px] w-[52px] flex-none place-items-center rounded-[9px] border border-line text-gold disabled:opacity-30"
        >
          ›
        </button>
      </div>

      <div
        className="mt-4 grid grid-cols-[repeat(auto-fill,minmax(54px,1fr))] gap-[9px] max-[520px]:grid-cols-5"
        role="group"
        aria-label={`${book.name} ${view} verses`}
      >
        {Array.from({ length: verses }, (_, i) => i + 1).map((verse) => {
          const mark = markVerse(range, { chapter: view, verse });
          return (
            <button
              key={verse}
              type="button"
              aria-label={`Verse ${verse}`}
              aria-pressed={mark !== "none"}
              data-mark={mark}
              onClick={() => update(tapRangeVerse(range, { chapter: view, verse }))}
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
              {which === "start" ? "Start" : "End"}: {range[which].chapter}:{range[which].verse}
            </button>
          ))}
        </div>
        <span className="font-serif" data-testid="range-summary">
          {formatReference(passage)} · {total} {total === 1 ? "verse" : "verses"}
        </span>
      </div>

      <Link
        href={withPassage("/memorize", passage)}
        className="mt-6 inline-flex w-full items-center justify-center rounded-[7px] border border-[#d8b872] bg-gradient-to-b from-[#e0c07a] to-[#a8843f] px-5 py-[11px] font-semibold text-[#120d03] transition-transform duration-200 active:scale-[0.97]"
      >
        Memorize {formatReference(passage)}
      </Link>

      {anchor && (
        <BookSelectorPanel
          anchor={anchor}
          attached={false}
          currentBook={book.slug}
          currentChapter={view}
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
