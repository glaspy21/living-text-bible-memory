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
 * Listen and Recall start on one verse, Sing on several, until the listener toggles it.
 * Chain always shows the whole passage. `chosenMulti` is the listener's toggle (null = not chosen).
 */
export function focusModeFor(step: StepId, chosenMulti: boolean | null): FocusMode {
  if (step === "chain") return "whole";
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

/** The line beside the toggle button. `reference` is the current verse like "3". */
export function focusLabel(mode: FocusMode, verse: number, first: number, last: number): string {
  if (mode === "whole") return "Whole passage";
  if (mode === "multi") return `Focus: verse ${verse} · click a verse to move focus`;
  return `Verse ${verse} of ${first}–${last}`;
}

/**
 * Widths (percent) of the dashed placeholder lines standing in for a verse of `length`
 * characters: one line per ~70 characters, the last one shorter, so the shape hints at the length.
 */
export function dashLines(length: number): number[] {
  const lines = Math.max(1, Math.ceil(length / 70));
  return Array.from({ length: lines }, (_, i) =>
    i === lines - 1 && lines > 1 ? 55 + ((length * 7) % 35) : 100,
  );
}
