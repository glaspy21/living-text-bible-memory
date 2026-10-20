"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { Sun } from "@/client/components/ui/sun";
import { ADMIN_NAV, adminNavItem } from "@/shared/routes";
import { Brand } from "./brand";
import { NavLink } from "./side-nav";

/** Admin frame: sidebar 230 | main, no player, no right panel. Desktop-first. */
export function AdminShell({
  email,
  signOutAction,
  children,
}: {
  email: string;
  signOutAction: () => Promise<void>;
  children: ReactNode;
}) {
  const current = adminNavItem(usePathname());
  return (
    <div className="app admin">
      <Sun />
      <header className="shell-header">
        <Brand admin />
        <span className="justify-self-center font-serif text-[21px] tracking-[.03em] text-text">
          {current?.label ?? "Administrator"}
        </span>
        <div className="flex items-center gap-[14px] justify-self-end px-[18px]">
          <span className="rounded-full border border-line px-[10px] py-1 text-xs text-gold2">
            {email}
          </span>
          <Link
            href="/"
            className="rounded-[7px] border border-line px-3 py-[5px] text-xs text-muted hover:text-text"
          >
            Exit admin
          </Link>
        </div>
      </header>
      <aside className="shell-side">
        <nav aria-label="Admin">
          {ADMIN_NAV.map((item) => (
            <NavLink key={item.href} href={item.href} active={current?.href === item.href}>
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="mt-[26px]">
          <Link href="/" className="block rounded-md px-3 py-[9px] text-gold-dim hover:text-gold">
            ← Listener app
          </Link>
          <form action={signOutAction}>
            <button
              type="submit"
              className="block w-full rounded-md px-3 py-[9px] text-left text-muted hover:text-text"
            >
              Sign out
            </button>
          </form>
        </div>
      </aside>
      {children}
    </div>
  );
}
