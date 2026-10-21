import type { Browser } from "@playwright/test";
import { E2E_ADMIN_EMAIL } from "../../playwright.config";
import type { TestDb } from "./db";
import { signInAs } from "./session";

const SAMPLE_RATE = 8000;
export const TONE_SECONDS = 12;

/** A 12-second 440 Hz tone as a WAV file: real audio the browser can play. */
export function toneWav(): Buffer {
  const samples = SAMPLE_RATE * TONE_SECONDS;
  const data = Buffer.alloc(44 + samples * 2);
  data.write("RIFF", 0);
  data.writeUInt32LE(36 + samples * 2, 4);
  data.write("WAVE", 8);
  data.write("fmt ", 12);
  data.writeUInt32LE(16, 16);
  data.writeUInt16LE(1, 20); // PCM
  data.writeUInt16LE(1, 22); // mono
  data.writeUInt32LE(SAMPLE_RATE, 24);
  data.writeUInt32LE(SAMPLE_RATE * 2, 28);
  data.writeUInt16LE(2, 32);
  data.writeUInt16LE(16, 34);
  data.write("data", 36);
  data.writeUInt32LE(samples * 2, 40);
  for (let i = 0; i < samples; i++) {
    data.writeInt16LE(
      Math.round(Math.sin((2 * Math.PI * 440 * i) / SAMPLE_RATE) * 8000),
      44 + i * 2,
    );
  }
  return data;
}

/**
 * Upload the tone through the real upload routes and publish it as a recording of verses 1–3 of
 * `chapter` in `bookId` (two seconds per verse). Use a book no other spec uses.
 */
export async function addToneRecording(
  browser: Browser,
  baseURL: string | undefined,
  db: TestDb,
  where: { bookId: number; chapter: number; genre?: string },
) {
  const context = await browser.newContext({ baseURL });
  await signInAs(context, E2E_ADMIN_EMAIL);
  const api = context.request;
  const wav = toneWav();
  const requested = await api.post("/api/admin/uploads", {
    data: { mime: "audio/wav", bytes: wav.length },
  });
  const { key, upload } = await requested.json();
  await api.put(upload.url, { data: wav, headers: upload.headers });
  await api.post("/api/admin/uploads/complete", { data: { key, bytes: wav.length } });
  await db.addPlayableRecording({
    storageKey: key,
    mime: "audio/wav",
    bytes: wav.length,
    durationMs: TONE_SECONDS * 1000,
    bookId: where.bookId,
    chapter: where.chapter,
    genre: where.genre,
    verses: [
      { verse: 1, startMs: 0, endMs: 2000 },
      { verse: 2, startMs: 2000, endMs: 4000 },
      { verse: 3, startMs: 4000, endMs: 6000 },
    ],
  });
  await context.close();
}

/**
 * Upload the tone through the real routes and save it as a draft recording of verses 1–3 of
 * chapter 1 (blank timing). Returns the recording id. Use a book no other spec uses.
 */
export async function addToneDraft(
  browser: Browser,
  baseURL: string | undefined,
  book: string,
): Promise<string> {
  const context = await browser.newContext({ baseURL });
  await signInAs(context, E2E_ADMIN_EMAIL);
  const api = context.request;
  const wav = toneWav();
  const requested = await api.post("/api/admin/uploads", {
    data: { mime: "audio/wav", bytes: wav.length },
  });
  const { key, upload } = await requested.json();
  await api.put(upload.url, { data: wav, headers: upload.headers });
  await api.post("/api/admin/uploads/complete", { data: { key, bytes: wav.length } });
  const peaks = Array.from({ length: 400 }, (_, i) => 0.3 + 0.5 * Math.abs(Math.sin(i / 9)));
  const created = await api.post("/api/admin/recordings", {
    data: {
      key,
      translation: "WEB",
      book,
      chapter: 1,
      verseStart: 1,
      endChapter: 1,
      verseEnd: 3,
      genre: { kind: "builtin", slug: "pop" },
      peaks,
    },
  });
  const { id } = await created.json();
  await context.close();
  return id as string;
}
