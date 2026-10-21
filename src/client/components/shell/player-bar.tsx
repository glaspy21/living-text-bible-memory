"use client";

import { useRef, useState, type ReactNode } from "react";
import { Icon, type IconName } from "@/client/components/ui/icons";
import { cn } from "@/client/lib/cn";
import { END_MODES } from "@/client/player/end-modes";
import { usePlayer, useVersePosition } from "@/client/player/player-provider";
import { formatTime } from "@/shared/audio/format-time";
import { arrangementLabel } from "@/shared/audio/playlist";

function TransportButton({
  icon,
  label,
  onClick,
  disabled,
  play = false,
}: {
  icon: IconName;
  label: string;
  onClick?: () => void;
  disabled?: boolean;
  play?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "grid place-items-center rounded-full text-gold transition-[color,box-shadow] hover:text-gold2 hover:shadow-[0_0_14px_rgba(212,168,79,.25)] disabled:cursor-default disabled:opacity-40 disabled:shadow-none",
        play ? "h-[60px] w-[60px] border-[1.5px] border-gold bg-[#0a0a0a]" : "h-10 w-10",
      )}
    >
      <Icon name={icon} size={play ? 28 : 26} />
    </button>
  );
}

/** A button with a small menu that opens above it; closes on Escape, outside click or choosing. */
function MenuButton({
  icon,
  label,
  align,
  disabled,
  children,
}: {
  icon: IconName;
  label: string;
  align: "left" | "right";
  disabled?: boolean;
  children: (close: () => void) => ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  return (
    <div
      ref={root}
      className="relative inline-flex"
      onKeyDown={(event) => event.key === "Escape" && setOpen(false)}
      onBlur={(event) => {
        if (!root.current?.contains(event.relatedTarget)) setOpen(false);
      }}
    >
      <TransportButton
        icon={icon}
        label={label}
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
      />
      {open && (
        <div
          role="menu"
          aria-label={label}
          className={cn(
            "popin absolute bottom-[54px] z-10 w-[250px] rounded-[10px] border border-line2 bg-[#0c0c0c] p-1.5 shadow-[0_14px_40px_rgba(0,0,0,.75)]",
            align === "left" ? "left-0" : "right-0",
          )}
        >
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  );
}

const menuItem =
  "flex w-full items-center gap-3 rounded-md p-2.5 text-left text-text hover:bg-[rgba(201,164,92,.08)]";

/**
 * Player layout (matches mobile): progress + times, then
 * end mode | skip back | ring play | skip forward | genre.
 * Progress is within the current verse.
 */
export function PlayerBar() {
  const player = usePlayer();
  const position = useVersePosition();
  const { segment, hasMusic } = player;

  const length = segment ? segment.endMs - segment.startMs : 0;
  const playing = player.status === "playing" || player.status === "loading";
  const activeMode = END_MODES.find((m) => m.mode === player.endMode)!;

  let times: ReactNode;
  if (player.error) {
    times = <span className="text-err">{player.error}</span>;
  } else if (player.loadingMusic) {
    times = <span className="text-muted">Looking for music…</span>;
  } else if (!hasMusic) {
    times = <span className="text-muted">No recording yet</span>;
  } else {
    times = (
      <>
        <span>{formatTime(position)}</span>
        <span>{formatTime(length)}</span>
      </>
    );
  }

  return (
    <footer className="shell-player" aria-label="Player">
      <div className="flex w-full max-w-[680px] flex-col gap-1 px-6">
        <div
          className="relative mt-1 h-1 rounded bg-[#2c2a26]"
          role="progressbar"
          aria-label="Position in this verse"
          aria-valuemin={0}
          aria-valuemax={Math.round(length / 1000)}
          aria-valuenow={Math.round(position / 1000)}
        >
          <i
            className="absolute inset-y-0 left-0 rounded bg-gradient-to-r from-[#e8cb8a] to-[#d4a84f]"
            style={{ width: length ? `${Math.min(100, (position / length) * 100)}%` : 0 }}
          />
        </div>
        <div className="flex min-h-[18px] justify-between text-xs text-text">{times}</div>
        <div className="flex items-center justify-between px-1.5 py-0.5">
          <MenuButton
            icon={activeMode.icon}
            label={`When the verse ends: ${activeMode.label}`}
            align="left"
          >
            {(close) =>
              END_MODES.map(({ mode, label, icon }) => (
                <button
                  key={mode}
                  type="button"
                  role="menuitemradio"
                  aria-checked={mode === player.endMode}
                  onClick={() => {
                    player.setEndMode(mode);
                    close();
                  }}
                  className={menuItem}
                >
                  <Icon name={icon} size={20} className="text-gold" />
                  {label}
                  {mode === player.endMode && (
                    <span className="ml-auto text-base text-gold" aria-hidden="true">
                      ✓
                    </span>
                  )}
                </button>
              ))
            }
          </MenuButton>
          <TransportButton
            icon="skipBack"
            label="Previous verse"
            disabled={!hasMusic}
            onClick={() => player.skip(-1)}
          />
          <TransportButton
            icon={playing ? "pause" : "play"}
            label={playing ? "Pause" : "Play"}
            disabled={!hasMusic}
            onClick={playing ? player.pause : player.play}
            play
          />
          <TransportButton
            icon="skipForward"
            label="Next verse"
            disabled={!hasMusic}
            onClick={() => player.skip(1)}
          />
          <MenuButton icon="note" label="Genre" align="right" disabled={!hasMusic}>
            {(close) => (
              <>
                {player.coverage.map((entry) => {
                  const info = player.genres.find((g) => g.slug === entry.genreSlug);
                  return (
                    <button
                      key={entry.genreSlug}
                      type="button"
                      role="menuitemradio"
                      aria-checked={entry.genreSlug === player.genre}
                      onClick={() => {
                        player.setGenre(entry.genreSlug);
                        close();
                      }}
                      className={menuItem}
                    >
                      <span>
                        {info?.name ?? entry.genreSlug}
                        {!entry.complete && (
                          <small className="block text-[11px] text-muted">
                            Music for {entry.covered} of {entry.total} verses
                          </small>
                        )}
                      </span>
                      {entry.genreSlug === player.genre && (
                        <span className="ml-auto text-base text-gold" aria-hidden="true">
                          ✓
                        </span>
                      )}
                    </button>
                  );
                })}
                {player.arrangements.length > 1 && (
                  <>
                    <div
                      role="presentation"
                      className="mt-1 border-t border-line px-3 pt-2 pb-1 text-[11px] tracking-[.14em] text-gold-dim uppercase"
                    >
                      Version
                    </div>
                    {player.arrangements.map((entry) => (
                      <button
                        key={entry.arrangementNo}
                        type="button"
                        role="menuitemradio"
                        data-testid="arrangement-option"
                        aria-checked={entry.arrangementNo === player.arrangement}
                        onClick={() => {
                          player.setArrangement(entry.arrangementNo);
                          close();
                        }}
                        className={menuItem}
                      >
                        <span>
                          {arrangementLabel(entry.arrangementNo)}
                          {!entry.complete && (
                            <small className="block text-[11px] text-muted">
                              Music for {entry.covered} of {entry.total} verses
                            </small>
                          )}
                        </span>
                        {entry.arrangementNo === player.arrangement && (
                          <span className="ml-auto text-base text-gold" aria-hidden="true">
                            ✓
                          </span>
                        )}
                      </button>
                    ))}
                  </>
                )}
              </>
            )}
          </MenuButton>
        </div>
      </div>
    </footer>
  );
}
