/**
 * The listener's playback state machine, as a pure function: (state, event, segments) →
 * (state, effects). The audio element and the animation-frame loop live elsewhere and only
 * send events and carry out effects, so every transition can be tested without a browser.
 *
 * Rules (ARCHITECTURE.md §5, PROJECT.md §4):
 * - Audio starts only on an explicit PLAY (or a SEEK_VERSE/SKIP made while already playing).
 * - End modes: loop replays the verse; stop pauses at its end; next moves to the next verse's
 *   START (so gaps are skipped, overlaps honored). The last verse of the passage always stops.
 * - Verses with no music are skipped in every direction.
 */
import { nearestCovered, type Segment } from "./playlist";

export type EndMode = "loop" | "stop" | "next";
export type Status = "idle" | "loading" | "playing" | "paused" | "verseEnded";

export type PlayerState = {
  status: Status;
  /** Current verse: an index into the passage's verses. */
  index: number;
  endMode: EndMode;
  /** The asset currently loaded in the audio element. */
  loadedAssetId: string | null;
  /** A seek we asked for and have not seen land yet; ticks are ignored until it does. */
  pendingSeekMs: number | null;
  /** The asset we already told the host to preload, so we ask once. */
  preloadedAssetId: string | null;
  /** True when PLAY should continue from where we paused rather than restart the verse. */
  resume: boolean;
  error: string | null;
};

export type PlayerEvent =
  | { type: "PLAY" }
  | { type: "PAUSE" }
  | { type: "SEEK_VERSE"; index: number }
  | { type: "SKIP"; step: 1 | -1 }
  /** The element's position, from the animation-frame loop. */
  | { type: "TICK"; ms: number }
  /** The audio file reached its end. */
  | { type: "ENDED" }
  | { type: "LOADED"; assetId: string }
  | { type: "SEEKED" }
  | { type: "ERROR"; message: string }
  | { type: "SET_END_MODE"; mode: EndMode }
  /** A different passage or genre: start again at `index` without playing. */
  | { type: "RESET"; index?: number };

export type Effect =
  | { type: "load"; assetId: string; seekMs: number; play: boolean }
  | { type: "seek"; ms: number }
  | { type: "play" }
  | { type: "pause" }
  | { type: "preload"; assetId: string };

export type Segments = readonly (Segment | null)[];

/** End-of-verse detection looks this far ahead (about one frame), since `timeupdate` is too coarse. */
export const LOOKAHEAD_MS = 20;
/** Start loading the next recording this long before the current verse ends. */
export const PRELOAD_MS = 5000;
/** A seek counts as landed when the position is this close to where we asked. */
export const SEEK_TOLERANCE_MS = 150;
/** Moving to a verse that starts where we already are needs no seek. */
export const CONTIGUOUS_MS = 40;

export const initialState = (endMode: EndMode, index = 0): PlayerState => ({
  status: "idle",
  index,
  endMode,
  loadedAssetId: null,
  pendingSeekMs: null,
  preloadedAssetId: null,
  resume: false,
  error: null,
});

type Result = { state: PlayerState; effects: Effect[] };
const done = (state: PlayerState, effects: Effect[] = []): Result => ({ state, effects });

/** Begin the verse at `index` from its start. */
function startVerse(state: PlayerState, segments: Segments, index: number, play: boolean): Result {
  const segment = segments[index];
  if (!segment) return done(state);
  const base = { ...state, index, resume: false, error: null, preloadedAssetId: null };
  if (state.loadedAssetId === segment.assetId) {
    const effects: Effect[] = [{ type: "seek", ms: segment.startMs }];
    if (play) effects.push({ type: "play" });
    return done(
      { ...base, status: play ? "playing" : "paused", pendingSeekMs: segment.startMs },
      effects,
    );
  }
  return done(
    {
      ...base,
      status: play ? "loading" : "paused",
      loadedAssetId: null,
      pendingSeekMs: segment.startMs,
    },
    [{ type: "load", assetId: segment.assetId, seekMs: segment.startMs, play }],
  );
}

