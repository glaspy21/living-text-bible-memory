"use client";

import { parsePassageParam } from "@/shared/scripture/passage-param";
import { parseStep, type StepId } from "@/shared/memorize/steps";
import { writePref } from "./prefs";

/** What the listener was last practising, so Continue can pick it up. Kept in this browser only. */
export const ACTIVITY_KEY = "lt.activity.v1";

export type Activity = {
  kind: "steps" | "flashcards";
  /** The passage, as in `?p=`. */
  p: string;
  /** Which step, for memorization steps. */
  step?: StepId;
  at: number;
};

export function isActivity(value: unknown): value is Activity {
  if (typeof value !== "object" || value === null) return false;
  const a = value as Record<string, unknown>;
  return (
    (a.kind === "steps" || a.kind === "flashcards") &&
    typeof a.p === "string" &&
    parsePassageParam(a.p) !== null &&
    typeof a.at === "number" &&
    Number.isFinite(a.at) &&
    (a.step === undefined || parseStep(a.step as string) === a.step)
  );
}

export function recordActivity(activity: Omit<Activity, "at">, now = Date.now()): void {
  writePref(ACTIVITY_KEY, { ...activity, at: now });
}
