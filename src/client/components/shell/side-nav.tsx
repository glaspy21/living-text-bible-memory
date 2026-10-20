import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/client/lib/cn";

/** Sidebar nav item; the active one gets the gold inset bar. */
export function NavLink({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex w-full items-center gap-[10px] rounded-md px-3 py-[9px] text-left",
        active
          ? "bg-[rgba(201,164,92,.09)] text-gold2 shadow-[inset_2px_0_var(--gold)]"
          : "text-muted hover:text-text",
      )}
    >
      {children}
    </Link>
  );
}

/** Small-caps section label, e.g. "RECENTLY STUDIED". */
export function SideHeading({ children }: { children: ReactNode }) {
  return (
    <h4 className="mx-3 mt-[22px] mb-2 text-[10.5px] font-medium tracking-[.16em] text-gold-dim uppercase">
      {children}
    </h4>
  );
}
