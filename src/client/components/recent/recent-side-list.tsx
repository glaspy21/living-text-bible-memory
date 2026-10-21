"use client";

import Link from "next/link";
import { useRecent } from "@/client/lib/recent-store";
import { bookBySlug } from "@/shared/scripture/books";
import { ChapterTile } from "./chapter-tile";

const SIDEBAR_COUNT = 4;

/** "Recently studied" in the sidebar: the last few chapters opened on this device. */
export function RecentSideList() {
  const recent = useRecent().slice(0, SIDEBAR_COUNT);
  if (recent.length === 0) {
    return <p className="px-3 text-xs text-muted">Passages you open will appear here.</p>;
  }
  return (
    <ul>
      {recent.map(({ book, chapter }) => (
        <li key={`${book}/${chapter}`}>
          <Link
            href={`/read/${book}/${chapter}`}
            className="flex w-full items-center gap-2.5 rounded-md px-2 py-[7px] text-left hover:bg-[rgba(201,164,92,.06)]"
          >
            <ChapterTile chapter={chapter} />
            <span className="font-serif text-base font-medium text-text">
              {bookBySlug(book)?.name} {chapter}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
