"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Attribution } from "@/client/components/scripture/attribution";
import { Main } from "@/client/components/shell/regions";
import { Icon } from "@/client/components/ui/icons";
import { cn } from "@/client/lib/cn";
import { recordActivity } from "@/client/lib/activity-store";
import { PlayerPassage } from "@/client/player/player-passage";
import { usePlayer } from "@/client/player/player-provider";
import { inOrder, moveCard, shuffledFrom } from "@/shared/memorize/flashcards";
import { bookBySlug } from "@/shared/scripture/books";
import { formatPassageParam, withPassage } from "@/shared/scripture/passage-param";
import type { PassageRef, PassageVerse, TranslationCode } from "@/shared/scripture/types";

const arrow =
  "grid h-10 w-10 flex-none place-items-center rounded-full text-gold transition-[color,box-shadow] hover:text-gold2 hover:shadow-[0_0_14px_rgba(212,168,79,.25)]";

/**
 * One card per verse. The front shows the reference ("Tap to reveal"); tapping turns it over to
 * the verse. Moving to another card, flipping, shuffling and restarting never start the music:
 * only Play does.
 * (If the music is already playing, it follows you to the new card's verse.)
 */
export function FlashcardsView({
  passage,
  verses,
  translation,
  note,
}: {
  passage: PassageRef;
  verses: PassageVerse[];
  translation: TranslationCode;
  note: string | null;
}) {
  const player = usePlayer();
  const [order, setOrder] = useState(() => inOrder(verses.length));
  const [position, setPosition] = useState(0);
  // Shuffle is a switch: on, the cards come in random order (every card once); off, in sequence.
  const [shuffleOn, setShuffleOn] = useState(false);
  const [flipped, setFlipped] = useState(false);
  // Counts moves so the new card slides in (the card is re-created for each).
  const [moves, setMoves] = useState(0);

  // The card is re-created for each move; if it had the keyboard focus, the new one gets it.
  const refocus = useRef(false);

  const param = formatPassageParam(passage);
  useEffect(() => recordActivity({ kind: "flashcards", p: param }), [param]);

  const verse = verses[order[position]];
  const nameOf = (slug: string) => (bookBySlug(slug)?.name ?? slug).toUpperCase();
  const bookName = verse ? nameOf(verse.book) : "";

  /** Point the music at the verse on the card (this alone never starts it). */
  const follow = (v: PassageVerse) => {
    const at = player.verses.findIndex(
      (p) => p.book === v.book && p.chapter === v.chapter && p.verse === v.verse,
    );
    if (at >= 0) player.seekVerse(at);
  };

  const show = (nextOrder: number[], nextPosition: number) => {
    refocus.current = document.activeElement?.getAttribute("data-testid") === "card";
    setOrder(nextOrder);
    setPosition(nextPosition);
    setFlipped(false);
    setMoves((m) => m + 1);
    follow(verses[nextOrder[nextPosition]]);
  };
  // Left and right arrow keys move between cards from anywhere on the page.
  const moveRef = useRef<(delta: 1 | -1) => void>(() => {});
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.altKey || event.ctrlKey || event.metaKey) return;
      if (event.key === "ArrowLeft") moveRef.current(-1);
      if (event.key === "ArrowRight") moveRef.current(1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const move = (delta: 1 | -1) => show(order, moveCard(position, delta, order.length));
  useEffect(() => {
    moveRef.current = move;
  });
  /** Switch Shuffle on or off. Either way you stay on the card you are looking at. */
  const toggleShuffle = () => {
    const current = order[position];
    const next = !shuffleOn;
    setShuffleOn(next);
    if (next) show(shuffledFrom(verses.length, current), 0);
    else show(inOrder(verses.length), current);
  };
  /** Back to the beginning of the deck: card 1 in sequence, or a fresh random pass when shuffled. */
  const restart = () =>
    shuffleOn
      ? show(shuffledFrom(verses.length, Math.floor(Math.random() * verses.length)), 0)
      : show(order, 0);

  return (
    <>
      <PlayerPassage passage={passage} context="practice" />
      <Main player className="flex flex-col items-center">
        <div className="w-full max-w-[800px] text-center">
          <div className="flex items-center justify-between">
            <span className="tracking-[.14em] text-muted" data-testid="card-count">
              CARD {position + 1} OF {order.length}
            </span>
            <Link
              href={withPassage("/memorize/steps", passage)}
              className="wipe inline-flex h-[42px] items-center gap-[9px] rounded-[10px] border-[1.5px] border-gold bg-[rgba(201,164,92,.07)] px-4 font-serif text-[17px] text-gold2"
            >
              <Icon name="list" size={20} />
              Switch to Steps
              <span className="wipe-fill" aria-hidden="true">
                <Icon name="list" size={20} />
                Switch to Steps
              </span>
            </Link>
          </div>

          {note && (
            <p className="mt-3 font-serif text-[15px] text-muted italic" role="note">
              {note}
            </p>
          )}

          <div className="mx-auto mt-[18px] flex w-full max-w-[760px] items-center gap-[18px] max-[520px]:gap-1.5">
            <button
              type="button"
              aria-label="Previous card"
              className={arrow}
              onClick={() => move(-1)}
            >
              <Icon name="chevronLeft" size={26} />
            </button>
            <div className="fc-wrap">
              <div
                key={moves}
                className={moves > 0 ? "fc fc-in" : "fc"}
                data-flipped={flipped}
                data-testid="card"
                ref={(element) => {
                  if (element && refocus.current) {
                    refocus.current = false;
                    element.focus();
                  }
                }}
                role="button"
                tabIndex={0}
                aria-label={`Card for ${bookName} ${verse.chapter}:${verse.verse}. ${flipped ? "Showing the verse" : "Tap to reveal"}`}
                onClick={() => setFlipped((f) => !f)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    setFlipped((f) => !f);
                  }
                }}
              >
                <div className="fc-face" aria-hidden={flipped}>
                  <span className="font-serif text-base tracking-[.3em] text-gold">{bookName}</span>
                  <div className="my-2 font-serif text-[82px] leading-tight text-text max-[520px]:text-[56px]">
                    {verse.chapter}:{verse.verse}
                  </div>
                  <span className="font-serif text-[17px] text-muted">Tap to reveal</span>
                </div>
                <div className="fc-face back" aria-hidden={!flipped}>
                  <span className="mb-4 font-serif text-base tracking-[.3em] text-gold">
                    {bookName}
                  </span>
                  <div className="grid grid-cols-[44px_auto] items-start gap-1.5 text-left font-serif text-[26px] leading-normal max-[520px]:grid-cols-[30px_auto] max-[520px]:text-[18px]">
                    <b className="font-medium text-gold text-[28px] max-[520px]:text-xl">
                      {verse.verse}
                    </b>
                    <span data-testid="card-text">{verse.text}</span>
                  </div>
                </div>
              </div>
            </div>
            <button type="button" aria-label="Next card" className={arrow} onClick={() => move(1)}>
              <Icon name="chevronRight" size={26} />
            </button>
          </div>

          <div className="mt-5 flex items-center justify-center gap-10 max-[520px]:gap-5">
            <button
              type="button"
              onClick={restart}
              className="wipe rounded-[7px] border border-gold px-4 py-[7px] font-serif text-[19px] text-gold transition-[background,box-shadow,color] duration-200 active:bg-[rgba(201,164,92,.22)] active:shadow-[0_0_18px_rgba(201,164,92,.35)]"
            >
              Restart
              <span className="wipe-fill" aria-hidden="true">
                Restart
              </span>
            </button>
            <button
              type="button"
              onClick={toggleShuffle}
              aria-pressed={shuffleOn}
              data-testid="shuffle"
              className={cn(
                "wipe flex items-center gap-[9px] rounded-[7px] border border-gold px-4 py-[7px] font-serif text-[19px] transition-[background,box-shadow,color] duration-200",
                shuffleOn ? "text-gold" : "text-gold",
              )}
            >
              <Icon name="shuffle" size={22} />
              Shuffle
              <span className="wipe-fill" aria-hidden="true">
                <Icon name="shuffle" size={22} />
                Shuffle
              </span>
            </button>
          </div>
          <p className="mt-3.5 text-xs text-muted max-[520px]:hidden">
            Audio plays only when you press Play — never on flip, next, shuffle or restart.
          </p>
          <Attribution translation={translation} className="mt-4" />
        </div>
      </Main>
    </>
  );
}