/** The current verse has ended: do what the end mode says. */
function verseEnded(state: PlayerState, segments: Segments, positionMs: number): Result {
  const current = segments[state.index];
  if (state.endMode === "loop" && current) return startVerse(state, segments, state.index, true);

  if (state.endMode === "next") {
    const next = nearestCovered(segments, state.index + 1, 1);
    if (next !== null) {
      const target = segments[next]!;
      const sameFile = state.loadedAssetId === target.assetId;
      if (sameFile && Math.abs(target.startMs - positionMs) <= CONTIGUOUS_MS) {
        // The next verse begins right here: carry on without a seek.
        return done({ ...state, index: next, resume: false, preloadedAssetId: null });
      }
      return startVerse(state, segments, next, true);
    }
  }
  // Stop mode, or the last verse of the passage: pause at the end.
  return done({ ...state, status: "verseEnded", resume: false, pendingSeekMs: null }, [
    { type: "pause" },
  ]);
}

export function reduce(state: PlayerState, event: PlayerEvent, segments: Segments): Result {
  switch (event.type) {
    case "PLAY": {
      if (state.status === "playing" || state.status === "loading") return done(state);
      const index = nearestCovered(segments, state.index, 1);
      if (index === null) return done(state);
      const segment = segments[index]!;
      if (
        state.status === "paused" &&
        state.resume &&
        index === state.index &&
        state.loadedAssetId === segment.assetId
      ) {
        return done({ ...state, status: "playing", error: null }, [{ type: "play" }]);
      }
      return startVerse(state, segments, index, true);
    }

    case "PAUSE": {
      if (state.status !== "playing" && state.status !== "loading") return done(state);
      return done({ ...state, status: "paused", resume: state.status === "playing" }, [
        { type: "pause" },
      ]);
    }

    case "SEEK_VERSE": {
      const target = segments[event.index];
      if (!target) return done(state);
      const play = state.status === "playing" || state.status === "loading";
      if (play) return startVerse(state, segments, event.index, true);
      // Not playing: just choose the verse; PLAY will start it from its beginning.
      return done({
        ...state,
        index: event.index,
        status: state.status === "idle" ? "idle" : "paused",
        resume: false,
      });
    }

    case "SKIP": {
      const target = nearestCovered(segments, state.index + event.step, event.step);
      const play = state.status === "playing" || state.status === "loading";
      if (target === null) {
        // Nowhere to go: going back from the first verse restarts it; going on from the last does nothing.
        return event.step === -1 && play && segments[state.index]
          ? startVerse(state, segments, state.index, true)
          : done(state);
      }
      if (play) return startVerse(state, segments, target, true);
      return done({
        ...state,
        index: target,
        status: state.status === "idle" ? "idle" : "paused",
        resume: false,
      });
    }

    case "TICK": {
      if (state.status !== "playing") return done(state);
      const segment = segments[state.index];
      if (!segment) return done(state);

      if (state.pendingSeekMs !== null) {
        if (Math.abs(event.ms - state.pendingSeekMs) > SEEK_TOLERANCE_MS) return done(state);
        state = { ...state, pendingSeekMs: null };
      }
      if (segment.endMs - event.ms <= LOOKAHEAD_MS) return verseEnded(state, segments, event.ms);

      // Get the next recording ready shortly before we need it.
      if (state.endMode === "next" && segment.endMs - event.ms <= PRELOAD_MS) {
        const next = nearestCovered(segments, state.index + 1, 1);
        const upcoming = next === null ? null : segments[next]!.assetId;
        if (upcoming && upcoming !== segment.assetId && upcoming !== state.preloadedAssetId) {
          return done({ ...state, preloadedAssetId: upcoming }, [
            { type: "preload", assetId: upcoming },
          ]);
        }
      }
      return done(state);
    }

    case "ENDED":
      // The file ran out before the verse boundary was seen (a verse that ends with the audio).
      return state.status === "playing" ? verseEnded(state, segments, Number.NaN) : done(state);

    case "LOADED": {
      const next = { ...state, loadedAssetId: event.assetId };
      return done(state.status === "loading" ? { ...next, status: "playing" } : next);
    }

    case "SEEKED":
      return done({ ...state, pendingSeekMs: null });

    case "ERROR":
      return done({
        ...state,
        status: "paused",
        resume: false,
        pendingSeekMs: null,
        error: event.message,
      });

    case "SET_END_MODE":
      return done({ ...state, endMode: event.mode });

    case "RESET":
      return done(
        {
          ...initialState(state.endMode, event.index ?? 0),
          loadedAssetId: state.loadedAssetId,
        },
        state.status === "playing" || state.status === "loading" ? [{ type: "pause" }] : [],
      );
  }
}
