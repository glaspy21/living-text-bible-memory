"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useSyncExternalStore, type KeyboardEvent } from "react";
import { cn } from "@/client/lib/cn";
import { verseMarking } from "@/shared/scripture/selection";
import type { Verse } from "@/shared/scripture/types";
import { usePlayer } from "@/client/player/player-provider";
import { GO_TO_VERSE_EVENT, type GoToVerseDetail } from "@/client/lib/chapter-view";
import { useReaderSelection } from "./reader-selection";

let stopCurrent: (() => void) | undefined;

/**
 * Scroll a verse to the top of the screen. Near the end of a chapter the page may be too short to
 * bring the verse up until the next chapter has loaded below it, so once the scrolling comes to
 * rest it tries again, until the verse is at the top, the reader scrolls for themselves, or a few
 * seconds have passed. Returns a function that gives up.
 */
function bringToTop(row: HTMLElement): () => void {
  stopCurrent?.();
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  row.scrollIntoView({ block: "start", behavior: reduced ? "auto" : "smooth" });
  const scroller = row.closest("main");
  let lastTop = scroller?.scrollTop;
  let ticks = 0;
  const finish = () => {
    clearInterval(interval);
    document.removeEventListener("wheel", finish);
    document.removeEventListener("touchmove", finish);
    document.removeEventListener("keydown", finish);
    if (stopCurrent === finish) stopCurrent = undefined;
  };
  const interval = setInterval(() => {
    const top = scroller?.scrollTop;
    const settled = top === lastTop;
    lastTop = top;
    const off = scroller
      ? row.getBoundingClientRect().top - scroller.getBoundingClientRect().top
      : 0;
    if (++ticks > 16 || (settled && Math.abs(off) < 2 && ticks > 2)) return finish();
    if (settled && Math.abs(off) >= 2) row.scrollIntoView({ block: "start", behavior: "auto" });
  }, 250);
  document.addEventListener("wheel", finish, { passive: true });
  document.addEventListener("touchmove", finish, { passive: true });
  document.addEventListener("keydown", finish);
  stopCurrent = finish;
  return finish;
}

/**
 * A chapter with hanging verse numbers. Tapping a verse starts a selection; a second tap
 * completes the range. Verses are keyboard-operable buttons-in-spirit (role="button") rather than
 * real buttons so the text can still be selected and copied.
 */
export function ChapterText({
  book,
  verses,
  arrive = false,
}: {
  book: string;
  verses: Verse[];
  /** Whether `?v=` (a verse chosen in the header menu) points into this chapter. */
  arrive?: boolean;
}) {
  const { selection, selectionBook, tap } = useReaderSelection();
  const player = usePlayer();
  // False on the server and during hydration, true once taps will work (tests wait for this).
  const interactive = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  // Arriving with ?v=16 (from the header's verse menu) scrolls that verse to the top of the screen.
  const goTo = useSearchParams().get("v");
  const container = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!arrive || !goTo || !/^\d+$/.test(goTo)) return;
    const row = container.current?.querySelector<HTMLElement>(`[data-verse="${goTo}"]`);
    return row ? bringToTop(row) : undefined;
  }, [arrive, goTo]);

  // Choosing the verse that is already in the address bar changes nothing there, so the menu also
  // says so directly.
  const chapter = verses[0]?.chapter;
  useEffect(() => {
    let cancel: (() => void) | undefined;
    const onGo = (event: Event) => {
      const want = (event as CustomEvent<GoToVerseDetail>).detail;
      if (want.book !== book || want.chapter !== chapter) return;
      const row = container.current?.querySelector<HTMLElement>(`[data-verse="${want.verse}"]`);
      cancel?.();
      cancel = row ? bringToTop(row) : undefined;
    };
    window.addEventListener(GO_TO_VERSE_EVENT, onGo);
    return () => {
      window.removeEventListener(GO_TO_VERSE_EVENT, onGo);
      cancel?.();
    };
  }, [book, chapter]);

  return (
    <div
      ref={container}
      className="mt-[18px] font-serif text-[22px] leading-[1.6] max-[520px]:mt-1.5 max-[520px]:text-[17.5px] max-[520px]:leading-[1.5]"
      data-testid="chapter-text"
      data-interactive={interactive}
    >
      {verses.map((verse) => {
        const { inRange, edge } = verseMarking(selectionBook === book ? selection : null, verse);
        const sounding =
          player.status === "playing" &&
          player.currentVerse?.chapter === verse.chapter &&
          player.currentVerse.verse === verse.verse;
        const onKeyDown = (event: KeyboardEvent) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            tap(book, verse);
          }
        };
        return (
          <div
            key={verse.verse}
            role="button"
            tabIndex={0}
            aria-pressed={inRange}
            aria-label={`Verse ${verse.verse}`}
            data-verse={verse.verse}
            data-edge={edge || undefined}
            data-playing={sounding || undefined}
            onClick={() => tap(book, verse)}
            onKeyDown={onKeyDown}
            className={cn(
              "mb-0.5 grid cursor-pointer grid-cols-[46px_1fr] rounded-lg border border-transparent py-1.5 pr-3 transition-colors duration-200 max-[520px]:grid-cols-[34px_1fr] max-[520px]:py-[5px] max-[520px]:pr-1.5",
              // Every verse of the range shares the tint; only its first and last carry the gold edge.
              inRange ? "bg-[rgba(201,164,92,.10)]" : "hover:bg-[rgba(201,164,92,.05)]",
              edge && "shadow-[inset_2px_0_var(--gold)]",
              sounding &&
                "border-gold bg-gradient-to-b from-[rgba(212,168,79,.16)] to-[rgba(212,168,79,.07)] shadow-[0_0_24px_rgba(212,168,79,.12)]",
            )}
          >
            <span
              className="pl-2.5 text-[21px] leading-[1.5] text-gold max-[520px]:pl-1.5 max-[520px]:text-[17px]"
              aria-hidden="true"
            >
              {verse.verse}
            </span>
            <span>{verse.text}</span>
          </div>
        );
      })}
    </div>
  );
}
