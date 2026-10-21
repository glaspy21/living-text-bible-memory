import "server-only";
import { db } from "@/server/db/client";
import { createTimingEditor } from "./editor";

export type { EditorData, SessionInfo, SaveResult } from "./editor";
export const timingEditor = createTimingEditor(db);
