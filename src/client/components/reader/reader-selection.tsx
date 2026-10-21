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
  /** The book the selection is in (a selection never spans books); null when nothing is chosen. */
  selectionBook: string | null;
  /** What Memorize will use: the selection, or the whole chapter when nothing is chosen. */
  passage: PassageRef;
  /** True when `passage` is the whole chapter because nothing was chosen. */
  isWholeChapter: boolean;
  /** The chapter in view (continuous scrolling moves it on); also where Memorize's default comes from. */
  currentBook: string;
  currentChapter: number;
  /** Called by the chapter list as the chapter in view changes (it may be in another book). */
  setCurrent(book: string, chapter: number, lastVerse: number): void;
  /** Tap a verse of `book`; a tap in a different book from the selection starts a fresh selection. */
  tap(book: string, verse: VerseRef): void;
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
  // Scrolling on into the next chapter moves "the chapter in view" without leaving the page.
  const [current, setCurrentState] = useState({ book, chapter, lastVerse });
  const setCurrent = useCallback(
    (nextBook: string, nextChapter: number, nextLastVerse: number) =>
      setCurrentState((c) =>
        c.book === nextBook && c.chapter === nextChapter && c.lastVerse === nextLastVerse
          ? c
          : { book: nextBook, chapter: nextChapter, lastVerse: nextLastVerse },
      ),
    [],
  );

  const parsedPassage = useMemo(() => parsePassageParam(param), [param]);
  const selectionBook = parsedPassage?.book ?? null;
  const selection = useMemo<Selection | null>(() => {
    if (!parsedPassage) return null;
    const { start, end } = parsedPassage;
    const waiting = anchor && compareRefs(anchor, start) === 0 && compareRefs(anchor, end) === 0;
    return { start, end, anchor: waiting ? anchor : null };
  }, [parsedPassage, anchor]);

  const tap = useCallback(
    (tappedBook: string, verse: VerseRef) => {
      const next = tapVerse(tappedBook === selectionBook ? selection : null, verse);
      setAnchor(next?.anchor ?? null);
      const url = new URL(window.location.href);
      if (next) {
        url.searchParams.set(
          "p",
          formatPassageParam({ book: tappedBook, start: next.start, end: next.end }),
        );
      } else {
        url.searchParams.delete("p");
      }
      window.history.replaceState(window.history.state, "", url);
      window.dispatchEvent(new Event(CHANGE_EVENT));
    },
    [selection, selectionBook],
  );

  const value = useMemo<ReaderSelection>(
    () => ({
      selection,
      selectionBook,
      passage:
        selection && selectionBook
          ? { book: selectionBook, start: selection.start, end: selection.end }
          : {
              book: current.book,
              start: { chapter: current.chapter, verse: 1 },
              end: { chapter: current.chapter, verse: current.lastVerse },
            },
      isWholeChapter: selection === null,
      currentBook: current.book,
      currentChapter: current.chapter,
      setCurrent,
      tap,
    }),
    [current, selection, selectionBook, setCurrent, tap],
  );

  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useReaderSelection(): ReaderSelection {
  const value = useContext(Context);
  if (!value) throw new Error("useReaderSelection must be used inside ReaderSelectionProvider");
  return value;
}
