/**
 * The four memorization steps, exactly: Listen, Sing, Recall, Chain (PROJECT.md §1).
 * Pure rules for what each step shows; the screen only renders them.
 */

export const STEPS = [
  { id: "listen", label: "Listen", help: "Read along as the music plays." },
  { id: "sing", label: "Sing", help: "Sing from the text without relying on the recording." },
  { id: "recall", label: "Recall", help: "The text is hidden — recite it, then reveal to check." },
  {
    id: "chain",
    label: "Chain",
    help: "Several verses hidden — recite or sing them all in order.",
  },
] as const;

export type StepId = (typeof STEPS)[number]["id"];

export const stepIndex = (id: StepId): number => STEPS.findIndex((s) => s.id === id);

/** A `?step=` value, falling back to Listen for anything unknown. */
export function parseStep(value: string | null | undefined): StepId {
  return STEPS.find((s) => s.id === value)?.id ?? "listen";
}

/** The step before (-1) or after (+1), wrapping around: ◀ on Listen goes to Chain. */
export function stepAfter(id: StepId, delta: 1 | -1): StepId {
  return STEPS[(stepIndex(id) + delta + STEPS.length) % STEPS.length].id;
}

/** Recall and Chain hide the text behind dashed lines until revealed. */
export const hidesText = (id: StepId): boolean => id === "recall" || id === "chain";

/** How many verses are in focus: one, several (the rest faded), or the whole passage (Chain). */
export type FocusMode = "single" | "multi" | "whole";

/**
 * Listen starts on one verse and Sing on several, until the listener toggles it. Recall always shows
 * one verse at a time, and Chain always shows the whole passage. `chosenMulti` is the listener's toggle (null = not chosen).
 */
export function focusModeFor(step: StepId, chosenMulti: boolean | null): FocusMode {
  if (step === "chain") return "whole";
  if (step === "recall") return "single";
  return (chosenMulti ?? step === "sing") ? "multi" : "single";
}

export type Visibility = "focused" | "faded" | "gone" | "plain";

/**
 * How one verse shows. In single focus the others are hidden (`gone`), in multi they are faded
 * (about 34% opacity) and in the whole-passage view nothing is faded. Text size never changes.
 */
export function visibility(mode: FocusMode, index: number, focus: number): Visibility {
  if (mode === "whole") return "plain";
  if (index === focus) return "focused";
  return mode === "multi" ? "faded" : "gone";
}

/** The words of a verse, as Recall reveals them one at a time. */
export const wordsOf = (text: string): string[] => text.split(/\s+/).filter(Boolean);

export type RevealAction = "reveal-word" | "reveal-verse" | "hide-word" | "hide-verse";

/**
 * Recall's four buttons work on the whole passage in order, never stopping at a verse's edge.
 * `shown[i]` is how many words of verse `i` show and `totals[i]` its word count. Reveal goes on from
 * the focused verse to the first one that is not fully showing (a word, or the rest of that verse);
 * hide goes back from the focused verse to the last one with anything showing. Returns the new
 * counts and the verse that now has the focus, or null when there is nothing left to do.
 */
export function revealStep(
  action: RevealAction,
  shown: Readonly<Record<number, number>>,
  focus: number,
  totals: readonly number[],
): { shown: Record<number, number>; focus: number } | null {
  const count = (i: number) => shown[i] ?? 0;
  if (action === "reveal-word" || action === "reveal-verse") {
    let at = focus;
    while (at < totals.length && count(at) >= totals[at]) at++;
    if (at >= totals.length) return null;
    return {
      shown: { ...shown, [at]: action === "reveal-word" ? count(at) + 1 : totals[at] },
      focus: at,
    };
  }
  let at = Math.min(focus, totals.length - 1);
  while (at >= 0 && count(at) === 0) at--;
  if (at < 0) return null;
  return { shown: { ...shown, [at]: action === "hide-word" ? count(at) - 1 : 0 }, focus: at };
}
