import type { IconName } from "@/client/components/ui/icons";
import type { EndMode } from "@/shared/audio/player-machine";

/** The three "when the verse ends" modes, exactly three, each with its own icon (never pause bars). */
export const END_MODES: readonly { mode: EndMode; label: string; icon: IconName }[] = [
  { mode: "loop", label: "Loop Verse", icon: "loop" },
  { mode: "stop", label: "Stop After Verse", icon: "stop" },
  { mode: "next", label: "Next Verse", icon: "next" },
];

/**
 * Starting modes (PROJECT.md decision #10, an assumption taken from the mockup captions):
 * the reader moves on to the next verse; memorization practice loops the verse.
 */
export const DEFAULT_END_MODES = { reader: "next", practice: "loop" } as const;

export type PlayerContextKind = keyof typeof DEFAULT_END_MODES;

export const isEndMode = (value: unknown): value is EndMode =>
  value === "loop" || value === "stop" || value === "next";
