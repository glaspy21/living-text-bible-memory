"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import { useRecent } from "@/client/lib/recent-store";
import { bookBySlug } from "@/shared/scripture/books";
import { relativeDay } from "@/shared/scripture/recent";
import { ChapterTile } from "./chapter-tile";
import { RevealRows } from "./reveal-rows";

// "Today" depends on the viewer's clock, so it is only worked out in the browser.
const useNow = () =>
  useSyncExternalStore(
    () => () => {},
    () => Math.floor(Date.now() / 60_000) * 60_000,
    () => 0,
  );

/** Home's list of chapters opened on this device, newest first, revealed as it scrolls into view. */
export function RecentlyStudied() {
  const recent = useRecent();
  const now = useNow();

  return (
    <section aria-labelledby="recent-heading">
      <h2
        id="recent-heading"
        className="mt-[26px] mb-1.5 font-serif text-2xl font-medium text-heading"
      >
        Recently Studied
      </h2>
      {recent.length === 0 ? (
        <p className="py-3 text-muted">Chapters you read will show up here.</p>
      ) : (
        <RevealRows>
          {recent.map(({ book, chapter, openedAt }) => (
            <Link
              key={`${book}/${chapter}`}
              href={`/read/${book}/${chapter}`}
              className="flex w-full items-center gap-2.5 border-b border-[#1a1a1a] px-1 py-2.5 text-left hover:bg-[rgba(201,164,92,.06)]"
              style={{ willChange: "opacity, transform" }}
            >
              <ChapterTile chapter={chapter} />
              <span>
                <span className="block font-serif text-base font-medium text-text max-[520px]:text-[17px]">
                  {bookBySlug(book)?.name} {chapter}
                </span>
                <span className="block text-[11.5px] text-muted">
                  {now ? relativeDay(openedAt, now) : ""}
                </span>
              </span>
            </Link>
          ))}
        </RevealRows>
      )}
    </section>
  );
}
