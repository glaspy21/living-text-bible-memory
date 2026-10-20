/** Title Case for custom genre names, e.g. "gospel   choir" -> "Gospel Choir". */
export function titleCase(input: string): string {
  return input
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}
