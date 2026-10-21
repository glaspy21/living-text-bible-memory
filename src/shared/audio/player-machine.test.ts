import { describe, expect, it } from "vitest";
import type { Segment } from "./playlist";
import {
  CONTIGUOUS_MS,
  LOOKAHEAD_MS,
  PRELOAD_MS,
  initialState,
  reduce,
  type EndMode,
  type Effect,
  type PlayerEvent,
  type PlayerState,
  type Segments,
} from "./player-machine";

const seg = (
  assetId: string,
  verse: number,
  startMs: number,
  endMs: number,
  chapter = 1,
): Segment => ({
  recordingId: `rec-${assetId}`,
  assetId,
  chapter,
  verse,
  startMs,
  endMs,
});

// Verses 1–3 in file A (a 500ms gap between 2 and 3), verse 4 in file B.
const SEGMENTS: Segments = [
  seg("A", 1, 0, 4000),
  seg("A", 2, 4000, 9000),
  seg("A", 3, 9500, 14_000),
  seg("B", 4, 1000, 6000),
];

/** Feed events through the machine, collecting every effect. */
function run(start: PlayerState, events: PlayerEvent[], segments: Segments = SEGMENTS) {
  let state = start;
  const effects: Effect[] = [];
  for (const event of events) {
    const result = reduce(state, event, segments);
    state = result.state;
    effects.push(...result.effects);
  }
  return { state, effects };
}

/** A machine that is already playing verse `index` (file A loaded). */
function playing(endMode: EndMode, index = 0, loaded = "A"): PlayerState {
  return {
    ...initialState(endMode, index),
    status: "playing",
    loadedAssetId: loaded,
  };
}

describe("starting", () => {
  it("never plays on its own", () => {
    const { state, effects } = run(initialState("next"), [
      { type: "SEEK_VERSE", index: 2 },
      { type: "SKIP", step: 1 },
      { type: "SET_END_MODE", mode: "loop" },
      { type: "TICK", ms: 100 },
    ]);
    expect(state.status).toBe("idle");
    expect(effects).toEqual([]);
  });

  it("PLAY loads the verse's file and starts at the verse's start", () => {
    const { state, effects } = run(initialState("next", 1), [{ type: "PLAY" }]);
    expect(state.status).toBe("loading");
    expect(effects).toEqual([{ type: "load", assetId: "A", seekMs: 4000, play: true }]);
    expect(run(state, [{ type: "LOADED", assetId: "A" }]).state.status).toBe("playing");
  });

  it("PLAY with the file already loaded just seeks and plays", () => {
    const start: PlayerState = { ...initialState("next", 1), status: "paused", loadedAssetId: "A" };
    const { state, effects } = run(start, [{ type: "PLAY" }]);
    expect(state.status).toBe("playing");
    expect(effects).toEqual([{ type: "seek", ms: 4000 }, { type: "play" }]);
  });

  it("does nothing when no verse has music", () => {
    const { state, effects } = run(initialState("next"), [{ type: "PLAY" }], [null, null]);
    expect(state.status).toBe("idle");
    expect(effects).toEqual([]);
  });

  it("starts at the first covered verse when the chosen one has none", () => {
    const { effects } = run(
      initialState("next"),
      [{ type: "PLAY" }],
      [null, SEGMENTS[1], SEGMENTS[2]],
    );
    expect(effects).toEqual([{ type: "load", assetId: "A", seekMs: 4000, play: true }]);
  });
});

