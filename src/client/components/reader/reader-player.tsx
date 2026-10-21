"use client";

import { PlayerPassage } from "@/client/player/player-passage";
import { useReaderSelection } from "./reader-selection";

/** Points the player at whatever is selected in the reader (the whole chapter when nothing is). */
export function ReaderPlayer() {
  const { passage } = useReaderSelection();
  return <PlayerPassage passage={passage} context="reader" />;
}
