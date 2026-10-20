"use client";

import { usePathname } from "next/navigation";
import { LISTENER_NAV, listenerScreen } from "@/shared/routes";
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

/** Header reference button (opens the book selector in M8). */
export function HeaderReference() {
  const { title } = listenerScreen(usePathname());
  return (
    <button
      type="button"
      aria-haspopup="dialog"
      className="shell-ref flex items-center gap-[7px] justify-self-center rounded-md px-4 py-1.5 font-serif text-[21px] tracking-[.03em] text-text hover:bg-[rgba(201,164,92,.08)] max-[520px]:px-2 max-[520px]:py-1 max-[520px]:text-lg"
    >
      {title}
      <small className="text-[11px] text-gold" aria-hidden="true">
        ▾
      </small>
    </button>
  );
}
