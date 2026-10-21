"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react";
import { formatPassageParam, parsePassageParam } from "@/shared/scripture/passage-param";
import { compareRefs } from "@/shared/scripture/refs";
import { tapVerse, type Selection } from "@/shared/scripture/selection";
import type { PassageRef, VerseRef } from "@/shared/scripture/types";

/**
 * The passage chosen on the reader. It lives in the URL (`?p=john 1:1-18`) so a reload or a shared
 * link keeps it, and the Memorize buttons carry it to the next screen. Only the half-finished
 * "waiting for the second tap" state is kept in memory.
 */
type ReaderSelection = {
  /** The tapped verses, or null when nothing is chosen. */
  selection: Selection | null;
  /** What Memorize will use: the selection, or the whole chapter when nothing is chosen. */
  passage: PassageRef;
  /** True when `passage` is the whole chapter because nothing was chosen. */
  isWholeChapter: boolean;
  tap(verse: VerseRef): void;
};

const Context = createContext<ReaderSelection | null>(null);

const CHANGE_EVENT = "lt:selection-change";

function subscribe(onChange: () => void) {
  window.addEventListener("popstate", onChange);
  window.addEventListener(CHANGE_EVENT, onChange);
  return () => {
    window.removeEventListener("popstate", onChange);
    window.removeEventListener(CHANGE_EVENT, onChange);
  };
}

const readParam = () => new URLSearchParams(window.location.search).get("p") ?? "";

export function ReaderSelectionProvider({
  book,
  chapter,
  lastVerse,
  children,
}: {
  book: string;
  chapter: number;
  lastVerse: number;
  children: React.ReactNode;
}) {
  // Server render and hydration see "no selection"; the browser then reads the real URL.
  const param = useSyncExternalStore(subscribe, readParam, () => "");
  const [anchor, setAnchor] = useState<VerseRef | null>(null);

  const selection = useMemo<Selection | null>(() => {
    const parsed = parsePassageParam(param);
    if (!parsed || parsed.book !== book) return null;
    const waiting =
      anchor && compareRefs(anchor, parsed.start) === 0 && compareRefs(anchor, parsed.end) === 0;
    return { start: parsed.start, end: parsed.end, anchor: waiting ? anchor : null };
  }, [param, book, anchor]);

  const tap = useCallback(
    (verse: VerseRef) => {
      const next = tapVerse(selection, verse);
      setAnchor(next.anchor);
      const url = new URL(window.location.href);
      url.searchParams.set("p", formatPassageParam({ book, start: next.start, end: next.end }));
      window.history.replaceState(window.history.state, "", url);
      window.dispatchEvent(new Event(CHANGE_EVENT));
    },
    [book, selection],
  );

  const value = useMemo<ReaderSelection>(
    () => ({
      selection,
      passage: selection
        ? { book, start: selection.start, end: selection.end }
        : { book, start: { chapter, verse: 1 }, end: { chapter, verse: lastVerse } },
      isWholeChapter: selection === null,
      tap,
    }),
    [book, chapter, lastVerse, selection, tap],
  );

  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useReaderSelection(): ReaderSelection {
  const value = useContext(Context);
  if (!value) throw new Error("useReaderSelection must be used inside ReaderSelectionProvider");
  return value;
}
