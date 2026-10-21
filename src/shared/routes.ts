/**
 * Route table for the app shell: the active nav item per screen (the header always shows Scripture navigation, see header-reference.ts).
 * Pages declare their own layout (right panel, player) by what they render.
 */

import { bookBySlug } from "./scripture/books";

/** `href` names the item (and what it highlights for); `go` is where its link leads, when different. */
export type NavItem = { href: string; label: string; go?: string };

export const LISTENER_NAV: readonly NavItem[] = [
  { href: "/", label: "Home" },
  { href: "/read", label: "Read Scripture" },
  // The method is already chosen, so this goes straight to choosing verses (then back to Steps).
  { href: "/memorize/steps", label: "Memorization Steps", go: "/memorize/range?from=steps" },
  { href: "/memorize/flashcards", label: "Flashcards", go: "/memorize/range?from=flashcards" },
];

export const ADMIN_NAV: readonly NavItem[] = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/upload", label: "Upload music" },
  { href: "/admin/library", label: "Track library" },
  { href: "/admin/timing", label: "Timing editor" },
  { href: "/admin/publish", label: "Preview & publish" },
];

export type ListenerScreen = {
  id: "home" | "read" | "choice" | "steps" | "cards" | "range" | "other";
  /** Sidebar item to highlight, or null. */
  nav: string | null;
};

/** "/read/1-john/3" -> "1 John 3". Unknown slugs are shown title-cased. */
export function readerTitle(pathname: string): string {
  const [, , slug = "john", chapter = "1"] = pathname.split("/");
  const decoded = decodeURIComponent(slug);
  const name =
    bookBySlug(decoded)?.name ??
    decoded
      .split("-")
      .filter(Boolean)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(" ");
  return `${name} ${chapter}`;
}

/** `from` is the `?from=` of the range page, which highlights the screen it will return to. */
export function listenerScreen(pathname: string, from?: string | null): ListenerScreen {
  const path = pathname.replace(/\/+$/, "") || "/";
  if (path === "/") return { id: "home", nav: "/" };
  if (path === "/read" || path.startsWith("/read/")) return { id: "read", nav: "/read" };
  // The method choice comes after selecting verses in the reader.
  if (path === "/memorize") return { id: "choice", nav: "/read" };
  if (path === "/memorize/steps") return { id: "steps", nav: "/memorize/steps" };
  if (path === "/memorize/flashcards") return { id: "cards", nav: "/memorize/flashcards" };
  if (path === "/memorize/range") {
    const nav =
      from === "flashcards"
        ? "/memorize/flashcards"
        : from === "read"
          ? "/read"
          : "/memorize/steps";
    return { id: "range", nav };
  }
  return { id: "other", nav: null };
}

/** The admin nav item a path belongs to (longest matching prefix). */
export function adminNavItem(pathname: string): NavItem | null {
  const path = pathname.replace(/\/+$/, "") || "/";
  const matches = ADMIN_NAV.filter(
    (item) => path === item.href || (item.href !== "/admin" && path.startsWith(item.href + "/")),
  );
  return matches.sort((a, b) => b.href.length - a.href.length)[0] ?? null;
}
