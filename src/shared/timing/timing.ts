/**
 * Verse timing as the editor sees it: one row per verse with a start and end inside the audio.
 * Pure rules only (no checking for gaps or overlaps: that is the validation module, M16).
 */

export type TimingRow = {
  chapter: number;
  verse: number;
  startMs: number | null;
  endMs: number | null;
  ackGap: boolean;
  ackOverlap: boolean;
  note?: string | null;
};

export type Boundary = "start" | "end";

/** "1:05.250", "65.25", "1:05" or "65" → milliseconds; null when it isn't a time. */
export function parseTimeInput(text: string): number | null {
  const t = text.trim();
  const m = /^(?:(\d+):)?(\d+)(?:[.,](\d{1,3}))?$/.exec(t);
  if (!m) return null;
  const minutes = m[1] ? Number(m[1]) : 0;
  const seconds = Number(m[2]);
  if (m[1] && seconds >= 60) return null;
  const millis = m[3] ? Number(m[3].padEnd(3, "0")) : 0;
  return (minutes * 60 + seconds) * 1000 + millis;
}

/** Milliseconds as "m:ss.mmm". Empty for nothing. */
export function formatTimeMs(ms: number | null | undefined): string {
  if (ms === null || ms === undefined || !Number.isFinite(ms)) return "";
  const total = Math.max(0, Math.round(ms));
  const minutes = Math.floor(total / 60000);
  const seconds = Math.floor((total % 60000) / 1000);
  const millis = total % 1000;
  return `${minutes}:${String(seconds).padStart(2, "0")}.${String(millis).padStart(3, "0")}`;
}

/** Rounds and keeps a time inside the recording. */
export function clampMs(ms: number, durationMs: number): number {
  return Math.min(Math.max(0, Math.round(ms)), Math.max(0, Math.round(durationMs)));
}

/**
 * Sets one boundary of one verse. The new value is kept inside the recording but is otherwise
 * taken as given: a start after an end, a gap or an overlap are shown by validation, never fixed
 * here. Acknowledgements for the gap/overlap next to the verse are cleared when a boundary moves.
 */
export function setBoundary(
  rows: readonly TimingRow[],
  index: number,
  which: Boundary,
  ms: number | null,
  durationMs: number,
): TimingRow[] {
  const row = rows[index];
  if (!row) return [...rows];
  const value = ms === null ? null : clampMs(ms, durationMs);
  const current = which === "start" ? row.startMs : row.endMs;
  if (value === current) return [...rows];
  return rows.map((r, i) => {
    if (i === index) {
      return {
        ...r,
        [which === "start" ? "startMs" : "endMs"]: value,
        ackGap: false,
        ackOverlap: false,
      };
    }
    // The verse before is affected by this verse's start; the one after by this verse's end.
    if ((which === "start" && i === index - 1) || (which === "end" && i === index + 1)) {
      return { ...r, ackGap: false, ackOverlap: false };
    }
    return r;
  });
}

/**
 * "Mark" at the playhead: the first verse with no start gets it as its start (and the verse
 * before, if it has no end yet, ends there); otherwise the first verse with a start but no end
 * gets it as its end. Returns the rows unchanged when every boundary is set.
 */
export function markAt(rows: readonly TimingRow[], ms: number, durationMs: number): TimingRow[] {
  const noStart = rows.findIndex((r) => r.startMs === null);
  const noEnd = rows.findIndex((r) => r.startMs !== null && r.endMs === null);
  // A started verse still open comes before the next unstarted one.
  if (noEnd !== -1 && (noStart === -1 || noEnd < noStart)) {
    return setBoundary(rows, noEnd, "end", ms, durationMs);
  }
  if (noStart === -1) return [...rows];
  let next = setBoundary(rows, noStart, "start", ms, durationMs);
  const before = noStart - 1;
  if (before >= 0 && next[before].endMs === null && next[before].startMs !== null) {
    next = setBoundary(next, before, "end", ms, durationMs);
  }
  return next;
}

export function filledCount(rows: readonly TimingRow[]): number {
  return rows.filter((r) => r.startMs !== null && r.endMs !== null).length;
}

/** True when two sheets hold exactly the same boundaries and acknowledgements. */
export function sameTiming(a: readonly TimingRow[], b: readonly TimingRow[]): boolean {
  return (
    a.length === b.length &&
    a.every((r, i) => {
      const o = b[i];
      return (
        r.chapter === o.chapter &&
        r.verse === o.verse &&
        r.startMs === o.startMs &&
        r.endMs === o.endMs &&
        r.ackGap === o.ackGap &&
        r.ackOverlap === o.ackOverlap
      );
    })
  );
}

// --- the waveform window -------------------------------------------------------------------

export type View = { startMs: number; pxPerSec: number };

export const MIN_PX_PER_SEC = 2;
export const MAX_PX_PER_SEC = 2000;

export function msToX(ms: number, view: View): number {
  return ((ms - view.startMs) / 1000) * view.pxPerSec;
}

export function xToMs(x: number, view: View): number {
  return view.startMs + (x / view.pxPerSec) * 1000;
}

/** The zoom that shows the whole recording across `widthPx`. */
export function fitPxPerSec(durationMs: number, widthPx: number): number {
  if (durationMs <= 0 || widthPx <= 0) return MIN_PX_PER_SEC;
  return Math.min(MAX_PX_PER_SEC, Math.max(MIN_PX_PER_SEC, (widthPx / durationMs) * 1000));
}

/** Keeps the window inside the recording (a window wider than the recording starts at 0). */
export function clampView(view: View, durationMs: number, widthPx: number): View {
  const pxPerSec = Math.min(MAX_PX_PER_SEC, Math.max(MIN_PX_PER_SEC, view.pxPerSec));
  const visibleMs = (widthPx / pxPerSec) * 1000;
  const maxStart = Math.max(0, durationMs - visibleMs);
  return { pxPerSec, startMs: Math.min(Math.max(0, view.startMs), maxStart) };
}

/** Zooms by `factor` keeping the time under `anchorX` where it is on screen. */
export function zoomAt(
  view: View,
  factor: number,
  anchorX: number,
  durationMs: number,
  widthPx: number,
): View {
  const anchorMs = xToMs(anchorX, view);
  const pxPerSec = Math.min(MAX_PX_PER_SEC, Math.max(MIN_PX_PER_SEC, view.pxPerSec * factor));
  const startMs = anchorMs - (anchorX / pxPerSec) * 1000;
  return clampView({ startMs, pxPerSec }, durationMs, widthPx);
}

/** A tick spacing for the ruler that keeps labels at least ~70px apart. */
export function rulerStepMs(pxPerSec: number): number {
  const steps = [10, 20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 15000, 30000, 60000, 120000];
  const wanted = (70 / pxPerSec) * 1000;
  return steps.find((s) => s >= wanted) ?? steps[steps.length - 1];
}

/** Which handle (if any) is within `reachPx` of x; the nearest wins. */
export function hitHandle(
  rows: readonly TimingRow[],
  x: number,
  view: View,
  reachPx = 6,
): { index: number; which: Boundary } | null {
  let best: { index: number; which: Boundary; d: number } | null = null;
  rows.forEach((r, index) => {
    for (const which of ["start", "end"] as const) {
      const ms = which === "start" ? r.startMs : r.endMs;
      if (ms === null) continue;
      const d = Math.abs(msToX(ms, view) - x);
      if (d <= reachPx && (!best || d < best.d)) best = { index, which, d };
    }
  });
  return best
    ? { index: (best as { index: number }).index, which: (best as { which: Boundary }).which }
    : null;
}
