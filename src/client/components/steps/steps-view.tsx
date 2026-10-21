"use client";

import Link from "next/link";
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { Attribution } from "@/client/components/scripture/attribution";
import { Main, RightPanel } from "@/client/components/shell/regions";
import { PassageCard } from "@/client/components/ui/passage-card";
import { Icon } from "@/client/components/ui/icons";
import { recordActivity } from "@/client/lib/activity-store";
import { cn } from "@/client/lib/cn";
import { END_MODES } from "@/client/player/end-modes";
import { PlayerPassage } from "@/client/player/player-passage";
import { usePlayer } from "@/client/player/player-provider";
import {
  STEPS,
  focusModeFor,
  hidesText,
  revealStep,
  wordsOf,
  type RevealAction,
  stepAfter,
  stepIndex,
  visibility,
  type StepId,
} from "@/shared/memorize/steps";
import { formatPassageParam, withPassage } from "@/shared/scripture/passage-param";
import { formatReference } from "@/shared/scripture/refs";
import type { PassageRef, PassageVerse, TranslationCode } from "@/shared/scripture/types";

const card = "rounded-[10px] border border-line bg-[rgba(18,18,18,.7)] p-[18px]";
const cardLabel = "text-[11px] tracking-[.14em] text-muted uppercase";
const miniButton =
  "grid h-[42px] w-[42px] place-items-center rounded-[10px] border-[1.5px] border-gold bg-[rgba(12,10,6,.8)] text-gold transition-[background,box-shadow] duration-200 hover:text-gold2 disabled:opacity-40";

/** The plain gold triangles of the reader's chapter arrows: no outline. */
const triangle =
  "inline-flex h-9 w-9 items-center justify-center rounded-md text-heading transition-colors hover:bg-[rgba(201,164,92,.08)] disabled:pointer-events-none disabled:opacity-30";

/** Recall: the words revealed so far, the rest as dashes the length of each word. */
function RecallWords({ text, shown }: { text: string; shown: number }) {
  return (
    <>
      {wordsOf(text).map((word, i) => (
        <span key={i}>
          {i > 0 && " "}
          {i < shown ? (
            word
          ) : (
            <span
              aria-hidden="true"
              style={{ width: `${Math.max(1.2, word.length * 0.5)}em` }}
              className="mx-[3px] inline-block h-[1em] border-b-[1.5px] border-dashed border-[rgba(236,230,216,.42)] group-data-[vis=faded]:border-[rgba(236,230,216,.9)]"
            />
          )}
        </span>
      ))}
    </>
  );
}

