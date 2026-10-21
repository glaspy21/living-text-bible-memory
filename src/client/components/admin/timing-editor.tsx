"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/client/components/ui/button";
import { cn } from "@/client/lib/cn";
import {
  formatTimeMs,
  parseTimeInput,
  filledCount,
  fitPxPerSec,
  clampView,
  markAt,
  sameTiming,
  setBoundary,
  zoomAt,
  type Boundary,
  type TimingRow,
  type View,
} from "@/shared/timing/timing";
import { TimingWaveform } from "./timing-waveform";

export type EditorProps = {
  recordingId: string;
  status: "DRAFT" | "READY" | "PUBLISHED";
  draft: { id: string; version: number; basedOnPublished: boolean } | null;
  audioAssetId: string;
  durationMs: number;
  initialRows: TimingRow[];
  /** "John 1" style label for each row, same order as the rows. */
  labels: string[];
};

type SaveState =
  | { kind: "saved"; at: Date | null }
  | { kind: "dirty" }
  | { kind: "saving" }
  | { kind: "error"; message: string };

type Session = { id: string; savedAt: string; version: number; filled: number };

const AUTOSAVE_MS = 900;

/**
 * The timing editor: waveform, ruler, zoom, scrub, draggable handles, numbers, per-verse preview
 * and autosave into the draft sheet. A published recording is first given a new draft version.
 */
