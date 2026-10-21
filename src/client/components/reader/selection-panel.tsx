"use client";

import Link from "next/link";
import { formatReference } from "@/shared/scripture/refs";
import { withPassage } from "@/shared/scripture/passage-param";
import { useReaderSelection } from "./reader-selection";

const solid =
  "inline-flex w-full items-center justify-center rounded-[7px] border border-[#d8b872] bg-gradient-to-b from-[#e0c07a] to-[#a8843f] px-5 py-[9px] font-semibold text-[#120d03] transition-transform duration-200 active:scale-[0.97]";
const ghost =
  "wipe mt-3.5 inline-flex w-full items-center justify-center rounded-[7px] border border-line px-5 py-[9px] text-muted transition-colors";

/** Right panel of the reader: what is selected, and the way on to Memorize or Edit range. */
export function SelectionPanel({ musicChapters }: { musicChapters: readonly number[] }) {
  const { passage, isWholeChapter, currentChapter } = useReaderSelection();
  // Music is about the chapter in view, which moves as you scroll on.
  const available = musicChapters.includes(currentChapter);
  return (
    <>
      <h2 className="mb-1.5 font-serif text-[22px] font-medium text-heading">Memorize</h2>
      <p className="mb-4 text-muted" data-testid="selected-passage">
        Selected: {formatReference(passage)}
        {isWholeChapter && (
          <span className="block text-xs">Whole chapter · tap verses to choose</span>
        )}
      </p>
      <Link href={withPassage("/memorize", passage)} className={solid}>
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
      <Link href={withPassage("/memorize/range", passage)} className={ghost}>
        Edit verse range
      </Link>
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
