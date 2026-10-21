"use client";

import Link from "next/link";
import { useEffect, useState, type CSSProperties } from "react";
import { Attribution } from "@/client/components/scripture/attribution";
import { Main, RightPanel } from "@/client/components/shell/regions";
import { Icon } from "@/client/components/ui/icons";
import { recordActivity } from "@/client/lib/activity-store";
import { cn } from "@/client/lib/cn";
import { END_MODES } from "@/client/player/end-modes";
import { PlayerPassage } from "@/client/player/player-passage";
import { usePlayer } from "@/client/player/player-provider";
import {
  STEPS,
  dashLines,
  focusLabel,
  focusModeFor,
  hidesText,
  stepAfter,
  stepIndex,
  visibility,
  type StepId,
} from "@/shared/memorize/steps";
import { formatPassageParam, withPassage } from "@/shared/scripture/passage-param";
import { bookBySlug } from "@/shared/scripture/books";
import { formatReference } from "@/shared/scripture/refs";
import type { PassageRef, PassageVerse, TranslationCode } from "@/shared/scripture/types";

const card = "rounded-[10px] border border-line bg-[rgba(18,18,18,.7)] p-[18px]";
const cardLabel = "text-[11px] tracking-[.14em] text-muted uppercase";
const miniButton =
  "grid h-[42px] w-[42px] place-items-center rounded-[10px] border-[1.5px] border-gold bg-[rgba(12,10,6,.8)] text-gold transition-[background,box-shadow] duration-200 hover:text-gold2 disabled:opacity-40";

/** One verse's dashed stand-in while the text is hidden. */
function Dashes({ length }: { length: number }) {
  return (
    <>
      {dashLines(length).map((width, i) => (
        <div
          key={i}
          style={{ width: `${width}%` }}
          className="mb-1 h-[26px] border-b-[1.5px] border-dashed border-[rgba(236,230,216,.42)] group-data-[vis=faded]:border-[rgba(236,230,216,.9)]"
        />
      ))}
    </>
  );
}

/**
 * Listen · Sing · Recall · Chain for a passage. The toggle at the top left switches between one
 * verse in focus and several (others faded, text size never changes); Chain always shows the
 * whole passage. Recall and Chain hide the text until revealed.
 */
