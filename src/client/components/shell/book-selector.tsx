"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { BOOKS, type BookInfo } from "@/shared/scripture/books";
import { cn } from "@/client/lib/cn";

const OLD = BOOKS.filter((b) => b.testament === "OLD");
const NEW = BOOKS.filter((b) => b.testament === "NEW");

type Testament = "OLD" | "NEW";

/** Where the panel sits: directly under the header, centred on the clicked control. */
export type PanelAnchor = { top: number; left: number; width: number };

/**
 * Place the panel under a control, inside the window. `center` is for the header button (panel
 * attached to the header, centred on the button); `left` lines up with a control's left edge.
 */
export function anchorBelow(
  control: DOMRect,
  below: number,
  viewportWidth: number,
  align: "center" | "left" = "center",
): PanelAnchor {
  const width =
    align === "left"
      ? Math.min(Math.max(control.width, 480), viewportWidth - 32)
      : Math.min(560, viewportWidth - 32);
  const wanted = align === "left" ? control.left : control.left + control.width / 2 - width / 2;
  const left = Math.max(16, Math.min(viewportWidth - width - 16, wanted));
  return { top: Math.round(below), left: Math.round(left), width };
}

function BookRow({
  book,
  expanded,
  current,
  currentChapter,
  hasMusic,
  onToggle,
  onChoose,
  onSelect,
  pickedChapter,
  verseCount,
  versesFailed,
  onBack,
}: {
  book: BookInfo;
  expanded: boolean;
  current: boolean;
  currentChapter: number | null;
  hasMusic: boolean;
  onToggle: () => void;
  onChoose: () => void;
  onSelect?: (book: BookInfo, chapter: number) => void;
  /** The chapter chosen in this book: its number joins the title and the verses replace the chapters. */
  pickedChapter?: number | null;
  /** Verses in the picked chapter; undefined while loading. */
  verseCount?: number;
  versesFailed?: boolean;
  onBack?: () => void;
}) {
  const chapterHref = `/read/${book.slug}/${pickedChapter}`; // verse links add ?v=
  return (
    <div>
      <button
        type="button"
        aria-expanded={expanded}
        onClick={onToggle}
        className={cn(
          "flex w-full items-center justify-between px-1 py-[9px] text-left font-serif text-xl hover:text-text",
          current || expanded ? "text-gold2" : "text-muted",
        )}
      >
        <span>
          {book.name}
          {pickedChapter ? (
            <>
              {" "}
              <span className="ml-1 text-gold-bright">{pickedChapter}</span>
            </>
          ) : null}
        </span>
        {hasMusic && (
          <span
            className="inline-block h-1.5 w-1.5 rounded-full bg-gold shadow-[0_0_6px_var(--gold)]"
            role="img"
            aria-label="Music available"
          />
        )}
      </button>
      {expanded && pickedChapter ? (
        <div className="pt-1.5 pb-3" data-testid="verse-step">
          <div className="mb-2.5 grid grid-cols-[1fr_auto_1fr] items-center gap-3">
            <button
              type="button"
              onClick={onBack}
              aria-label={`Back to ${book.name} chapters`}
              className="justify-self-start font-serif text-lg text-gold hover:text-gold2"
            >
              ← Chapters
            </button>
            <h3 className="font-serif text-lg text-gold">Verse</h3>
            <span aria-hidden="true" />
          </div>
          {verseCount === undefined && !versesFailed && (
            <p className="text-muted">Loading verses…</p>
          )}
          {versesFailed && (
            <p className="text-muted" role="status">
              The verses could not be loaded. You can still read the whole chapter.
            </p>
          )}
          {verseCount !== undefined && (
            <div
              className="grid grid-cols-[repeat(auto-fill,minmax(46px,1fr))] gap-2"
              role="group"
              aria-label={`${book.name} ${pickedChapter} verses`}
            >
              {Array.from({ length: verseCount }, (_, i) => i + 1).map((verse) => (
                <Link
                  key={verse}
                  href={`${chapterHref}?v=${verse}`}
                  prefetch={false}
                  onClick={onChoose}
                  className="grid h-10 place-items-center rounded-[7px] border border-line bg-[#101010] font-serif text-[18px] hover:border-gold"
                >
                  {verse}
                </Link>
              ))}
            </div>
          )}
        </div>
      ) : expanded ? (
        <div className="pt-1.5 pb-3">
          <h3 className="mb-2.5 text-center font-serif text-lg text-gold">Chapter</h3>
          <div
            className="grid grid-cols-[repeat(auto-fill,minmax(46px,1fr))] gap-2"
            role="group"
            aria-label={`${book.name} chapters`}
          >
            {Array.from({ length: book.chapterCount }, (_, i) => i + 1).map((chapter) => {
              const isCurrent = current && currentChapter === chapter;
              const cell = cn(
                "grid h-10 place-items-center rounded-[7px] border font-serif text-[18px]",
                isCurrent
                  ? "border-[#e8cb8a] bg-gradient-to-b from-[#e8c97e] to-[#c99c44] text-[#17110a]"
                  : "border-line bg-[#101010] hover:border-gold",
              );
              return onSelect ? (
                <button
                  key={chapter}
                  type="button"
                  onClick={() => onSelect(book, chapter)}
                  aria-current={isCurrent ? "true" : undefined}
                  className={cell}
                >
                  {chapter}
                </button>
              ) : (
                <Link
                  key={chapter}
                  href={`/read/${book.slug}/${chapter}`}
                  prefetch={false}
                  onClick={onChoose}
                  aria-current={isCurrent ? "page" : undefined}
                  className={cell}
                >
                  {chapter}
                </Link>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}

/**
 * One continuous list, Old Testament then New Testament. The tab underline follows the scroll
 * position; clicking a tab scrolls to its section. Opens at the current book's testament.
 */
export function BookSelectorPanel({
  anchor,
  currentBook,
  currentChapter,
  musicBooks,
  onClose,
  onSelect,
  withVerses = false,
  onPreview,
  attached = true,
}: {
  anchor: PanelAnchor;
  currentBook: string | null;
  currentChapter: number | null;
  musicBooks: ReadonlySet<string>;
  onClose: () => void;
  /** Pick a chapter without leaving the page (otherwise chapters are links to the reader). */
  onSelect?: (book: BookInfo, chapter: number) => void;
  /**
   * Choosing a chapter opens a verse menu (instead of going straight to the chapter) so a verse
   * can be reached directly; `onPreview` tells the header which chapter to show beside the book
   * name while that menu is up, and null when it is gone.
   */
  withVerses?: boolean;
  onPreview?: (picked: { book: string; chapter: number } | null) => void;
  /** Joined to the header above it (square top) rather than floating under a control. */
  attached?: boolean;
}) {
  const currentTestament: Testament = NEW.some((b) => b.slug === currentBook) ? "NEW" : "OLD";
  const [tab, setTab] = useState<Testament>(currentTestament);
  const [expanded, setExpanded] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const newStartRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const [picked, setPicked] = useState<{ book: BookInfo; chapter: number } | null>(null);
  // Verses per chapter, by book; null once a lookup has failed (the chapter can still be opened).
  const [counts, setCounts] = useState<Record<string, number[] | null>>({});
  const scrollingToTab = useRef(false);
  const unlock = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const sectionTop = (testament: Testament) =>
    testament === "NEW" ? Math.max(0, (newStartRef.current?.offsetTop ?? 0) - 4) : 0;

  // Open at the current book's testament, and put keyboard focus in the panel.
  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = sectionTop(currentTestament);
    dialogRef.current?.focus();
    return () => clearTimeout(unlock.current);
    // Runs once, on open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onScroll = () => {
    if (scrollingToTab.current || !listRef.current || !newStartRef.current) return;
    setTab(listRef.current.scrollTop + 40 >= newStartRef.current.offsetTop ? "NEW" : "OLD");
  };

  const goToTab = (testament: Testament) => {
    setTab(testament);
    scrollingToTab.current = true;
    clearTimeout(unlock.current);
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    listRef.current?.scrollTo({
      top: sectionTop(testament),
      behavior: reduced ? "auto" : "smooth",
    });
    unlock.current = setTimeout(() => (scrollingToTab.current = false), 600);
  };

  const pick = (book: BookInfo, chapter: number) => {
    setPicked({ book, chapter });
    onPreview?.({ book: book.slug, chapter });
    // The clicked chapter button is about to be replaced; keep the keyboard (Escape) in the panel.
    dialogRef.current?.focus();
    if (counts[book.slug] !== undefined) return;
    fetch(`/api/scripture/verse-counts?book=${encodeURIComponent(book.slug)}`)
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error("failed"))))
      .then((body: { counts: number[] }) => setCounts((c) => ({ ...c, [book.slug]: body.counts })))
      .catch(() => setCounts((c) => ({ ...c, [book.slug]: null })));
  };
  const back = () => {
    setPicked(null);
    onPreview?.(null);
    dialogRef.current?.focus();
  };

  const rows = (books: BookInfo[]) =>
    books.map((book) => (
      <BookRow
        key={book.slug}
        book={book}
        expanded={expanded === book.slug}
        current={currentBook === book.slug}
        currentChapter={currentChapter}
        hasMusic={musicBooks.has(book.slug)}
        onToggle={() => {
          // Opening another book (or closing this one) drops a chosen chapter.
          if (picked) back();
          setExpanded((open) => (open === book.slug ? null : book.slug));
        }}
        pickedChapter={picked?.book.slug === book.slug ? picked.chapter : null}
        verseCount={
          picked?.book.slug === book.slug ? counts[book.slug]?.[picked.chapter - 1] : undefined
        }
        versesFailed={counts[book.slug] === null}
        onBack={back}
        onChoose={onClose}
        onSelect={
          withVerses
            ? pick
            : onSelect &&
              ((b, c) => {
                onSelect(b, c);
                onClose();
              })
        }
      />
    ));

  return createPortal(
    <>
      <div
        className="fixed inset-x-0 bottom-0 z-40 bg-black/55"
        style={{ top: anchor.top }}
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        ref={dialogRef}
        role="dialog"
        aria-label={withVerses ? "Choose a book, chapter and verse" : "Choose a book and chapter"}
        tabIndex={-1}
        onKeyDown={(event) => event.key === "Escape" && onClose()}
        className={cn(
          "popin fixed z-50 flex flex-col border border-line2 bg-[#0a0a0a] shadow-[0_30px_60px_rgba(0,0,0,.8)] outline-none",
          attached ? "rounded-b-xl border-t-0" : "rounded-xl",
        )}
        style={{
          top: anchor.top,
          left: anchor.left,
          width: anchor.width,
          maxHeight: `calc(100dvh - ${anchor.top + 16}px)`,
        }}
      >
        <div className="relative grid grid-cols-2 border-b border-line">
          {(["OLD", "NEW"] as const).map((testament) => (
            <button
              key={testament}
              type="button"
              aria-pressed={tab === testament}
              onClick={() => goToTab(testament)}
              className={cn(
                "p-3.5 font-serif text-lg transition-colors duration-300",
                tab === testament ? "text-gold2" : "text-muted",
              )}
            >
              {testament === "OLD" ? "Old Testament" : "New Testament"}
            </button>
          ))}
          <i
            className="pointer-events-none absolute bottom-[-1px] left-0 h-0.5 w-1/2 bg-gold transition-transform duration-[170ms] ease-[cubic-bezier(.4,0,.2,1)]"
            style={{ transform: `translateX(${tab === "NEW" ? 100 : 0}%)` }}
            aria-hidden="true"
          />
        </div>
        <div
          ref={listRef}
          onScroll={onScroll}
          className="relative overflow-auto px-[18px] pt-2 pb-[18px]"
        >
          {rows(OLD)}
          <div ref={newStartRef} aria-hidden="true" />
          {rows(NEW)}
        </div>
      </div>
    </>,
    document.body,
  );
}