describe("pause and resume", () => {
  it("pausing mid-verse then playing resumes without seeking", () => {
    const paused = run(playing("next"), [{ type: "TICK", ms: 1500 }, { type: "PAUSE" }]);
    expect(paused.state.status).toBe("paused");
    expect(paused.effects).toEqual([{ type: "pause" }]);
    const resumed = run(paused.state, [{ type: "PLAY" }]);
    expect(resumed.state.status).toBe("playing");
    expect(resumed.effects).toEqual([{ type: "play" }]);
  });

  it("choosing a different verse while paused makes PLAY start that verse from its beginning", () => {
    const paused = run(playing("next"), [{ type: "PAUSE" }]).state;
    const { effects } = run(paused, [{ type: "SEEK_VERSE", index: 2 }, { type: "PLAY" }]);
    expect(effects).toEqual([{ type: "seek", ms: 9500 }, { type: "play" }]);
  });

  it("pausing while loading cancels playback and PLAY starts the verse again", () => {
    const loading = run(initialState("next"), [{ type: "PLAY" }]).state;
    const paused = run(loading, [{ type: "PAUSE" }]);
    expect(paused.state.status).toBe("paused");
    expect(run(paused.state, [{ type: "PLAY" }]).state.status).toBe("loading");
  });

  it("PAUSE and PLAY are ignored when they change nothing", () => {
    expect(run(initialState("next"), [{ type: "PAUSE" }]).effects).toEqual([]);
    expect(run(playing("next"), [{ type: "PLAY" }]).effects).toEqual([]);
  });
});

describe("Loop Verse", () => {
  it("replays the verse from its start when it ends", () => {
    const { state, effects } = run(playing("loop", 1), [{ type: "TICK", ms: 9000 - LOOKAHEAD_MS }]);
    expect(state).toMatchObject({ status: "playing", index: 1 });
    expect(effects).toEqual([{ type: "seek", ms: 4000 }, { type: "play" }]);
  });

  it("keeps looping, ignoring stale ticks until the seek lands", () => {
    const first = run(playing("loop", 1), [{ type: "TICK", ms: 8990 }]);
    // The element still reports the old position for a frame or two.
    const stale = run(first.state, [
      { type: "TICK", ms: 8995 },
      { type: "TICK", ms: 9005 },
    ]);
    expect(stale.effects).toEqual([]);
    // Once it lands near the start, ticks count again and the next end loops again.
    const landed = run(stale.state, [
      { type: "SEEKED" },
      { type: "TICK", ms: 5000 },
      { type: "TICK", ms: 8990 },
    ]);
    expect(landed.effects).toEqual([{ type: "seek", ms: 4000 }, { type: "play" }]);
  });

  it("does not loop a verse that is not at its end yet", () => {
    expect(run(playing("loop", 1), [{ type: "TICK", ms: 5000 }]).effects).toEqual([]);
  });

  it("also loops when the file ends at the verse's end", () => {
    const { state, effects } = run(playing("loop", 2), [{ type: "ENDED" }]);
    expect(state.status).toBe("playing");
    expect(effects).toEqual([{ type: "seek", ms: 9500 }, { type: "play" }]);
  });
});

describe("Stop After Verse", () => {
  it("pauses at the verse's end and never advances", () => {
    const { state, effects } = run(playing("stop", 0), [{ type: "TICK", ms: 3990 }]);
    expect(state).toMatchObject({ status: "verseEnded", index: 0 });
    expect(effects).toEqual([{ type: "pause" }]);
  });

  it("plays the same verse again from the start on PLAY", () => {
    const ended = run(playing("stop", 0), [{ type: "TICK", ms: 3990 }]).state;
    const { state, effects } = run(ended, [{ type: "PLAY" }]);
    expect(state).toMatchObject({ status: "playing", index: 0 });
    expect(effects).toEqual([{ type: "seek", ms: 0 }, { type: "play" }]);
  });

  it("ignores ticks while stopped", () => {
    const ended = run(playing("stop", 0), [{ type: "TICK", ms: 3990 }]).state;
    expect(
      run(ended, [
        { type: "TICK", ms: 3995 },
        { type: "TICK", ms: 4100 },
      ]).effects,
    ).toEqual([]);
  });
});

