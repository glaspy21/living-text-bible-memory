"use client";

import { useEffect, useRef } from "react";
import {
  hitHandle,
  msToX,
  rulerStepMs,
  xToMs,
  type Boundary,
  type TimingRow,
  type View,
} from "@/shared/timing/timing";
import { formatTime } from "@/shared/audio/format-time";

export const WAVE_HEIGHT = 190;
const RULER = 26;

type Props = {
  peaks: number[] | null;
  durationMs: number;
  rows: TimingRow[];
  view: View;
  playheadMs: number;
  selected: number | null;
  width: number;
  onScrub: (ms: number) => void;
  onDrag: (index: number, which: Boundary, ms: number) => void;
  onDragEnd: () => void;
  onZoomWheel: (factor: number, x: number) => void;
  onPan: (deltaPx: number) => void;
  onSelect: (index: number) => void;
};

function cssVar(name: string, fallback: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
}

/** The waveform with a time ruler, verse regions and draggable start/end handles. */
export function TimingWaveform(props: Props) {
  const { peaks, durationMs, rows, view, playheadMs, selected, width } = props;
  const canvas = useRef<HTMLCanvasElement>(null);
  const latest = useRef(props);
  useEffect(() => {
    latest.current = props;
  });
  const drag = useRef<{ index: number; which: Boundary } | "scrub" | null>(null);

  useEffect(() => {
    const el = canvas.current;
    if (!el || width <= 0) return;
    const dpr = window.devicePixelRatio || 1;
    el.width = Math.round(width * dpr);
    el.height = Math.round(WAVE_HEIGHT * dpr);
    const g = el.getContext("2d");
    if (!g) return;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    const gold = cssVar("--gold", "#d0a34f");
    const gold2 = cssVar("--gold2", "#e8cb8a");
    const muted = cssVar("--muted", "#948c7a");
    const line = cssVar("--line", "rgba(201,164,92,.28)");

    g.clearRect(0, 0, width, WAVE_HEIGHT);
    g.fillStyle = "#0b0b0b";
    g.fillRect(0, 0, width, WAVE_HEIGHT);

    // ruler
    const step = rulerStepMs(view.pxPerSec);
    g.font = "11px Inter, sans-serif";
    g.textBaseline = "middle";
    g.strokeStyle = line;
    g.fillStyle = muted;
    g.lineWidth = 1;
    const first = Math.floor(view.startMs / step) * step;
    for (let t = first; t <= xToMs(width, view); t += step) {
      const x = Math.round(msToX(t, view)) + 0.5;
      g.beginPath();
      g.moveTo(x, RULER - 8);
      g.lineTo(x, RULER);
      g.stroke();
      if (x >= 0) {
        const label =
          step < 1000
            ? `${formatTime(t)}.${String(Math.round(t % 1000)).padStart(3, "0")}`
            : formatTime(t);
        g.fillText(label, x + 4, RULER / 2);
      }
    }
    g.beginPath();
    g.moveTo(0, RULER + 0.5);
    g.lineTo(width, RULER + 0.5);
    g.stroke();

    // verse regions
    rows.forEach((r, i) => {
      if (r.startMs === null || r.endMs === null) return;
      const x1 = msToX(r.startMs, view);
      const x2 = msToX(r.endMs, view);
      if (x2 < 0 || x1 > width) return;
      const lo = Math.min(x1, x2);
      g.fillStyle = i === selected ? "rgba(237,191,100,.22)" : "rgba(201,164,92,.10)";
      g.fillRect(lo, RULER + 1, Math.abs(x2 - x1), WAVE_HEIGHT - RULER - 1);
      g.fillStyle = gold2;
      g.font = "600 13px 'EB Garamond', serif";
      g.fillText(String(r.verse), Math.max(lo + 5, 3), RULER + 14);
    });

    // waveform
    const mid = RULER + (WAVE_HEIGHT - RULER) / 2;
    const half = (WAVE_HEIGHT - RULER) / 2 - 6;
    if (peaks && peaks.length > 0 && durationMs > 0) {
      g.fillStyle = gold;
      for (let x = 0; x < width; x++) {
        const a = Math.max(0, xToMs(x, view));
        const b = xToMs(x + 1, view);
        if (a >= durationMs) break;
        const from = Math.floor((a / durationMs) * peaks.length);
        const to = Math.min(
          peaks.length - 1,
          Math.max(from, Math.floor((b / durationMs) * peaks.length)),
        );
        let max = 0;
        for (let k = from; k <= to; k++) max = Math.max(max, peaks[k] ?? 0);
        const h = Math.max(1, max * half);
        g.fillRect(x, mid - h, 1, h * 2);
      }
    } else {
      g.fillStyle = muted;
      g.font = "13px Inter, sans-serif";
      g.fillText(
        "No waveform for this recording. Timing still works by ear and by number.",
        12,
        mid,
      );
    }

    // handles
    rows.forEach((r, i) => {
      for (const which of ["start", "end"] as const) {
        const ms = which === "start" ? r.startMs : r.endMs;
        if (ms === null) continue;
        const x = Math.round(msToX(ms, view)) + 0.5;
        if (x < -2 || x > width + 2) continue;
        g.strokeStyle = which === "start" ? "#edbf64" : "#c9d58a";
        g.lineWidth = i === selected ? 2.5 : 1.5;
        g.beginPath();
        g.moveTo(x, RULER);
        g.lineTo(x, WAVE_HEIGHT);
        g.stroke();
        g.fillStyle = g.strokeStyle;
        g.beginPath();
        if (which === "start") {
          g.moveTo(x, RULER);
          g.lineTo(x + 8, RULER);
          g.lineTo(x, RULER + 8);
        } else {
          g.moveTo(x, RULER);
          g.lineTo(x - 8, RULER);
          g.lineTo(x, RULER + 8);
        }
        g.fill();
      }
    });

    // playhead
    const px = Math.round(msToX(playheadMs, view)) + 0.5;
    if (px >= 0 && px <= width) {
      g.strokeStyle = "#ffffff";
      g.lineWidth = 1;
      g.beginPath();
      g.moveTo(px, 0);
      g.lineTo(px, WAVE_HEIGHT);
      g.stroke();
    }
  }, [peaks, durationMs, rows, view, playheadMs, selected, width]);

  // The wheel must be a non-passive listener to stop the page from scrolling.
  useEffect(() => {
    const el = canvas.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const x = e.clientX - el.getBoundingClientRect().left;
      if (e.ctrlKey || e.metaKey) {
        latest.current.onZoomWheel(Math.exp(-e.deltaY * 0.01), x);
      } else {
        latest.current.onPan(Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY);
      }
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  function localX(e: React.PointerEvent): number {
    return e.clientX - e.currentTarget.getBoundingClientRect().left;
  }

  return (
    <canvas
      ref={canvas}
      data-testid="timing-waveform"
      style={{ width, height: WAVE_HEIGHT, touchAction: "none" }}
      className="block cursor-crosshair rounded-[8px] border border-line"
      aria-label="Waveform. Drag the gold and green handles to move a verse's start or end; click to move the playhead; Ctrl or ⌘ with the wheel zooms."
      role="img"
      onPointerDown={(e) => {
        const x = localX(e);
        e.currentTarget.setPointerCapture(e.pointerId);
        const hit =
          e.clientY - e.currentTarget.getBoundingClientRect().top > RULER
            ? hitHandle(rows, x, view)
            : null;
        if (hit) {
          drag.current = hit;
          props.onSelect(hit.index);
        } else {
          drag.current = "scrub";
          props.onScrub(Math.min(Math.max(0, xToMs(x, view)), durationMs));
        }
      }}
      onPointerMove={(e) => {
        const x = localX(e);
        const d = drag.current;
        if (d === "scrub") {
          props.onScrub(Math.min(Math.max(0, xToMs(x, view)), durationMs));
        } else if (d) {
          props.onDrag(d.index, d.which, xToMs(x, view));
        } else {
          e.currentTarget.style.cursor = hitHandle(rows, x, view) ? "col-resize" : "crosshair";
        }
      }}
      onPointerUp={() => {
        if (drag.current && drag.current !== "scrub") props.onDragEnd();
        drag.current = null;
      }}
      onPointerCancel={() => {
        drag.current = null;
      }}
    />
  );
}
