/**
 * Route table for the app shell: the header title and active nav item per screen.
 * Pages declare their own layout (right panel, player) by what they render.
 */

export type NavItem = { href: string; label: string };

export const LISTENER_NAV: readonly NavItem[] = [
  { href: "/", label: "Home" },
  { href: "/read", label: "Read Scripture" },
  { href: "/memorize", label: "Memorize" },
  { href: "/memorize/flashcards", label: "Flashcards" },
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
  /** Text in the header's reference button. */
  title: string;
  /** Sidebar item to highlight, or null. */
  nav: string | null;
};

/** "/read/1-john/3" -> "1 John 3". Placeholder until book data arrives (M4/M8). */
export function readerTitle(pathname: string): string {
  const [, , book = "john", chapter = "1"] = pathname.split("/");
  const name = decodeURIComponent(book)
    .split("-")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
  return `${name} ${chapter}`;
}

export function listenerScreen(pathname: string): ListenerScreen {
  const path = pathname.replace(/\/+$/, "") || "/";
  if (path === "/") return { id: "home", title: "Home", nav: "/" };
  if (path === "/read" || path.startsWith("/read/"))
    return { id: "read", title: readerTitle(path), nav: "/read" };
  if (path === "/memorize") return { id: "choice", title: "Memorize", nav: "/memorize" };
  if (path === "/memorize/steps") return { id: "steps", title: "Memorize", nav: "/memorize" };
  if (path === "/memorize/flashcards")
    return { id: "cards", title: "Flashcards", nav: "/memorize/flashcards" };
  if (path === "/memorize/range") return { id: "range", title: "Verse range", nav: "/memorize" };
  return { id: "other", title: "Living Text", nav: null };
}

/** The admin nav item a path belongs to (longest matching prefix). */
export function adminNavItem(pathname: string): NavItem | null {
  const path = pathname.replace(/\/+$/, "") || "/";
  const matches = ADMIN_NAV.filter(
    (item) => path === item.href || (item.href !== "/admin" && path.startsWith(item.href + "/")),
  );
  return matches.sort((a, b) => b.href.length - a.href.length)[0] ?? null;
}
