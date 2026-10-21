"use client";

import { BarLink } from "@/client/components/ui/bar";
import { ACTIVITY_KEY, isActivity, type Activity } from "@/client/lib/activity-store";
import { useStoredPref } from "@/client/lib/prefs";
import { useRecent } from "@/client/lib/recent-store";
import { STEPS, stepIndex } from "@/shared/memorize/steps";
import { bookBySlug } from "@/shared/scripture/books";
import { parsePassageParam } from "@/shared/scripture/passage-param";
import { formatReference } from "@/shared/scripture/refs";

const isStored = (value: unknown): value is Activity | null => value === null || isActivity(value);

/**
 * Home's Continue bar: back to whatever you did last. Memorizing (with the step you were on)
 * counts as more recent than reading when it happened later; a first visit starts at John 1.
 */
export function ContinueBar() {
  const lastRead = useRecent()[0];
  const [practised] = useStoredPref<Activity | null>(ACTIVITY_KEY, null, isStored);
  const passage = practised ? parsePassageParam(practised.p) : null;

  if (practised && passage && (!lastRead || practised.at >= lastRead.openedAt)) {
    const path = practised.kind === "steps" ? "/memorize/steps" : "/memorize/flashcards";
    const params = new URLSearchParams({ p: practised.p });
    if (practised.step) params.set("step", practised.step);
    const where =
      practised.kind === "steps" && practised.step
        ? `last: ${STEPS[stepIndex(practised.step)].label}`
        : "Flashcards";
    return (
      <BarLink
        href={`${path}?${params}`}
        icon="book"
        title="Continue"
        subtitle={`${formatReference(passage)} · ${where}`}
      />
    );
  }

  const name = lastRead ? `${bookBySlug(lastRead.book)?.name} ${lastRead.chapter}` : null;
  return (
    <BarLink
      href={lastRead ? `/read/${lastRead.book}/${lastRead.chapter}` : "/read/john/1"}
      icon="book"
      title="Continue"
      subtitle={name ?? "Start with John 1"}
    />
  );
}
