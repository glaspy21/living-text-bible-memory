"use client";

import { useEffect } from "react";
import { formatPassageParam } from "@/shared/scripture/passage-param";
import type { PassageRef } from "@/shared/scripture/types";
import type { PlayerContextKind } from "./end-modes";
import { usePlayer } from "./player-provider";

/**
 * Tells the player which passage this page is about. Render it on any page that has a player; the
 * player looks up that passage's music and, when the page goes away, stops. `context` picks the
 * default end mode: "reader" moves on to the next verse, "practice" loops the verse.
 */
export function PlayerPassage({
  passage,
  context,
}: {
  passage: PassageRef;
  context: PlayerContextKind;
}) {
  const { register } = usePlayer();
  const key = formatPassageParam(passage);
  useEffect(() => {
    register({ passage, context });
    return () => register(null);
    // `key` is the passage's identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, context, register]);
  return null;
}
