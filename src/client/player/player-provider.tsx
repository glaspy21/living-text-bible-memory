"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { readPref, useStoredPref, writePref } from "@/client/lib/prefs";
import {
  genreCoverage,
  chooseGenre,
  nearestCovered,
  resolveSegments,
  type GenreCoverage,
  type PlayableRecording,
  type Segment,
} from "@/shared/audio/playlist";
import {
  initialState,
  reduce,
  type Effect,
  type EndMode,
  type PlayerEvent,
  type PlayerState,
  type Segments,
  type Status,
} from "@/shared/audio/player-machine";
import { formatPassageParam } from "@/shared/scripture/passage-param";
import type { PassageRef, BookVerseRef } from "@/shared/scripture/types";
import { DEFAULT_END_MODES, isEndMode, type PlayerContextKind } from "./end-modes";

type PlaybackData = {
  verses: BookVerseRef[];
  recordings: PlayableRecording[];
  genres: { slug: string; name: string }[];
};

type Registration = { passage: PassageRef; context: PlayerContextKind };

export type PlayerApi = {
  status: Status;
  error: string | null;
  /** The registered passage's verses (empty when no page has registered one). */
  verses: readonly BookVerseRef[];
  /** The current verse's index in `verses`. */
  index: number;
  currentVerse: BookVerseRef | null;
  /** True while the music for the passage is being looked up. */
  loadingMusic: boolean;
  hasMusic: boolean;
  /** Verses of the passage with no music in the chosen genre. */
  uncoveredCount: number;
  genres: { slug: string; name: string }[];
  coverage: readonly GenreCoverage[];
  genre: string | null;
  endMode: EndMode;
  /** The current verse's segment, if it has music. */
  segment: Segment | null;
  segments: Segments;
  play(): void;
  pause(): void;
  skip(step: 1 | -1): void;
  seekVerse(index: number): void;
  setEndMode(mode: EndMode): void;
  setGenre(slug: string): void;
  register(registration: Registration | null): void;
};

const PlayerContext = createContext<PlayerApi | null>(null);
/** Playback position within the current verse, in ms. Separate so the fast-changing value only re-renders the bar. */
const PositionContext = createContext(0);

const GENRE_KEY = "lt.genre.v1";
const ENDMODE_KEY = "lt.endmode.v1";
const isString = (v: unknown): v is string => typeof v === "string";
const isEndModes = (v: unknown): v is Partial<Record<PlayerContextKind, EndMode>> =>
  typeof v === "object" && v !== null;