describe("Next Verse", () => {
  it("moves to the next verse's start, skipping the gap", () => {
    const { state, effects } = run(playing("next", 1), [{ type: "TICK", ms: 8990 }]);
    expect(state).toMatchObject({ status: "playing", index: 2 });
    expect(effects).toEqual([{ type: "seek", ms: 9500 }, { type: "play" }]);
  });

  it("carries straight on, without a seek, when the next verse starts where this one ends", () => {
    const { state, effects } = run(playing("next", 0), [{ type: "TICK", ms: 4000 - LOOKAHEAD_MS }]);
    expect(state).toMatchObject({ status: "playing", index: 1 });
    expect(effects).toEqual([]);
    expect(4000 - (4000 - LOOKAHEAD_MS)).toBeLessThanOrEqual(CONTIGUOUS_MS);
  });

  it("honors an overlap: the next verse may start before this one ends", () => {
    const overlapping: Segments = [seg("A", 1, 0, 5000), seg("A", 2, 4500, 9000)];
    const { state, effects } = run(playing("next", 0), [{ type: "TICK", ms: 4990 }], overlapping);
    expect(state.index).toBe(1);
    expect(effects).toEqual([{ type: "seek", ms: 4500 }, { type: "play" }]);
  });

  it("loads the next recording when the next verse is in another file", () => {
    const { state, effects } = run(playing("next", 2), [{ type: "TICK", ms: 13_990 }]);
    expect(state).toMatchObject({ status: "loading", index: 3, loadedAssetId: null });
    expect(effects).toEqual([{ type: "load", assetId: "B", seekMs: 1000, play: true }]);
    const loaded = run(state, [{ type: "LOADED", assetId: "B" }]).state;
    expect(loaded).toMatchObject({ status: "playing", loadedAssetId: "B" });
  });

  it("always stops at the last verse of the passage", () => {
    const { state, effects } = run(playing("next", 3, "B"), [{ type: "TICK", ms: 5990 }]);
    expect(state).toMatchObject({ status: "verseEnded", index: 3 });
    expect(effects).toEqual([{ type: "pause" }]);
  });

  it("skips verses with no music", () => {
    const gapped: Segments = [SEGMENTS[0], null, null, SEGMENTS[2]];
    const { state, effects } = run(playing("next", 0), [{ type: "TICK", ms: 3990 }], gapped);
    expect(state.index).toBe(3);
    expect(effects).toEqual([{ type: "seek", ms: 9500 }, { type: "play" }]);
  });

  it("stops when every later verse has no music", () => {
    const tail: Segments = [SEGMENTS[0], null, null];
    expect(run(playing("next", 0), [{ type: "TICK", ms: 3990 }], tail).state.status).toBe(
      "verseEnded",
    );
  });

  it("asks for the next recording to be preloaded once, shortly before it is needed", () => {
    const early = run(playing("next", 2), [{ type: "TICK", ms: 14_000 - PRELOAD_MS - 100 }]);
    expect(early.effects).toEqual([]);
    const near = run(early.state, [
      { type: "TICK", ms: 14_000 - PRELOAD_MS + 100 },
      { type: "TICK", ms: 12_000 },
      { type: "TICK", ms: 13_000 },
    ]);
    expect(near.effects).toEqual([{ type: "preload", assetId: "B" }]);
  });

  it("does not preload in other modes or for the same file", () => {
    expect(run(playing("loop", 2), [{ type: "TICK", ms: 12_000 }]).effects).toEqual([]);
    expect(run(playing("next", 0), [{ type: "TICK", ms: 3000 }]).effects).toEqual([]);
  });
});