/** One of Recall's reveal/hide buttons (gold wipe on hover). */
function RecallButton({
  label,
  disabled,
  onClick,
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="wipe inline-flex items-center justify-center rounded-full border border-gold bg-[rgba(201,164,92,.07)] px-5 py-2.5 font-serif text-[17px] text-gold2 disabled:pointer-events-none disabled:opacity-40"
    >
      {label}
      <span className="wipe-fill" aria-hidden="true">
        {label}
      </span>
    </button>
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
  // Recall: how many words of each verse (by position) are showing.
  const [shownWords, setShownWords] = useState<Record<number, number>>({});
  const [help, setHelp] = useState(false);
  const [focus, setFocus] = useState(0);
  // Several verses to one: the others fade away first with the chosen verse staying put (`fading`),
  // then they close up at once (`snap`) and the verse glides up to the top.
  const [fading, setFading] = useState(false);
  const [snap, setSnap] = useState(false);
  // One verse view, another verse chosen: the verses swap at once, never both on screen.
  const [swap, setSwap] = useState(false);
  const glideFrom = useRef<number | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);

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
  // Recall always shows one verse and Chain the whole passage: the view cannot be changed there.
  const viewLocked = step === "recall" || step === "chain";
  const focusedVerse = verses[focus];
  const current = STEPS[stepIndex(step)];
  const hidden = hidesText(step);

  const resetReveal = () => {
    setShownWords({});
  };
  const goToStep = (next: StepId) => {
    setStep(next);
    resetReveal();
    setHelp(false);
  };
  /**
   * Keeps the focused verse completely still on screen while the verses before it open up again
   * (single to several): each frame it is put back where it started, by scrolling when there is
   * scroll to give, and otherwise by a spacer above it that shrinks away as they come back. The
   * area also borrows some room below so there is always something to scroll over meanwhile.
   */
  const holdFocusedVerse = () => {
    const region = document.querySelector<HTMLElement>("[data-testid=scripture]");
    const verse = region?.querySelector<HTMLElement>("[data-vis=focused]");
    if (!region || !verse) return;
    const wanted = verse.getBoundingClientRect().top - region.getBoundingClientRect().top;
    // The area's own padding, without any spacer left from an earlier hold.
    region.style.removeProperty("padding-top");
    region.style.removeProperty("padding-bottom");
    const restingTop = parseFloat(getComputedStyle(region).paddingTop);
    const restingBottom = parseFloat(getComputedStyle(region).paddingBottom);
    region.style.paddingBottom = `${region.clientHeight}px`;
    const until = performance.now() + 1500;
    const hold = () => {
      region.style.paddingTop = `${restingTop}px`;
      const drift = verse.getBoundingClientRect().top - region.getBoundingClientRect().top - wanted;
      if (drift > 0) {
        region.scrollTop += drift;
      } else if (drift < 0) {
        const back = Math.min(region.scrollTop, -drift);
        region.scrollTop -= back;
        region.style.paddingTop = `${restingTop + (-drift - back)}px`;
      }
      if (performance.now() < until) return requestAnimationFrame(hold);
      // Keep only as much room below as the position needs (verse 18 of 18 has nothing after
      // it, and simply stays where it is with space below).
      const lent = parseFloat(region.style.paddingBottom);
      const content = region.scrollHeight - lent;
      const needed = region.scrollTop + region.clientHeight - content;
      region.style.paddingBottom = `${Math.max(restingBottom, Math.min(lent, needed))}px`;
    };
    requestAnimationFrame(hold);
  };
  const toggleMulti = () => {
    if (viewLocked || fading) return;
    setSwap(false);
    resetReveal();
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (mode === "single") {
      holdFocusedVerse();
      return setChosenMulti(true);
    }
    if (reduced) return setChosenMulti(false);
    setFading(true);
    timers.current.push(
      setTimeout(() => {
        glideFrom.current =
          document.querySelector("[data-vis=focused]")?.getBoundingClientRect().top ?? null;
        setSnap(true);
        setFading(false);
        setChosenMulti(false);
        // Fade (320ms), then a clear pause with the verse alone and still, then the glide.
      }, 720),
    );
  };

  // After the others have closed up, the verse that stayed put glides to the top.
  useLayoutEffect(() => {
    const from = glideFrom.current;
    if (mode !== "single" || from === null) return;
    glideFrom.current = null;
    const region = document.querySelector<HTMLElement>("[data-testid=scripture]");
    const verse = region?.querySelector<HTMLElement>("[data-vis=focused]");
    if (!region || !verse) {
      timers.current.push(setTimeout(() => setSnap(false), 0));
      return;
    }
    region.style.removeProperty("padding-top");
    region.style.removeProperty("padding-bottom");
    region.scrollTop = 0;
    const delta = from - verse.getBoundingClientRect().top;
    if (Math.abs(delta) > 1) {
      verse.style.transition = "none";
      verse.style.transform = `translateY(${delta}px)`;
      void verse.offsetHeight; // settle the starting point before animating
      verse.style.transition = "transform 480ms cubic-bezier(.4,0,.2,1)";
      verse.style.transform = "translateY(0)";
    }
    timers.current.push(
      setTimeout(() => {
        verse.style.removeProperty("transition");
        verse.style.removeProperty("transform");
        setSnap(false);
      }, 520),
    );
  }, [mode]);

  // Another verse takes the focus (or another step opens): drop any spacer left above the old one.
  useEffect(() => {
    document
      .querySelector<HTMLElement>("[data-testid=scripture]")
      ?.style.removeProperty("padding-top");
  }, [focus, step]);
  const focusOn = (index: number, keepReveal = false) => {
    setSwap(mode === "single");
    setFocus(index);
    if (!keepReveal) resetReveal();
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
        <div className="mx-auto flex h-full w-full max-w-[760px] flex-col" data-step={step}>
          <div className="grid grid-cols-[auto_1fr_auto] items-center gap-3">
            <button
              type="button"
              // The icon shows the view; the button itself looks the same in both.
              className={miniButton}
              aria-label="Show several verses"
              aria-pressed={mode !== "single"}
              disabled={viewLocked}
              title={
                mode === "whole"
                  ? "Chain always shows the whole passage"
                  : step === "recall"
                    ? "Recall always shows one verse at a time"
                    : mode === "multi"
                      ? "Showing several verses — click to focus on one"
                      : "Showing one verse — click to show the whole passage"
              }
              onClick={toggleMulti}
            >
              <Icon name={mode === "single" ? "list-one" : "list"} size={22} />
            </button>
            <div
              className="flex items-center justify-center gap-2"
              role="group"
              aria-label="Move between verses"
            >
              <button
                type="button"
                className={triangle}
                aria-label="Previous verse"
                disabled={mode === "whole" || focus <= 0}
                onClick={() => focusOn(focus - 1)}
              >
                <Icon name="triangleLeft" size={22} />
              </button>
              <button
                type="button"
                className={triangle}
                aria-label="Next verse"
                disabled={mode === "whole" || focus >= verses.length - 1}
                onClick={() => focusOn(focus + 1)}
              >
                <Icon name="triangleRight" size={22} />
              </button>
            </div>
            <div className="flex items-center justify-end">
              <Link
                href={withPassage("/memorize/flashcards", passage)}
                className="wipe inline-flex h-[42px] shrink-0 items-center whitespace-nowrap gap-[9px] rounded-[10px] border-[1.5px] border-gold bg-[rgba(201,164,92,.07)] px-4 font-serif text-[17px] text-gold2"
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

          {/* The text scrolls in its own area above the steps, fading out toward them, so the
              steps (always at the bottom of the screen) are what the eye rests on. */}
          <div
            key={step}
            className="scripture-scroll mt-[14px] min-h-0 flex-1 overflow-y-auto pt-3 pb-16 font-serif text-[22px] leading-[1.6] max-[520px]:text-[17.5px] max-[520px]:leading-[1.5]"
            data-testid="scripture"
          >
            {verses.map((verse, i) => {
              const vis = visibility(mode, i, focus);
              const distance = Math.abs(i - focus);
              const showText = !hidden;
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
                      ...(swap && mode === "single" && { transition: "none" }),
                      // The others fade out in place; then they close up with no animation.
                      ...(fading &&
                        vis !== "focused" && {
                          opacity: 0,
                          transition: "opacity 320ms ease",
                          transitionDelay: "0ms",
                        }),
                      ...(snap && vis === "gone" && { transition: "none" }),
                    } as CSSProperties
                  }
                  className={cn(
                    "group grid cursor-pointer grid-cols-[46px_1fr] rounded-lg max-[520px]:grid-cols-[34px_1fr]",
                    "transition-[opacity,max-height,margin,padding,background-color,border-color,box-shadow]",
                    // A verse that is out of view fades and then gives up its space, so the one
                    // in focus moves to the top and the page needs no scrolling.
                    vis === "gone"
                      ? "pointer-events-none max-h-0 overflow-hidden border-0 border-transparent opacity-0 duration-200 [transition-delay:calc((var(--max)-var(--d))*25ms)]"
                      : "mb-0.5 max-h-[80rem] border border-transparent py-1.5 pr-3 max-[520px]:py-[5px] max-[520px]:pr-1.5",
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
                  <span>
                    {showText ? (
                      verse.text
                    ) : (
                      <RecallWords text={verse.text} shown={shownWords[i] ?? 0} />
                    )}
                  </span>
                </div>
              );
            })}
          </div>

          {hidden && focusedVerse && (
            <div className="mx-auto my-3.5 grid w-fit grid-cols-2 gap-2.5">
              {(
                [
                  ["Reveal word", "reveal-word"],
                  ["Reveal verse", "reveal-verse"],
                  ["Hide word", "hide-word"],
                  ["Hide verse", "hide-verse"],
                ] as [string, RevealAction][]
              ).map(([label, action]) => {
                // Chain shows the whole passage, so it works through it from the start (or, hiding,
                // from the end); Recall works from the verse in focus.
                const from =
                  step !== "chain" ? focus : action.startsWith("reveal") ? 0 : verses.length - 1;
                const move = () =>
                  revealStep(
                    action,
                    shownWords,
                    from,
                    verses.map((v) => wordsOf(v.text).length),
                  );
                return (
                  <RecallButton
                    key={action}
                    label={label}
                    disabled={move() === null}
                    onClick={() => {
                      const next = move();
                      if (!next) return;
                      setShownWords(next.shown);
                      if (step === "recall" && next.focus !== focus) focusOn(next.focus, true);
                    }}
                  />
                );
              })}
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
        <PassageCard
          reference={formatReference(passage)}
          editHref={`${withPassage("/memorize/range", passage)}&from=steps&step=${step}`}
          testId="panel-passage"
        />
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
