"use client";

import { BarLink } from "@/client/components/ui/bar";
import { useRecent } from "@/client/lib/recent-store";
import { bookBySlug } from "@/shared/scripture/books";

/** Home's Continue bar: back to the chapter opened most recently, or John 1 for a first visit. */
export function ContinueBar() {
  const last = useRecent()[0];
  const name = last ? `${bookBySlug(last.book)?.name} ${last.chapter}` : null;
  return (
    <BarLink
      href={last ? `/read/${last.book}/${last.chapter}` : "/read/john/1"}
      icon="book"
      title="Continue"
      subtitle={name ?? "Start with John 1"}
    />
  );
}
