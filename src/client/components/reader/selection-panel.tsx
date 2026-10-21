"use client";

import Link from "next/link";
import { formatReference } from "@/shared/scripture/refs";
import { withPassage } from "@/shared/scripture/passage-param";
import { PassageCard } from "@/client/components/ui/passage-card";
import { cn } from "@/client/lib/cn";
import { useReaderSelection } from "./reader-selection";

const solid =
  "inline-flex w-full items-center justify-center rounded-[7px] border border-[#d8b872] bg-gradient-to-b from-[#e0c07a] to-[#a8843f] px-5 py-[7px] font-serif text-[19px] text-[#120d03] transition-transform duration-200 active:scale-[0.97]";

/** Right panel of the reader: what is selected, and the way on to Memorize or Edit range. */
export function SelectionPanel({
  musicChapters,
}: {
  musicChapters: Readonly<Record<string, readonly number[]>>;
}) {
  const { passage, isWholeChapter, currentBook, currentChapter } = useReaderSelection();
  // Music is about the chapter in view, which moves as you scroll on.
  const available = (musicChapters[currentBook] ?? []).includes(currentChapter);
  return (
    <>
      <PassageCard
        reference={formatReference(passage)}
        editHref={`${withPassage("/memorize/range", passage)}&from=read`}
        testId="selected-passage"
      >
        {isWholeChapter && (
          <span className="mt-1 block text-xs text-muted">
            Whole chapter · tap verses to choose
          </span>
        )}
      </PassageCard>
      <Link href={withPassage("/memorize", passage)} className={cn(solid, "mt-3.5")}>
        Memorize
      </Link>
      <div className="mt-[22px] rounded-[10px] border border-line bg-[rgba(18,18,18,.7)] p-[18px]">
        <div className="flex items-center justify-between">
          <b className="font-medium text-gold2">Music</b>
          {available && (
            <span
              className="inline-block h-1.5 w-1.5 rounded-full bg-gold shadow-[0_0_6px_var(--gold)]"
              role="img"
              aria-label="Music available"
            />
          )}
        </div>
        <p className="mt-1.5 text-muted">
          {available ? "Recording available" : "No recording for this chapter yet"}
        </p>
      </div>
    </>
  );
}

/** Full-width Memorize button under the chapter (the only route on phones, which have no right panel). */
export function MemorizeBar() {
  const { passage } = useReaderSelection();
  return (
    <Link
      href={withPassage("/memorize", passage)}
      className="wipe mt-5 flex w-full items-center justify-center rounded-[9px] border border-gold bg-[rgba(20,18,12,.85)] p-[13px] font-serif text-[19px] text-gold2"
    >
      Memorize {formatReference(passage)}
      <span className="wipe-fill" aria-hidden="true">
        Memorize {formatReference(passage)}
      </span>
    </Link>
  );
}
