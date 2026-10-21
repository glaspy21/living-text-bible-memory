"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button, ButtonLink } from "@/client/components/ui/button";
import { formatTimeMs, type TimingRow } from "@/shared/timing/timing";
import { validateTiming } from "@/shared/timing/validation";
import { ValidationPanel } from "./validation-panel";

type Props = {
  recordingId: string;
  status: "DRAFT" | "READY" | "PUBLISHED";
  /** The sheet shown: the working draft, or the published sheet when there is no draft. */
  hasDraft: boolean;
  draftVersion: number | null;
  rows: TimingRow[];
  labels: string[];
  audioAssetId: string;
  durationMs: number;
};

type Action = "ready" | "draft" | "publish";

/**
 * Preview & publish: the validation result, a way to listen to the verses exactly as timed, and
 * the status buttons (Mark ready, Back to draft, Publish). The server checks everything again.
 */
export function PublishPanel(props: Props) {
  const { recordingId, status, hasDraft, rows, labels, audioAssetId, durationMs } = props;
  const router = useRouter();
  const audio = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState<number | "all" | null>(null);
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const run = useRef<{ index: number; stopAt: number; all: boolean } | null>(null);

  const validation = useMemo(() => validateTiming(rows, durationMs), [rows, durationMs]);
  const timed = rows
    .map((r, i) => ({ r, i }))
    .filter(({ r }) => r.startMs !== null && r.endMs !== null && r.endMs > r.startMs);

  // Follow the audio: stop at the end of a verse, or move on to the next timed verse.
  useEffect(() => {
    if (playing === null) return;
    let raf = 0;
    const tick = () => {
      const a = audio.current;
      const current = run.current;
      if (a && current && a.currentTime * 1000 >= current.stopAt) {
        const next = current.all ? timed.find(({ i }) => i > current.index) : undefined;
        if (next) {
          run.current = { index: next.i, stopAt: next.r.endMs!, all: true };
          a.currentTime = next.r.startMs! / 1000;
          setPlaying(next.i);
        } else {
          a.pause();
          run.current = null;
          setPlaying(null);
          return;
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing === null]);

  function start(index: number, all: boolean) {
    const a = audio.current;
    const row = rows[index];
    if (!a || row.startMs === null || row.endMs === null) return;
    run.current = { index, stopAt: row.endMs, all };
    a.currentTime = row.startMs / 1000;
    void a
      .play()
      .then(() => setPlaying(index))
      .catch(() => setPlaying(null));
  }

  function stop() {
    audio.current?.pause();
    run.current = null;
    setPlaying(null);
  }

  async function act(action: Action) {
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch(`/api/admin/recordings/${recordingId}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const body = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        setMessage({ tone: "error", text: body.error ?? "That did not work." });
      } else {
        setMessage({
          tone: "ok",
          text:
            action === "publish"
              ? "Published. Listeners now hear this timing."
              : action === "ready"
                ? "Marked ready for review."
                : "Back to draft.",
        });
        router.refresh();
      }
    } finally {
      setBusy(false);
    }
  }

  const canAct = validation.ok && hasDraft;
  const firstTimed = timed[0]?.i;

  return (
    <div data-testid="publish-panel" data-status={status}>
      <ValidationPanel rows={rows} durationMs={durationMs} labels={labels} />

      <section
        className="mt-5 rounded-[10px] border border-line bg-[rgba(18,18,18,.7)] p-4"
        aria-label="Preview"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-serif text-[20px] font-medium text-heading">Preview</h2>
          {playing === null ? (
            <Button
              size="sm"
              disabled={firstTimed === undefined}
              onClick={() => firstTimed !== undefined && start(firstTimed, true)}
              data-testid="preview-all"
            >
              Play all verses
            </Button>
          ) : (
            <Button size="sm" onClick={stop} data-testid="preview-stop">
              Stop
            </Button>
          )}
        </div>
        <p className="mt-1 text-[13px] text-muted">
          Plays each verse from its start to its end, as listeners will hear it.
        </p>
        <ul className="mt-3 divide-y divide-[var(--line)]">
          {rows.map((r, i) => (
            <li
              key={`${r.chapter}:${r.verse}`}
              data-testid="preview-row"
              data-playing={playing === i}
              className="flex flex-wrap items-center gap-3 py-2 text-[14px] data-[playing=true]:text-gold-bright"
            >
              <span className="w-12 font-serif text-[17px] text-gold2">{labels[i]}</span>
              <span className="font-mono text-[13px] tabular-nums text-muted">
                {r.startMs === null || r.endMs === null
                  ? "not timed"
                  : `${formatTimeMs(r.startMs)} → ${formatTimeMs(r.endMs)}`}
              </span>
              <Button
                size="sm"
                variant="ghost"
                className="ml-auto"
                disabled={r.startMs === null || r.endMs === null || r.endMs <= r.startMs}
                onClick={() => start(i, false)}
                aria-label={`Play verse ${labels[i]}`}
              >
                Play verse
              </Button>
            </li>
          ))}
        </ul>
        <audio ref={audio} src={`/api/audio/${audioAssetId}`} preload="auto" onEnded={stop} />
      </section>

      <section
        className="mt-5 rounded-[10px] border border-line bg-[rgba(18,18,18,.7)] p-4"
        aria-label="Publish"
      >
        <h2 className="font-serif text-[20px] font-medium text-heading">Publish</h2>
        <p className="mt-1 text-[13px] text-muted" data-testid="publish-help">
          {!hasDraft
            ? "This timing is live. To change it, open the timing editor and start a new draft version; listeners keep this one until you publish the new one."
            : status === "PUBLISHED"
              ? `Draft version ${props.draftVersion} is waiting. Listeners keep hearing the published timing until you publish it.`
              : status === "READY"
                ? "Reviewed and ready. Publishing makes it available to listeners."
                : validation.ok
                  ? "Everything checks out. Mark it ready for review, then publish."
                  : "Fix the problems above (and review the gaps and overlaps) before it can be marked ready."}
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <ButtonLink
            href={`/admin/timing?recording=${recordingId}`}
            variant="ghost"
            data-testid="edit-timing"
          >
            Edit timing
          </ButtonLink>
          {status === "DRAFT" && (
            <Button
              disabled={!canAct || busy}
              onClick={() => act("ready")}
              data-testid="mark-ready"
            >
              Mark ready for review
            </Button>
          )}
          {status === "READY" && (
            <Button
              variant="ghost"
              disabled={busy}
              onClick={() => act("draft")}
              data-testid="back-to-draft"
            >
              Back to draft
            </Button>
          )}
          {(status === "READY" || (status === "PUBLISHED" && hasDraft)) && (
            <Button
              variant="solid"
              disabled={!canAct || busy}
              onClick={() => {
                if (
                  window.confirm("Publish this timing? Listeners will start hearing it right away.")
                )
                  void act("publish");
              }}
              data-testid="publish"
            >
              {status === "PUBLISHED" ? "Publish new version" : "Publish"}
            </Button>
          )}
        </div>
        {message && (
          <p
            role="status"
            data-testid="publish-message"
            className={message.tone === "ok" ? "mt-3 text-ok" : "mt-3 text-err"}
          >
            {message.text}
          </p>
        )}
      </section>
    </div>
  );
}
