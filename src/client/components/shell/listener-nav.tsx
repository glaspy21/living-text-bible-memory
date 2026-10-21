"use client";

import { usePathname } from "next/navigation";
import { useRef, useState } from "react";
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
 * Header reference button ("John 1 ▾"). Opens the book and chapter selector beneath it.
 * `musicBooks` are the slugs of books with published music (a dot beside each).
 */
export function HeaderReference({ musicBooks = [] }: { musicBooks?: readonly string[] }) {
  const pathname = usePathname();
  const { title } = listenerScreen(pathname);
  const [openOn, setOpenOn] = useState<string | null>(null);
  const [anchor, setAnchor] = useState<PanelAnchor | null>(null);
  const button = useRef<HTMLButtonElement>(null);
  // Open only for the page it was opened on, so any navigation closes it.
  const open = openOn === pathname && anchor !== null;

  const toggle = () => {
    if (open) return setOpenOn(null);
    const control = button.current?.getBoundingClientRect();
    const header = button.current?.closest("header")?.getBoundingClientRect();
    if (!control || !header) return;
    setAnchor(anchorBelow(control, header.bottom, window.innerWidth));
    setOpenOn(pathname);
  };
  const close = () => {
    setOpenOn(null);
    button.current?.focus();
  };

  const [, , slug = null, chapter = null] = pathname.startsWith("/read/")
    ? pathname.split("/")
    : [];

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
        {title}
        <small className="text-[11px] text-gold" aria-hidden="true">
          ▾
        </small>
      </button>
      {open && anchor && (
        <BookSelectorPanel
          anchor={anchor}
          currentBook={slug ? decodeURIComponent(slug) : null}
          currentChapter={chapter && /^\d+$/.test(chapter) ? Number(chapter) : null}
          musicBooks={new Set(musicBooks)}
          onClose={close}
        />
      )}
    </>
  );
}
