/** HTTP Range header parsing for audio seeking (a single "bytes=" range). */

export type ByteRange = { start: number; end: number }; // inclusive, like HTTP

export type RangeResult =
  { kind: "full" } | { kind: "partial"; range: ByteRange } | { kind: "unsatisfiable" };

/**
 * Resolve a Range header against a file size. Browsers use "bytes=START-", "bytes=START-END"
 * and "bytes=-SUFFIX". Malformed headers are ignored (full response), as the spec allows.
 * Multiple ranges are not supported and are served in full.
 */
export function parseRange(header: string | null | undefined, size: number): RangeResult {
  if (!header) return { kind: "full" };
  const match = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!match) return { kind: "full" };
  const [, rawStart, rawEnd] = match;
  if (rawStart === "" && rawEnd === "") return { kind: "full" };

  let start: number;
  let end: number;
  if (rawStart === "") {
    const suffix = Number(rawEnd);
    if (suffix === 0) return { kind: "unsatisfiable" };
    start = Math.max(0, size - suffix);
    end = size - 1;
  } else {
    start = Number(rawStart);
    end = rawEnd === "" ? size - 1 : Math.min(Number(rawEnd), size - 1);
  }
  if (!Number.isSafeInteger(start) || start >= size || end < start) {
    return { kind: "unsatisfiable" };
  }
  return { kind: "partial", range: { start, end } };
}
