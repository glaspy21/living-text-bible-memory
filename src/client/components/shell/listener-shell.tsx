import Link from "next/link";
import { Suspense, type ReactNode } from "react";
import { RecentSideList } from "@/client/components/recent/recent-side-list";
import { Icon } from "@/client/components/ui/icons";
import { Sun } from "@/client/components/ui/sun";
import { Brand } from "./brand";
import { HeaderReference, ListenerNav, ListenerNavLinks } from "./listener-nav";
import { PlayerBar } from "./player-bar";
import { SideHeading } from "./side-nav";

/**
 * Listener frame: header, sidebar and player stay mounted across pages (so the
 * sun animation and, later, audio never restart). Pages render <Main> + optional <RightPanel>;
 * the grid adapts to them in CSS. Only the URL-dependent bits stream in under Suspense.
 */
export function ListenerShell({
  children,
  reference,
  translation,
}: {
  children: ReactNode;
  /** The header's reference button; the layout passes it with the music data it needs. */
  reference?: ReactNode;
  /** The header's translation control; the layout passes it with the visitor's choice. */
  translation?: ReactNode;
}) {
  return (
    <div className="app">
      <Sun />
      <header className="shell-header">
        <Brand />
        {reference ?? (
          <Suspense fallback={<span />}>
            <HeaderReference />
          </Suspense>
        )}
        <div className="flex items-center gap-[14px] justify-self-end px-[18px] max-[520px]:gap-[10px] max-[520px]:px-[14px]">
          {translation ?? <span className="shell-esv font-serif text-lg text-text">WEB</span>}
          <button
            type="button"
            className="shell-more font-bold tracking-[3px] text-gold"
            aria-label="More"
          >
            •••
          </button>
          <button type="button" className="shell-gear text-gold" aria-label="Settings">
            <Icon name="settings" size={22} />
          </button>
        </div>
      </header>
      <aside className="shell-side">
        <Suspense fallback={<ListenerNavLinks active={null} />}>
          <ListenerNav />
        </Suspense>
        <SideHeading>Recently studied</SideHeading>
        <RecentSideList />
        <div className="mt-[26px]">
          <Link
            href="/admin"
            className="block rounded-md px-3 py-[9px] text-gold-dim hover:text-gold"
          >
            Administrator →
          </Link>
        </div>
      </aside>
      {children}
      <PlayerBar />
    </div>
  );
}