export function PlayerProvider({ children }: { children: ReactNode }) {
  const [registration, setRegistration] = useState<Registration | null>(null);
  const [data, setData] = useState<{ key: string; value: PlaybackData } | null>(null);
  const [genreChoice, setGenreChoice] = useState<string | null>(null);
  const [savedModes, saveModes] = useStoredPref(ENDMODE_KEY, {}, isEndModes);
  const endModes: Record<PlayerContextKind, EndMode> = {
    reader: isEndMode(savedModes.reader) ? savedModes.reader : DEFAULT_END_MODES.reader,
    practice: isEndMode(savedModes.practice) ? savedModes.practice : DEFAULT_END_MODES.practice,
  };
  const [machine, setMachine] = useState<PlayerState>(() => initialState("next"));
  const [positionMs, setPositionMs] = useState(0);

  const machineRef = useRef(machine);
  const segmentsRef = useRef<Segments>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const preloadRef = useRef<HTMLAudioElement | null>(null);
  const loadToken = useRef(0);
  const dispatchRef = useRef<(event: PlayerEvent) => void>(() => {});

  const key = registration
    ? `${formatPassageParam(registration.passage)}|${registration.context}`
    : "";
  const endMode: EndMode = registration ? endModes[registration.context] : "next";

  // ---- music for the passage -------------------------------------------------------------
  useEffect(() => {
    if (!registration) return;
    const controller = new AbortController();
    const wanted = key;
    fetch(`/api/playback?${new URLSearchParams({ p: formatPassageParam(registration.passage) })}`, {
      signal: controller.signal,
    })
      .then((response) => (response.ok ? (response.json() as Promise<PlaybackData>) : null))
      .then((value) =>
        setData({ key: wanted, value: value ?? { verses: [], recordings: [], genres: [] } }),
      )
      .catch((error) => {
        if (error?.name !== "AbortError") {
          setData({ key: wanted, value: { verses: [], recordings: [], genres: [] } });
        }
      });
    return () => controller.abort();
    // `key` identifies the passage; `registration` itself changes identity without changing it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const current = data && data.key === key ? data.value : null;
  const verses = useMemo(() => current?.verses ?? [], [current]);
  const recordings = useMemo(() => current?.recordings ?? [], [current]);
  const coverage = useMemo(() => genreCoverage(verses, recordings), [verses, recordings]);

  const genre = useMemo(() => {
    if (genreChoice && coverage.some((g) => g.genreSlug === genreChoice)) return genreChoice;
    return chooseGenre(coverage, readPref(GENRE_KEY, null, isString));
  }, [coverage, genreChoice]);

  const segments = useMemo<Segments>(
    () => (genre ? resolveSegments(verses, recordings, genre) : verses.map(() => null)),
    [verses, recordings, genre],
  );
  useLayoutEffect(() => {
    segmentsRef.current = segments;
  }, [segments]);

  // ---- running the machine ----------------------------------------------------------------
  const audio = useCallback(() => {
    if (!audioRef.current) {
      const element = new Audio();
      element.preload = "metadata";
      audioRef.current = element;
    }
    return audioRef.current;
  }, []);

  const runEffect = useCallback(
    (effect: Effect) => {
      const element = audio();
      const fail = () =>
        dispatchRef.current({ type: "ERROR", message: "This recording couldn't be played." });
      switch (effect.type) {
        case "load": {
          const token = ++loadToken.current;
          element.addEventListener(
            "loadedmetadata",
            () => {
              if (token !== loadToken.current) return; // a newer load replaced this one
              element.currentTime = effect.seekMs / 1000;
              if (effect.play) element.play().catch(fail);
              dispatchRef.current({ type: "LOADED", assetId: effect.assetId });
            },
            { once: true },
          );
          element.src = `/api/audio/${effect.assetId}`;
          element.load();
          return;
        }
        case "seek":
          element.currentTime = effect.ms / 1000;
          return;
        case "play":
          element.play().catch(fail);
          return;
        case "pause":
          element.pause();
          return;
        case "preload": {
          const next = new Audio();
          next.preload = "auto";
          next.src = `/api/audio/${effect.assetId}`;
          preloadRef.current = next; // keep a reference so it is not discarded early
          return;
        }
      }
    },
    [audio],
  );

  const dispatch = useCallback(
    (event: PlayerEvent) => {
      const { state, effects } = reduce(machineRef.current, event, segmentsRef.current);
      if (state !== machineRef.current) {
        machineRef.current = state;
        setMachine(state);
      }
      effects.forEach(runEffect);
    },
    [runEffect],
  );
  useEffect(() => {
    dispatchRef.current = dispatch;
  }, [dispatch]);

  // Events from the audio element.
  useEffect(() => {
    const element = audio();
    const onSeeked = () => {
      dispatchRef.current({ type: "SEEKED" });
      setPositionMs(element.currentTime * 1000);
    };
    const onEnded = () => dispatchRef.current({ type: "ENDED" });
    const onError = () => {
      if (element.getAttribute("src")) {
        dispatchRef.current({ type: "ERROR", message: "This recording couldn't be loaded." });
      }
    };
    element.addEventListener("seeked", onSeeked);
    element.addEventListener("ended", onEnded);
    element.addEventListener("error", onError);
    return () => {
      element.removeEventListener("seeked", onSeeked);
      element.removeEventListener("ended", onEnded);
      element.removeEventListener("error", onError);
      element.pause();
    };
  }, [audio]);

  // Boundary detection: every animation frame while playing (timeupdate, ~4 times a second, is too
  // coarse), plus a timer so a hidden tab, where frames stop, still catches verse ends (less exactly).
  useEffect(() => {
    if (machine.status !== "playing") return;
    const element = audio();
    let frame = 0;
    let lastUi = 0;
    const tick = () => dispatchRef.current({ type: "TICK", ms: element.currentTime * 1000 });
    const loop = (time: number) => {
      tick();
      if (time - lastUi > 100) {
        lastUi = time;
        setPositionMs(element.currentTime * 1000);
      }
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    const timer = window.setInterval(tick, 100);
    return () => {
      cancelAnimationFrame(frame);
      window.clearInterval(timer);
    };
  }, [machine.status, audio]);

  // A new passage or genre: start again at its first verse with music, without playing.
  useEffect(() => {
    const first = nearestCovered(segmentsRef.current, 0, 1) ?? 0;
    dispatchRef.current({ type: "RESET", index: first });
  }, [segments]);

  useEffect(() => {
    dispatchRef.current({ type: "SET_END_MODE", mode: endMode });
  }, [endMode]);

  // ---- actions ----------------------------------------------------------------------------
  const register = useCallback((next: Registration | null) => {
    setRegistration(next);
    setGenreChoice(null);
    if (!next) {
      setData(null);
      dispatchRef.current({ type: "RESET" });
    }
  }, []);

  const setEndMode = useCallback(
    (mode: EndMode) => {
      if (!registration) return;
      saveModes({ ...savedModes, [registration.context]: mode });
    },
    [registration, savedModes, saveModes],
  );

  const setGenre = useCallback(
    (slug: string) => {
      const wasPlaying =
        machineRef.current.status === "playing" || machineRef.current.status === "loading";
      const index = machineRef.current.index;
      const next = resolveSegments(verses, recordings, slug);
      segmentsRef.current = next; // the machine must see the new segments before it is told what to do
      setGenreChoice(slug);
      writePref(GENRE_KEY, slug);
      dispatch({ type: "RESET", index });
      // Keep the verse if the new genre covers it; otherwise the nearest one that has music.
      if (wasPlaying) dispatch({ type: "PLAY" });
    },
    [verses, recordings, dispatch],
  );

  const segment = segments[machine.index] ?? null;
  const api = useMemo<PlayerApi>(
    () => ({
      status: machine.status,
      error: machine.error,
      verses,
      index: machine.index,
      currentVerse: verses[machine.index] ?? null,
      loadingMusic: registration !== null && current === null,
      hasMusic: segments.some(Boolean),
      uncoveredCount: segments.filter((s) => !s).length,
      genres: current?.genres ?? [],
      coverage,
      genre,
      endMode: machine.endMode,
      segment,
      segments,
      play: () => dispatch({ type: "PLAY" }),
      pause: () => dispatch({ type: "PAUSE" }),
      skip: (step) => dispatch({ type: "SKIP", step }),
      seekVerse: (index) => dispatch({ type: "SEEK_VERSE", index }),
      setEndMode,
      setGenre,
      register,
    }),
    [
      machine,
      verses,
      registration,
      current,
      segments,
      coverage,
      genre,
      segment,
      dispatch,
      setEndMode,
      setGenre,
      register,
    ],
  );

  const inVerse = segment
    ? Math.max(0, Math.min(positionMs - segment.startMs, segment.endMs - segment.startMs))
    : 0;
  return (
    <PlayerContext.Provider value={api}>
      <PositionContext.Provider value={machine.status === "idle" ? 0 : inVerse}>
        {children}
      </PositionContext.Provider>
    </PlayerContext.Provider>
  );
}

export function usePlayer(): PlayerApi {
  const value = useContext(PlayerContext);
  if (!value) throw new Error("usePlayer must be used inside PlayerProvider");
  return value;
}

/** How far into the current verse playback is, in ms. */
export function useVersePosition(): number {
  return useContext(PositionContext);
}
