"use client";

import { useSyncExternalStore } from "react";
import { addRecent, parseRecent, type RecentChapter } from "@/shared/scripture/recent";

/** Recently opened chapters, kept in this browser only. Everything here tolerates storage being unavailable. */
const KEY = "lt.recent.v1";
const CHANGE = "lt:recent-change";

const read = (): string | null => {
  try {
    return window.localStorage.getItem(KEY);
  } catch {
    return null; // private window, blocked storage, …
  }
};

function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange); // another tab
  window.addEventListener(CHANGE, onChange); // this tab
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(CHANGE, onChange);
  };
}

const NONE: RecentChapter[] = [];
let lastRaw: string | null | undefined;
let lastList: RecentChapter[] = NONE;

/** Same array until the stored text changes, which useSyncExternalStore needs to avoid re-render loops. */
function snapshot(): RecentChapter[] {
  const raw = read();
  if (raw !== lastRaw) {
    lastRaw = raw;
    lastList = parseRecent(raw);
  }
  return lastList;
}

/** The list, newest first; empty on the server and until the browser has been read. */
export function useRecent(): readonly RecentChapter[] {
  return useSyncExternalStore(subscribe, snapshot, () => NONE);
}

/** Note that a chapter was just opened. */
export function recordRecent(book: string, chapter: number, now = Date.now()): void {
  try {
    const next = addRecent(parseRecent(read()), { book, chapter, openedAt: now });
    window.localStorage.setItem(KEY, JSON.stringify(next));
    window.dispatchEvent(new Event(CHANGE));
  } catch {
    // Storage unavailable: history just isn't kept.
  }
}
