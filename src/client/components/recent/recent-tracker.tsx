"use client";

import { useEffect } from "react";
import { recordRecent } from "@/client/lib/recent-store";

/** Renders nothing; remembers that this chapter was opened. */
export function RecentTracker({ book, chapter }: { book: string; chapter: number }) {
  useEffect(() => recordRecent(book, chapter), [book, chapter]);
  return null;
}