export function TimingEditor(props: EditorProps) {
  const { recordingId, durationMs, labels, audioAssetId } = props;
  const router = useRouter();
  const [rows, setRows] = useState<TimingRow[]>(props.initialRows);
  const [selected, setSelected] = useState<number | null>(null);
  const [peaks, setPeaks] = useState<number[] | null>(null);
  const [playheadMs, setPlayheadMs] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [save, setSave] = useState<SaveState>({ kind: "saved", at: null });
  const [sessions, setSessions] = useState<Session[] | null>(null);
  const [width, setWidth] = useState(0);
  const [view, setView] = useState<View>({ startMs: 0, pxPerSec: 20 });
  const box = useRef<HTMLDivElement>(null);
  const audio = useRef<HTMLAudioElement>(null);
  const stopAt = useRef<number | null>(null);
  const saved = useRef<TimingRow[]>(props.initialRows);
  const rowsRef = useRef(rows);
  useEffect(() => {
    rowsRef.current = rows;
  }, [rows]);
  const draftId = props.draft?.id ?? null;
  const editable = draftId !== null;
  const fitted = useRef(false);
  const again = useRef(false);

  // size the waveform to its box and start zoomed out to the whole recording
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const measure = () => {
      const w = Math.floor(el.clientWidth);
      setWidth(w);
      if (!fitted.current && w > 0) {
        fitted.current = true;
        setView({ startMs: 0, pxPerSec: fitPxPerSec(durationMs, w) });
      } else {
        setView((v) => clampView(v, durationMs, w));
      }
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [durationMs]);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/admin/recordings/${recordingId}/peaks?asset=${audioAssetId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((p) => !cancelled && Array.isArray(p) && setPeaks(p))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [recordingId, audioAssetId]);

  // --- saving ----------------------------------------------------------------------------
  const inFlight = useRef(false);
  const flush = useCallback(async () => {
    if (!draftId) return;
    // One save at a time, so an older save can never land after a newer one.
    if (inFlight.current) {
      again.current = true;
      return;
    }
    inFlight.current = true;
    const toSave = rowsRef.current;
    setSave({ kind: "saving" });
    try {
      const response = await fetch(`/api/admin/recordings/${recordingId}/timing`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ setId: draftId, rows: toSave }),
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as { error?: string };
        setSave({
          kind: "error",
          message: body.error ?? "Could not save. Will retry on your next change.",
        });
        return;
      }
      const body = (await response.json()) as { savedAt: string };
      saved.current = toSave;
      setSave(
        sameTiming(rowsRef.current, toSave)
          ? { kind: "saved", at: new Date(body.savedAt) }
          : { kind: "dirty" },
      );
    } catch {
      setSave({
        kind: "error",
        message: "Offline? Your changes are kept here and will be retried.",
      });
    } finally {
      inFlight.current = false;
      // Something changed while saving: save that too.
      if (again.current || !sameTiming(rowsRef.current, saved.current)) {
        again.current = false;
        if (!sameTiming(rowsRef.current, saved.current)) void flushRef.current();
      }
    }
  }, [draftId, recordingId]);
  const flushRef = useRef(flush);
  useEffect(() => {
    flushRef.current = flush;
  }, [flush]);

  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (!editable || sameTiming(rows, saved.current)) return;
    setSave((s) => (s.kind === "saving" ? s : { kind: "dirty" }));
    const t = setTimeout(flush, AUTOSAVE_MS);
    return () => clearTimeout(t);
  }, [rows, editable, flush]);

  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (!sameTiming(rowsRef.current, saved.current)) e.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, []);

  // --- audio ------------------------------------------------------------------------------
  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    const tick = () => {
      const a = audio.current;
      if (a) {
        const ms = a.currentTime * 1000;
        if (stopAt.current !== null && ms >= stopAt.current) {
          a.pause();
          setPlaying(false);
          stopAt.current = null;
        }
        setPlayheadMs(ms);
        // follow the playhead when it runs off the right edge
        setView((v) => {
          const right = v.startMs + (width / v.pxPerSec) * 1000;
          return ms > right || ms < v.startMs
            ? clampView({ ...v, startMs: ms - 200 }, durationMs, width)
            : v;
        });
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, width, durationMs]);

  const seek = useCallback((ms: number) => {
    setPlayheadMs(ms);
    if (audio.current) audio.current.currentTime = ms / 1000;
  }, []);

  const togglePlay = useCallback(() => {
    const a = audio.current;
    if (!a) return;
    if (a.paused) {
      stopAt.current = null;
      void a
        .play()
        .then(() => setPlaying(true))
        .catch(() => setPlaying(false));
    } else {
      a.pause();
      setPlaying(false);
    }
  }, []);

  function preview(index: number) {
    const r = rows[index];
    const a = audio.current;
    if (!a || r.startMs === null || r.endMs === null || r.endMs <= r.startMs) return;
    a.currentTime = r.startMs / 1000;
    stopAt.current = r.endMs;
    setSelected(index);
    void a
      .play()
      .then(() => setPlaying(true))
      .catch(() => setPlaying(false));
  }

  // --- editing ----------------------------------------------------------------------------
  const edit = useCallback(
    (index: number, which: Boundary, ms: number | null) =>
      editable && setRows((rs) => setBoundary(rs, index, which, ms, durationMs)),
    [editable, durationMs],
  );

  const mark = useCallback(() => {
    if (editable) setRows((rs) => markAt(rs, playheadMs, durationMs));
  }, [editable, playheadMs, durationMs]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.closest("input, textarea, select, button, [contenteditable]")) return;
      if (e.code === "Space") {
        e.preventDefault();
        togglePlay();
      } else if (e.key === "m" || e.key === "M") {
        mark();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [togglePlay, mark]);

  function zoom(factor: number) {
    setView((v) => zoomAt(v, factor, width / 2, durationMs, width));
  }

  function select(index: number) {
    setSelected(index);
  }

  function showVerse(index: number) {
    setSelected(index);
    const r = rows[index];
    if (r.startMs === null) return;
    setView((v) => clampView({ ...v, startMs: r.startMs! - 300 }, durationMs, width));
  }

  async function loadSessions() {
    const r = await fetch(`/api/admin/recordings/${recordingId}/timing/sessions`);
    if (r.ok) setSessions(((await r.json()) as { sessions: Session[] }).sessions);
  }

  async function restore(id: string) {
    if (
      !window.confirm(
        "Return to this session? Your current timing is kept as its own session first.",
      )
    )
      return;
    const r = await fetch(`/api/admin/recordings/${recordingId}/timing/sessions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId: id }),
    });
    if (r.ok) window.location.reload();
    else setSave({ kind: "error", message: "That session could not be restored." });
  }

  async function startDraft() {
    const r = await fetch(`/api/admin/recordings/${recordingId}/timing`, { method: "POST" });
    if (r.ok) router.refresh();
  }

  const done = filledCount(rows);
  const visibleSpanMs = width > 0 ? (width / view.pxPerSec) * 1000 : durationMs;
  const maxStart = Math.max(0, durationMs - visibleSpanMs);

  const statusText = useMemo(() => {
    switch (save.kind) {
      case "saving":
        return "Saving…";
      case "dirty":
        return "Unsaved changes…";
      case "error":
        return save.message;
      default:
        return save.at
          ? `Saved ${save.at.toLocaleTimeString([], { hour: "numeric", minute: "2-digit", second: "2-digit" })}`
          : "All changes saved";
    }
  }, [save]);

  return (
    <div data-testid="timing-editor">
      {!editable && (
        <div
          className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-[10px] border border-line bg-[rgba(18,18,18,.7)] p-4"
          data-testid="published-notice"
        >
          <span className="text-muted">
            This timing is published, so it can&apos;t be edited in place. Listeners keep hearing it
            until a new draft version is published.
          </span>
          <Button variant="solid" onClick={startDraft}>
            Start a new draft version
          </Button>
        </div>
      )}
      {props.draft?.basedOnPublished && (
        <p className="mb-3 text-[13px] text-muted" data-testid="draft-notice">
          Draft version {props.draft.version}, based on the published timing. Listeners still hear
          the published version.
        </p>
      )}

      <div className="mb-2 flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          onClick={togglePlay}
          aria-label={playing ? "Pause" : "Play"}
          data-testid="timing-play"
        >
          {playing ? "Pause" : "Play"}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={mark}
          disabled={!editable}
          title="Mark the next boundary at the playhead (M)"
          data-testid="timing-mark"
        >
          Mark at playhead
        </Button>
        <span
          className="font-mono text-[13px] tabular-nums text-gold2"
          data-testid="timing-playhead"
        >
          {formatTimeMs(playheadMs)}
        </span>
        <span className="text-[13px] text-muted">/ {formatTimeMs(durationMs)}</span>
        <span className="ml-auto flex items-center gap-1.5">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => zoom(1 / 1.5)}
            aria-label="Zoom out"
            data-testid="zoom-out"
          >
            −
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => zoom(1.5)}
            aria-label="Zoom in"
            data-testid="zoom-in"
          >
            +
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setView({ startMs: 0, pxPerSec: fitPxPerSec(durationMs, width) })}
            data-testid="zoom-fit"
          >
            Fit
          </Button>
        </span>
      </div>

      <div ref={box} className="w-full">
        <TimingWaveform
          peaks={peaks}
          durationMs={durationMs}
          rows={rows}
          view={view}
          playheadMs={playheadMs}
          selected={selected}
          width={width}
          onScrub={seek}
          onDrag={(i, which, ms) => edit(i, which, ms)}
          onDragEnd={() => {}}
          onZoomWheel={(factor, x) => setView((v) => zoomAt(v, factor, x, durationMs, width))}
          onPan={(dx) =>
            setView((v) =>
              clampView({ ...v, startMs: v.startMs + (dx / v.pxPerSec) * 1000 }, durationMs, width),
            )
          }
          onSelect={select}
        />
      </div>
      <input
        type="range"
        aria-label="Scroll the waveform"
        data-testid="timing-scroll"
        className="mt-2 w-full accent-[var(--gold)]"
        min={0}
        max={Math.max(1, Math.round(maxStart))}
        step={1}
        value={Math.min(Math.round(view.startMs), Math.max(1, Math.round(maxStart)))}
        disabled={maxStart <= 0}
        onChange={(e) =>
          setView((v) => clampView({ ...v, startMs: Number(e.target.value) }, durationMs, width))
        }
      />
      <audio
        ref={audio}
        src={`/api/audio/${audioAssetId}`}
        preload="auto"
        onEnded={() => setPlaying(false)}
      />

      <div className="my-3 flex flex-wrap items-center justify-between gap-2 text-[13px]">
        <span className="text-muted" data-testid="timing-progress">
          {done} of {rows.length} verses timed
        </span>
        <span
          role="status"
          data-testid="timing-save-status"
          className={cn(save.kind === "error" ? "text-err" : "text-muted")}
        >
          {editable ? statusText : "Read only"}
        </span>
      </div>

      <div className="overflow-x-auto rounded-[10px] border border-line">
        <table
          className="w-full min-w-[640px] border-collapse text-[14px]"
          data-testid="timing-table"
        >
          <thead>
            <tr className="text-left text-[12px] uppercase tracking-wider text-muted">
              <th className="p-2.5">Verse</th>
              <th className="p-2.5">Start</th>
              <th className="p-2.5">End</th>
              <th className="p-2.5 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr
                key={`${r.chapter}:${r.verse}`}
                data-testid="timing-row"
                aria-selected={selected === i}
                onClick={() => showVerse(i)}
                className={cn(
                  "border-t border-line",
                  selected === i && "bg-[rgba(237,191,100,.08)]",
                )}
              >
                <td className="p-2.5 font-serif text-[17px] text-gold2">{labels[i]}</td>
                <TimeCell
                  label={`${labels[i]} start`}
                  ms={r.startMs}
                  disabled={!editable}
                  durationMs={durationMs}
                  onCommit={(ms) => edit(i, "start", ms)}
                />
                <TimeCell
                  label={`${labels[i]} end`}
                  ms={r.endMs}
                  disabled={!editable}
                  durationMs={durationMs}
                  onCommit={(ms) => edit(i, "end", ms)}
                />
                <td className="p-2.5 text-right">
                  <span className="inline-flex flex-wrap justify-end gap-1.5">
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={!editable}
                      onClick={(e) => {
                        e.stopPropagation();
                        edit(i, "start", playheadMs);
                      }}
                      aria-label={`Set ${labels[i]} start to playhead`}
                    >
                      Start here
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={!editable}
                      onClick={(e) => {
                        e.stopPropagation();
                        edit(i, "end", playheadMs);
                      }}
                      aria-label={`Set ${labels[i]} end to playhead`}
                    >
                      End here
                    </Button>
                    <Button
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        preview(i);
                      }}
                      disabled={r.startMs === null || r.endMs === null || r.endMs <= r.startMs}
                      aria-label={`Preview ${labels[i]}`}
                    >
                      Preview
                    </Button>
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <Button size="sm" variant="ghost" onClick={loadSessions} data-testid="sessions-open">
          Earlier sessions
        </Button>
        {sessions && sessions.length === 0 && (
          <span className="text-[13px] text-muted">No earlier sessions yet.</span>
        )}
      </div>
      {sessions && sessions.length > 0 && (
        <ul
          className="mt-3 divide-y divide-[var(--line)] rounded-[10px] border border-line"
          data-testid="sessions-list"
        >
          {sessions.map((s) => (
            <li
              key={s.id}
              className="flex flex-wrap items-center justify-between gap-2 p-2.5 text-[13px]"
            >
              <span>
                {new Date(s.savedAt).toLocaleString()} · draft v{s.version} · {s.filled} verses
                timed
              </span>
              <Button size="sm" variant="ghost" disabled={!editable} onClick={() => restore(s.id)}>
                Return to this
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** A time you can type ("1:05.250", "65.25") or nudge with the arrow keys (Shift for bigger steps). */
function TimeCell(props: {
  label: string;
  ms: number | null;
  disabled: boolean;
  durationMs: number;
  onCommit: (ms: number | null) => void;
}) {
  const { ms } = props;
  const [text, setText] = useState(formatTimeMs(ms));
  const [bad, setBad] = useState(false);
  const editing = useRef(false);

  useEffect(() => {
    if (!editing.current) setText(formatTimeMs(ms));
  }, [ms]);

  function commit() {
    editing.current = false;
    if (text.trim() === "") {
      setBad(false);
      props.onCommit(null);
      return;
    }
    const parsed = parseTimeInput(text);
    if (parsed === null || parsed > props.durationMs) {
      setBad(true);
      setText(formatTimeMs(ms));
      return;
    }
    setBad(false);
    props.onCommit(parsed);
    setText(formatTimeMs(parsed));
  }

  return (
    <td className="p-2.5">
      <input
        aria-label={props.label}
        aria-invalid={bad || undefined}
        title={bad ? "Enter a time inside the recording, like 1:05.250" : undefined}
        disabled={props.disabled}
        inputMode="decimal"
        placeholder="m:ss.mmm"
        value={text}
        className={cn(
          "w-[118px] rounded-[6px] border bg-transparent px-2 py-1 font-mono text-[13px] tabular-nums text-text outline-none focus:border-gold-bright",
          bad ? "border-err" : "border-line",
        )}
        onFocus={() => (editing.current = true)}
        onChange={(e) => setText(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          if ((e.key === "ArrowUp" || e.key === "ArrowDown") && ms !== null) {
            e.preventDefault();
            const step = e.shiftKey ? 100 : 10;
            const next = Math.min(
              Math.max(0, ms + (e.key === "ArrowUp" ? step : -step)),
              props.durationMs,
            );
            setText(formatTimeMs(next));
            props.onCommit(next);
          }
        }}
      />
    </td>
  );
}