export function StepsView({
  passage,
  verses,
  translation,
  note,
  initialStep,
}: {
  passage: PassageRef;
  verses: PassageVerse[];
  translation: TranslationCode;
  note: string | null;
  initialStep: StepId;
}) {
  const player = usePlayer();
  const [step, setStep] = useState<StepId>(initialStep);
  const [chosenMulti, setChosenMulti] = useState<boolean | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [help, setHelp] = useState(false);
  const [focus, setFocus] = useState(0);

  // The verse being sung moves the focus along (adjusting state while rendering, not in an effect).
  const [seenPlayerIndex, setSeenPlayerIndex] = useState(player.index);
  if (seenPlayerIndex !== player.index) {
    setSeenPlayerIndex(player.index);
    const sung = player.currentVerse;
    const at = sung
      ? verses.findIndex(
          (v) => v.book === sung.book && v.chapter === sung.chapter && v.verse === sung.verse,
        )
      : -1;
    if (player.hasMusic && at >= 0) setFocus(at);
  }

  const param = formatPassageParam(passage);
  useEffect(() => {
    recordActivity({ kind: "steps", p: param, step });
    const url = new URL(window.location.href);
    url.searchParams.set("step", step);
    window.history.replaceState(window.history.state, "", url);
  }, [param, step]);

  const mode = focusModeFor(step, chosenMulti);
  const current = STEPS[stepIndex(step)];
  const hidden = hidesText(step);
  const focused = verses[focus];

  const goToStep = (next: StepId) => {
    setStep(next);
    setRevealed(false);
    setHelp(false);
  };
  const toggleMulti = () => {
    if (mode === "whole") return;
    setChosenMulti(mode !== "multi");
    setRevealed(false);
  };
  const focusOn = (index: number) => {
    setFocus(index);
    setRevealed(false);
    const wanted = verses[index];
    const at = player.verses.findIndex(
      (v) => v.book === wanted.book && v.chapter === wanted.chapter && v.verse === wanted.verse,
    );
    if (at >= 0) player.seekVerse(at);
  };

  const genreName = player.genres.find((g) => g.slug === player.genre)?.name;
  const activeMode = END_MODES.find((m) => m.mode === player.endMode)!;
  const farthest = Math.max(focus, verses.length - 1 - focus);

  return (
    <>
      <PlayerPassage passage={passage} context="practice" />
      <Main player>
        <div className="mx-auto flex min-h-full w-full max-w-[760px] flex-col" data-step={step}>
          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              // The icon shows the view; the button itself looks the same in both.
              className={miniButton}
              aria-label="Show several verses"
              aria-pressed={mode !== "single"}
              disabled={mode === "whole"}
              title={
                mode === "whole"
                  ? "Chain always shows the whole passage"
                  : mode === "multi"
                    ? "Showing several verses — click to focus on one"
                    : "Showing one verse — click to show the whole passage"
              }
              onClick={toggleMulti}
            >
              <Icon name={mode === "single" ? "list-one" : "list"} size={22} />
            </button>
            <div className="flex items-center gap-4">
              <span className="text-muted max-[520px]:hidden" data-testid="focus-label">
                {passage.endBook && mode !== "whole" && focused
                  ? // Verse numbers alone are ambiguous across books, so name the verse.
                    `${bookBySlug(focused.book)?.name ?? focused.book} ${focused.chapter}:${focused.verse}${
                      mode === "multi" ? " · click a verse to move focus" : ""
                    }`
                  : focusLabel(
                      mode,
                      focused?.verse ?? 0,
                      verses[0].verse,
                      verses[verses.length - 1].verse,
                    )}
              </span>
              <Link
                href={withPassage("/memorize/flashcards", passage)}
                className="wipe inline-flex items-center gap-[9px] rounded-[7px] border border-gold bg-[rgba(201,164,92,.07)] px-3 py-[5px] text-xs text-gold2"
              >
                <Icon name="cards" size={20} />
                Switch to Flashcards
                <span className="wipe-fill" aria-hidden="true">
                  <Icon name="cards" size={20} />
                  Switch to Flashcards
                </span>
              </Link>
            </div>
          </div>

          {note && (
            <p className="mt-3 font-serif text-[15px] text-muted italic" role="note">
              {note}
            </p>
          )}

          <div
            key={step}
            className="mt-[26px] flex-1 font-serif text-[22px] leading-[1.6] max-[520px]:text-[17.5px] max-[520px]:leading-[1.5]"
            data-testid="scripture"
          >
            {verses.map((verse, i) => {
              const vis = visibility(mode, i, focus);
              const distance = Math.abs(i - focus);
              const showText = !hidden || (revealed && (mode === "whole" || i === focus));
              return (
                <div
                  key={`${verse.book}:${verse.chapter}:${verse.verse}`}
                  role="button"
                  tabIndex={vis === "gone" ? -1 : 0}
                  aria-label={`Verse ${verse.verse}`}
                  aria-current={vis === "focused" ? "true" : undefined}
                  aria-hidden={vis === "gone" ? true : undefined}
                  data-verse={verse.verse}
                  data-vis={vis}
                  onClick={() => focusOn(i)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      focusOn(i);
                    }
                  }}
                  style={
                    {
                      "--d": distance,
                      "--max": farthest,
                      "--o": vis === "faded" ? 0.34 : 1,
                      animation: "cascade .8s backwards",
                      animationDelay: `${i * 120}ms`,
                    } as CSSProperties
                  }
                  className={cn(
                    "group mb-0.5 grid cursor-pointer grid-cols-[46px_1fr] rounded-lg border border-transparent py-1.5 pr-3 max-[520px]:grid-cols-[34px_1fr] max-[520px]:py-[5px] max-[520px]:pr-1.5",
                    "transition-[opacity,background-color,border-color,box-shadow]",
                    vis === "gone" &&
                      "pointer-events-none opacity-0 duration-200 [transition-delay:calc((var(--max)-var(--d))*25ms)]",
                    vis === "faded" &&
                      "opacity-[.34] duration-[450ms] [transition-delay:calc(var(--d)*70ms)] hover:opacity-60",
                    vis === "focused" &&
                      "border-gold bg-gradient-to-b from-[rgba(212,168,79,.16)] to-[rgba(212,168,79,.07)] opacity-100 shadow-[0_0_24px_rgba(212,168,79,.12)] duration-[250ms]",
                    vis === "plain" && "opacity-100 duration-[250ms]",
                  )}
                >
                  <span
                    className="pl-2.5 text-[21px] leading-[1.5] text-gold max-[520px]:pl-1.5 max-[520px]:text-[17px]"
                    aria-hidden="true"
                  >
                    {verse.verse}
                  </span>
                  <span>{showText ? verse.text : <Dashes length={verse.text.length} />}</span>
                </div>
              );
            })}
          </div>

          {hidden && (
            <div className="my-3.5 text-center">
              <button
                type="button"
                aria-pressed={revealed}
                onClick={() => setRevealed((r) => !r)}
                className="wipe inline-flex items-center gap-[9px] rounded-full border border-gold bg-[rgba(201,164,92,.07)] px-[34px] py-3 font-serif text-[19px] text-gold2"
              >
                <Icon name="eye" size={20} />
                {revealed ? "Hide Scripture" : "Reveal Scripture"}
                <span className="wipe-fill" aria-hidden="true">
                  <Icon name="eye" size={20} />
                  {revealed ? "Hide Scripture" : "Reveal Scripture"}
                </span>
              </button>
            </div>
          )}

          <div className="mt-2 flex justify-end">
            <button
              type="button"
              className={cn(miniButton, "rounded-full")}
              aria-label="Help"
              aria-expanded={help}
              aria-controls="step-help"
              onClick={() => setHelp((h) => !h)}
            >
              <Icon name="help" size={22} />
            </button>
          </div>
          {help && (
            <p
              id="step-help"
              className="mt-3 rounded-r-lg border-l-2 border-gold bg-[rgba(212,168,79,.07)] px-4 py-3 text-[13px] text-muted"
            >
              <b className="font-medium text-gold2">{current.label}.</b> {current.help}
            </p>
          )}

          <nav
            aria-label="Memorization steps"
            className="mt-3 flex items-center gap-2.5 rounded-[14px] border border-line bg-[rgba(22,19,13,.85)] px-4 pt-4 pb-3 max-[520px]:gap-1 max-[520px]:px-2 max-[520px]:pt-3 max-[520px]:pb-2.5"
          >
            <button
              type="button"
              aria-label="Previous step"
              onClick={() => goToStep(stepAfter(step, -1))}
              className="grid h-[30px] w-[30px] place-items-center text-gold hover:text-gold2"
            >
              <Icon name="triangleLeft" size={22} />
            </button>
            <div className="relative flex flex-1 justify-between px-[6%]">
              <div
                className="absolute inset-x-[12%] top-[11px] h-px bg-gold-dim"
                aria-hidden="true"
              />
              {STEPS.map((s) => {
                const active = s.id === step;
                return (
                  <button
                    key={s.id}
                    type="button"
                    aria-current={active ? "step" : undefined}
                    onClick={() => goToStep(s.id)}
                    className={cn(
                      "relative z-[1] flex flex-col items-center gap-[9px] font-serif text-[17px]",
                      active ? "text-gold2" : "text-text",
                    )}
                  >
                    <i
                      className={cn(
                        "block h-[22px] w-[22px] rounded-full border-[1.5px] transition-[background,box-shadow,border-color] duration-200",
                        active
                          ? "border-gold2 bg-[radial-gradient(circle_at_40%_35%,#fff4d2,#e8cb8a_50%,#a8843f)] shadow-[0_0_16px_rgba(232,203,138,.75)]"
                          : "border-gold-dim bg-[#0b0b0b]",
                      )}
                    />
                    {s.label}
                  </button>
                );
              })}
            </div>
            <button
              type="button"
              aria-label="Next step"
              onClick={() => goToStep(stepAfter(step, 1))}
              className="grid h-[30px] w-[30px] place-items-center text-gold hover:text-gold2"
            >
              <Icon name="triangleRight" size={22} />
            </button>
          </nav>
          <Attribution translation={translation} className="mt-4" />
        </div>
      </Main>
      <RightPanel label="Passage settings">
        <h2 className="font-serif text-[22px] font-medium text-heading">{current.label}</h2>
        <p className="mt-1.5 mb-[18px] text-muted">{current.help}</p>
        <div className={card}>
          <div className={cardLabel}>Passage</div>
          <div className="mt-1 font-serif text-[22px] text-gold2" data-testid="panel-passage">
            {formatReference(passage)}
          </div>
          <Link
            href={withPassage("/memorize/range", passage)}
            className="wipe mt-3 inline-flex items-center rounded-[7px] border border-line px-3 py-[5px] text-xs text-muted"
          >
            Edit range
          </Link>
        </div>
        <div className={cn(card, "mt-3.5")}>
          <div className={cardLabel}>When the verse ends</div>
          <div className="mt-2.5 flex items-center gap-3 text-gold">
            <Icon name={activeMode.icon} size={22} />
            <span className="text-text">{activeMode.label}</span>
          </div>
        </div>
        <div className={cn(card, "mt-3.5")}>
          <div className={cardLabel}>Genre</div>
          <div className="mt-2.5 flex items-center gap-3 text-gold">
            <Icon name="note" size={22} />
            <span className="text-text">{genreName ?? "No recording yet"}</span>
          </div>
        </div>
      </RightPanel>
    </>
  );
}
