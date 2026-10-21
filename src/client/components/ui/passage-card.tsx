import Link from "next/link";
import type { ReactNode } from "react";

/** The right-panel card that names the passage and links to "Edit range" (Steps and the reader). */
export function PassageCard({
  reference,
  editHref,
  testId,
  children,
}: {
  reference: string;
  editHref: string;
  testId: string;
  /** A small note under the reference. */
  children?: ReactNode;
}) {
  return (
    <div className="rounded-[10px] border border-line bg-[rgba(18,18,18,.7)] p-[18px]">
      <div className="text-[11px] tracking-[.14em] text-muted uppercase">Passage</div>
      <div className="mt-1 font-serif text-[22px] text-gold2" data-testid={testId}>
        {reference}
      </div>
      {children}
      <Link
        href={editHref}
        className="wipe mt-3 inline-flex items-center rounded-[7px] border border-line px-3 py-[5px] text-xs text-muted"
      >
        Edit range
      </Link>
    </div>
  );
}
