"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { CHAPTER_VIEW_EVENT, type ChapterViewDetail } from "@/client/lib/chapter-view";
import { useRecent } from "@/client/lib/recent-store";
import { headerReference, previewLabel } from "@/shared/scripture/header-reference";
import { LISTENER_NAV, listenerScreen } from "@/shared/routes";
import { BookSelectorPanel, anchorBelow, type PanelAnchor } from "./book-selector";
import { NavLink } from "./side-nav";

export function ListenerNavLinks({ active }: { active: string | null }) {
  return (
    <nav aria-label="Main">
      {LISTENER_NAV.map((item) => (
        <NavLink key={item.href} href={item.href} active={active === item.href}>
          {item.label}
        </NavLink>
      ))}
    </nav>
  );
}

/** Sidebar nav with the current page highlighted. */
export function ListenerNav() {
  return <ListenerNavLinks active={listenerScreen(usePathname()).nav} />;
}

/**
 * Header reference button ("John 3 ▾"): always Scripture navigation, never the page name. Opens
 * the book selector beneath it: books, then chapters, then (once a chapter is chosen, which
 * appears beside the book name) a verse menu that opens the reader at that verse.
 * `musicBooks` are the slugs of books with published music (a dot beside each).
 */
export function HeaderReference({ musicBooks = [] }: { musicBooks?: readonly string[] }) {
  const pathname = usePathname();
  const passage = useSearchParams().get("p");
  const lastRead = useRecent()[0] ?? null;
  // While reading on into the next chapters, the reader reports the chapter in view.
  const [viewing, setViewing] = useState<ChapterViewDetail | null>(null);
  useEffect(() => {
    const onView = (event: Event) => setViewing((event as CustomEvent<ChapterViewDetail>).detail);
    window.addEventListener(CHAPTER_VIEW_EVENT, onView);
    return () => window.removeEventListener(CHAPTER_VIEW_EVENT, onView);
  }, []);
  const current =
    viewing && viewing.base === pathname
      ? headerReference(`/read/${viewing.book}/${viewing.chapter}`, null)
      : headerReference(pathname, passage, lastRead);
  const [openOn, setOpenOn] = useState<string | null>(null);
  const [anchor, setAnchor] = useState<PanelAnchor | null>(null);
  // The chapter picked in the selector, shown beside the book name until it is opened or dropped.
  const [preview, setPreview] = useState<{ book: string; chapter: number } | null>(null);
  const button = useRef<HTMLButtonElement>(null);
  // Open only for the page it was opened on, so any navigation closes it.
  const open = openOn === pathname && anchor !== null;

  const toggle = () => {
    if (open) return close();
    const control = button.current?.getBoundingClientRect();
    const header = button.current?.closest("header")?.getBoundingClientRect();
    if (!control || !header) return;
    setAnchor(anchorBelow(control, header.bottom, window.innerWidth));
    setOpenOn(pathname);
  };
  const close = () => {
    setOpenOn(null);
    setPreview(null);
    button.current?.focus();
  };

  return (
    <>
      <button
        ref={button}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={toggle}
        className="shell-ref flex items-center gap-[7px] justify-self-center rounded-md px-4 py-1.5 font-serif text-[21px] tracking-[.03em] text-text hover:bg-[rgba(201,164,92,.08)] max-[520px]:px-2 max-[520px]:py-1 max-[520px]:text-lg"
      >
        {open && preview ? previewLabel(preview.book, preview.chapter) : current.label}
        <small className="text-[11px] text-gold" aria-hidden="true">
          ▾
        </small>
      </button>
      {open && anchor && (
        <BookSelectorPanel
          anchor={anchor}
          currentBook={current.book}
          currentChapter={current.chapter}
          musicBooks={new Set(musicBooks)}
          onClose={close}
          withVerses
          onPreview={setPreview}
        />
      )}
    </>
  );
}
