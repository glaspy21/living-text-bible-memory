import "server-only";
import { db } from "@/server/db/client";
import { createAdminLibrary } from "./admin-library";
import { createAvailability } from "./availability";
import { getStorage } from "@/server/storage";
import { bookVerseCounts } from "@/server/scripture";
import { createPlayback } from "./playback";
import { createRecordings } from "./recordings";

const availability = createAvailability(db);
const playback = createPlayback(db);
const adminLibrary = createAdminLibrary(db);

export type { LibraryRow, DashboardSummary } from "./admin-library";
export const listLibrary = adminLibrary.list;
export const adminDashboard = adminLibrary.dashboard;

export const playableFor = playback.playableFor;

/**
 * The dots and "recording available" notes are a courtesy, so if the database is unreachable the
 * reader still works and simply shows no music, instead of failing the whole page.
 */
async function orElse<T>(fallback: T, read: () => Promise<T>): Promise<T> {
  try {
    return await read();
  } catch (error) {
    console.warn(
      "Music availability could not be read (is DATABASE_URL set?):",
      error instanceof Error ? error.message : error,
    );
    return fallback;
  }
}

export const booksWithMusic = () => orElse(new Set<string>(), availability.booksWithMusic);
export const chaptersWithMusic = (book: string) =>
  orElse<number[]>([], () => availability.chaptersWithMusic(book));
export const chaptersWithMusicByBook = () =>
  orElse<Record<string, number[]>>({}, availability.chaptersWithMusicByBook);
export const chapterHasMusic = (book: string, chapter: number) =>
  orElse(false, () => availability.chapterHasMusic(book, chapter));

/** Turn a verified upload into a draft recording (admin routes only). */
export const createDraftRecording: ReturnType<typeof createRecordings>["createDraft"] = (...args) =>
  createRecordings({ client: db, storage: getStorage(), verseCounts: bookVerseCounts }).createDraft(
    ...args,
  );

/** Put new audio on an existing recording (admin routes only); see `replaceAudio`. */
export const replaceRecordingAudio: ReturnType<typeof createRecordings>["replaceAudio"] = (
  ...args
) =>
  createRecordings({
    client: db,
    storage: getStorage(),
    verseCounts: bookVerseCounts,
  }).replaceAudio(...args);
