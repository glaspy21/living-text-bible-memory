/**
 * Turning a passage plus published recordings into what the player plays: one segment per verse.
 * Rules (ARCHITECTURE.md §5): a verse is played from the recording that covers it in the chosen
 * genre (preferring the chosen recording, then the earliest arrangement); a verse nothing covers
 * is marked uncovered, never filled from another genre.
 */
import type { VerseRef } from "../scripture/types";

/** One verse's boundaries inside a recording. Either may be unset in an unfinished timing. */
export type VerseTimingRow = {
  chapter: number;
  verse: number;
  startMs: number | null;
  endMs: number | null;
};

/** A published recording with its published timing. */
export type PlayableRecording = {
  id: string;
  assetId: string;
  genreSlug: string;
  /** 1 = "Default", 2 = "Default 2", … */
  arrangementNo: number;
  durationMs: number;
  verses: readonly VerseTimingRow[];
};

/** The slice of a recording that sings one verse. */
export type Segment = {
  recordingId: string;
  assetId: string;
  chapter: number;
  verse: number;
  startMs: number;
  endMs: number;
};

/** A verse's usable timing in a recording, or null if it has none (missing or not a forward span). */
function timingFor(recording: PlayableRecording, ref: VerseRef): [number, number] | null {
  const row = recording.verses.find((v) => v.chapter === ref.chapter && v.verse === ref.verse);
  if (!row || row.startMs === null || row.endMs === null) return null;
  if (row.startMs < 0 || row.endMs <= row.startMs || row.endMs > recording.durationMs) return null;
  return [row.startMs, row.endMs];
}

/** Earliest arrangement first; the chosen recording ahead of the others. */
function ordered(recordings: readonly PlayableRecording[], preferredId?: string) {
  return [...recordings].sort(
    (a, b) =>
      Number(b.id === preferredId) - Number(a.id === preferredId) ||
      a.arrangementNo - b.arrangementNo ||
      a.id.localeCompare(b.id),
  );
}

/** One entry per verse of the passage, in order: its segment, or null when no recording covers it. */
export function resolveSegments(
  verses: readonly VerseRef[],
  recordings: readonly PlayableRecording[],
  genreSlug: string,
  preferredRecordingId?: string,
): (Segment | null)[] {
  const candidates = ordered(
    recordings.filter((r) => r.genreSlug === genreSlug),
    preferredRecordingId,
  );
  return verses.map((ref) => {
    for (const recording of candidates) {
      const span = timingFor(recording, ref);
      if (span) {
        return {
          recordingId: recording.id,
          assetId: recording.assetId,
          chapter: ref.chapter,
          verse: ref.verse,
          startMs: span[0],
          endMs: span[1],
        };
      }
    }
    return null;
  });
}

export type GenreCoverage = {
  genreSlug: string;
  covered: number;
  total: number;
  /** Every verse of the passage has music in this genre. */
  complete: boolean;
};

/** For each genre that has any music for the passage, how much of it is covered. Complete genres first. */
export function genreCoverage(
  verses: readonly VerseRef[],
  recordings: readonly PlayableRecording[],
): GenreCoverage[] {
  const genres = [...new Set(recordings.map((r) => r.genreSlug))];
  return genres
    .map((genreSlug) => {
      const covered = resolveSegments(verses, recordings, genreSlug).filter(Boolean).length;
      return { genreSlug, covered, total: verses.length, complete: covered === verses.length };
    })
    .filter((g) => g.covered > 0)
    .sort(
      (a, b) =>
        Number(b.complete) - Number(a.complete) ||
        b.covered - a.covered ||
        a.genreSlug.localeCompare(b.genreSlug),
    );
}

/** Index of the nearest covered verse at or after `from` (step 1) or at or before it (step -1). */
export function nearestCovered(
  segments: readonly (Segment | null)[],
  from: number,
  step: 1 | -1,
): number | null {
  for (let i = from; i >= 0 && i < segments.length; i += step) if (segments[i]) return i;
  return null;
}
