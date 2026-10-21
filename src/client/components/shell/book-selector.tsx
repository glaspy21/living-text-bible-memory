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
}: {
  book: BookInfo;
  expanded: boolean;
  current: boolean;
  currentChapter: number | null;
  hasMusic: boolean;
  onToggle: () => void;
  onChoose: () => void;
  onSelect?: (book: BookInfo, chapter: number) => void;
}) {
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
        <span>{book.name}</span>
        {hasMusic && (
          <span
            className="inline-block h-1.5 w-1.5 rounded-full bg-gold shadow-[0_0_6px_var(--gold)]"
            role="img"
            aria-label="Music available"
          />
        )}
      </button>
      {expanded && (
        <div
          className="grid grid-cols-[repeat(auto-fill,minmax(46px,1fr))] gap-2 pt-1.5 pb-3"
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
      )}
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
  attached = true,
}: {
  anchor: PanelAnchor;
  currentBook: string | null;
  currentChapter: number | null;
  musicBooks: ReadonlySet<string>;
  onClose: () => void;
  /** Pick a chapter without leaving the page (otherwise chapters are links to the reader). */
  onSelect?: (book: BookInfo, chapter: number) => void;
  /** Joined to the header above it (square top) rather than floating under a control. */
  attached?: boolean;
}) {
  const currentTestament: Testament = NEW.some((b) => b.slug === currentBook) ? "NEW" : "OLD";
  const [tab, setTab] = useState<Testament>(currentTestament);
  const [expanded, setExpanded] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const newStartRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
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

  const rows = (books: BookInfo[]) =>
    books.map((book) => (
      <BookRow
        key={book.slug}
        book={book}
        expanded={expanded === book.slug}
        current={currentBook === book.slug}
        currentChapter={currentChapter}
        hasMusic={musicBooks.has(book.slug)}
        onToggle={() => setExpanded((open) => (open === book.slug ? null : book.slug))}
        onChoose={onClose}
        onSelect={
          onSelect &&
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
        aria-label="Choose a book and chapter"
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
