"use client";

import { useSyncExternalStore, type KeyboardEvent } from "react";
import { cn } from "@/client/lib/cn";
import { isSelected } from "@/shared/scripture/selection";
import type { Verse } from "@/shared/scripture/types";
import { usePlayer } from "@/client/player/player-provider";
import { useReaderSelection } from "./reader-selection";

/**
 * A chapter with hanging verse numbers. Tapping a verse starts a selection; a second tap
 * completes the range. Verses are keyboard-operable buttons-in-spirit (role="button") rather than
 * real buttons so the text can still be selected and copied.
 */
export function ChapterText({ verses }: { verses: Verse[] }) {
  const { selection, tap } = useReaderSelection();
  const player = usePlayer();
  // False on the server and during hydration, true once taps will work (tests wait for this).
  const interactive = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  return (
    <div
      className="mt-[18px] font-serif text-[22px] leading-[1.6] max-[520px]:mt-1.5 max-[520px]:text-[17.5px] max-[520px]:leading-[1.5]"
      data-testid="chapter-text"
      data-interactive={interactive}
    >
      {verses.map((verse) => {
        const selected = isSelected(selection, verse);
        const sounding =
          player.status === "playing" &&
          player.currentVerse?.chapter === verse.chapter &&
          player.currentVerse.verse === verse.verse;
        const onKeyDown = (event: KeyboardEvent) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            tap(verse);
          }
        };
        return (
          <div
            key={verse.verse}
            role="button"
            tabIndex={0}
            aria-pressed={selected}
            aria-label={`Verse ${verse.verse}`}
            data-verse={verse.verse}
            data-playing={sounding || undefined}
            onClick={() => tap(verse)}
            onKeyDown={onKeyDown}
            className={cn(
              "mb-0.5 grid cursor-pointer grid-cols-[46px_1fr] rounded-lg border border-transparent py-1.5 pr-3 transition-colors duration-200 max-[520px]:grid-cols-[34px_1fr] max-[520px]:py-[5px] max-[520px]:pr-1.5",
              selected
                ? "bg-[rgba(201,164,92,.10)] shadow-[inset_2px_0_var(--gold)]"
                : "hover:bg-[rgba(201,164,92,.05)]",
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
