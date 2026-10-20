/** Parse ADMIN_EMAILS ("a@x.com, b@y.com") into a normalized set. Empty means nobody is admin. */
export function parseAllowlist(raw: string | undefined): Set<string> {
  return new Set(
    (raw ?? "")
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean),
  );
}

export function isAdminEmail(
  email: string | null | undefined,
  raw: string | undefined = process.env.ADMIN_EMAILS,
): boolean {
  return !!email && parseAllowlist(raw).has(email.trim().toLowerCase());
}

/** Only same-site paths are allowed as post-sign-in destinations (no open redirects). */
export function safeCallbackPath(value: unknown, fallback = "/admin"): string {
  return typeof value === "string" &&
    value.startsWith("/") &&
    !value.startsWith("//") &&
    !value.includes("\\")
    ? value
    : fallback;
}