describe("skipping", () => {
  it("while playing, jumps to the neighbouring verse's start and keeps playing", () => {
    const { state, effects } = run(playing("next", 1), [{ type: "SKIP", step: 1 }]);
    expect(state).toMatchObject({ status: "playing", index: 2 });
    expect(effects).toEqual([{ type: "seek", ms: 9500 }, { type: "play" }]);
    expect(run(playing("next", 1), [{ type: "SKIP", step: -1 }]).effects).toEqual([
      { type: "seek", ms: 0 },
      { type: "play" },
    ]);
  });

  it("while stopped, only changes the verse (no audio)", () => {
    const { state, effects } = run(initialState("next", 1), [{ type: "SKIP", step: 1 }]);
    expect(state).toMatchObject({ status: "idle", index: 2 });
    expect(effects).toEqual([]);
  });

  it("skips over verses with no music in both directions", () => {
    const gapped: Segments = [SEGMENTS[0], null, null, SEGMENTS[2]];
    expect(run(initialState("next", 0), [{ type: "SKIP", step: 1 }], gapped).state.index).toBe(3);
    expect(run(initialState("next", 3), [{ type: "SKIP", step: -1 }], gapped).state.index).toBe(0);
  });

  it("restarts the first verse when going back from it, and ignores going on from the last", () => {
    expect(run(playing("next", 0), [{ type: "SKIP", step: -1 }]).effects).toEqual([
      { type: "seek", ms: 0 },
      { type: "play" },
    ]);
    expect(run(playing("next", 3, "B"), [{ type: "SKIP", step: 1 }]).effects).toEqual([]);
    expect(run(initialState("next", 0), [{ type: "SKIP", step: -1 }]).effects).toEqual([]);
  });

  it("jumps to another file when the neighbour is in one", () => {
    const { effects } = run(playing("next", 2), [{ type: "SKIP", step: 1 }]);
    expect(effects).toEqual([{ type: "load", assetId: "B", seekMs: 1000, play: true }]);
  });
});

describe("seeking to a verse", () => {
  it("plays it from the start when already playing, including during a loop", () => {
    const looping = playing("loop", 1);
    const { state, effects } = run(looping, [{ type: "SEEK_VERSE", index: 2 }]);
    expect(state).toMatchObject({ status: "playing", index: 2, endMode: "loop" });
    expect(effects).toEqual([{ type: "seek", ms: 9500 }, { type: "play" }]);
  });

  it("ignores a verse with no music", () => {
    const gapped: Segments = [SEGMENTS[0], null];
    const state = playing("next", 0);
    expect(run(state, [{ type: "SEEK_VERSE", index: 1 }], gapped)).toEqual({ state, effects: [] });
    expect(run(state, [{ type: "SEEK_VERSE", index: 9 }], gapped).effects).toEqual([]);
  });
});

describe("changing the end mode", () => {
  it("takes effect at the next verse end, without interrupting playback", () => {
    const { state, effects } = run(playing("next", 0), [
      { type: "TICK", ms: 1000 },
      { type: "SET_END_MODE", mode: "stop" },
    ]);
    expect(state).toMatchObject({ status: "playing", endMode: "stop" });
    expect(effects).toEqual([]);
    expect(run(state, [{ type: "TICK", ms: 3990 }]).state.status).toBe("verseEnded");
  });
});

describe("loading and errors", () => {
  it("ignores ticks while loading", () => {
    const loading = run(initialState("next"), [{ type: "PLAY" }]).state;
    expect(run(loading, [{ type: "TICK", ms: 3990 }]).effects).toEqual([]);
  });

  it("remembers the loaded file when nothing was waiting for it", () => {
    expect(run(initialState("next"), [{ type: "LOADED", assetId: "A" }]).state).toMatchObject({
      status: "idle",
      loadedAssetId: "A",
    });
  });

  it("pauses and reports an error, and PLAY tries again from the verse start", () => {
    const failed = run(playing("next", 1), [
      { type: "ERROR", message: "Could not load the audio" },
    ]).state;
    expect(failed).toMatchObject({ status: "paused", error: "Could not load the audio" });
    const retry = run(failed, [{ type: "PLAY" }]);
    expect(retry.state.error).toBeNull();
    expect(retry.effects).toEqual([{ type: "seek", ms: 4000 }, { type: "play" }]);
  });

  it("ignores ENDED unless playing", () => {
    expect(run(initialState("next"), [{ type: "ENDED" }]).effects).toEqual([]);
  });
});

describe("RESET", () => {
  it("returns to idle at the chosen verse, keeps the end mode, and pauses audio that was playing", () => {
    const { state, effects } = run(playing("loop", 2), [{ type: "RESET", index: 1 }]);
    expect(state).toMatchObject({ status: "idle", index: 1, endMode: "loop", loadedAssetId: "A" });
    expect(effects).toEqual([{ type: "pause" }]);
  });
});
