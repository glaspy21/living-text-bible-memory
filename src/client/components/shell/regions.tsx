import type { ReactNode } from "react";
import { cn } from "@/client/lib/cn";

/**
 * The page's central workspace (scrolls on its own). `player` shows the player row;
 * `screen="home"` gives phones the transparent header over the hero.
 */
export function Main({
  className,
  player = false,
  screen,
  children,
}: {
  className?: string;
  player?: boolean;
  screen?: "home";
  children: ReactNode;
}) {
  return (
    <main
      className={cn("shell-main", className)}
      data-player={player ? "" : undefined}
      data-screen={screen}
    >
      {children}
    </main>
  );
}

/** Contextual right panel (desktop only; hidden at ≤1100px). */
export function RightPanel({ label, children }: { label: string; children: ReactNode }) {
  return (
    <aside className="shell-right" aria-label={label}>
      {children}
    </aside>
  );
}

/** Page title + muted subtitle, as in the prototype (h1 34px, 24px on phones). */
export function PageTitle({ title, sub }: { title: string; sub?: string }) {
  return (
    <header className="mb-6">
      <h1 className="font-serif text-[34px] font-medium tracking-[.02em] text-heading max-[520px]:text-2xl">
        {title}
      </h1>
      {sub && <p className="mt-1 text-muted">{sub}</p>}
    </header>
  );
}

/** Marks a screen whose real content arrives in a later milestone. */
export function Placeholder({ milestone, children }: { milestone: string; children: ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-line p-6 text-muted">
      <p className="mb-1 text-[10.5px] tracking-[.16em] text-gold-dim uppercase">{milestone}</p>
      {children}
    </div>
  );
}
