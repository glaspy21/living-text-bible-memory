/** What the app accepts as an original recording, and how to check a file really is one. */

export const MAX_UPLOAD_BYTES = 300 * 1024 * 1024; // a long chapter recording as WAV
export const UPLOAD_URL_TTL_SECONDS = 15 * 60;

export type AudioKind = "mp3" | "wav";

const KINDS: Record<AudioKind, { ext: string; mimes: readonly string[] }> = {
  mp3: { ext: "mp3", mimes: ["audio/mpeg", "audio/mp3"] },
  wav: { ext: "wav", mimes: ["audio/wav", "audio/x-wav", "audio/wave", "audio/vnd.wave"] },
};

/** The audio kind a declared MIME type stands for, or null if it isn't accepted. */
export function kindFromMime(mime: string): AudioKind | null {
  const m = mime.trim().toLowerCase();
  for (const [kind, { mimes }] of Object.entries(KINDS)) {
    if (mimes.includes(m)) return kind as AudioKind;
  }
  return null;
}

/** The MIME type stored and served for a kind. */
export function canonicalMime(kind: AudioKind): string {
  return KINDS[kind].mimes[0];
}

/** Bytes needed at the start of a file to tell what it is. */
export const SNIFF_BYTES = 12;

/**
 * Look at the first bytes of a file and say what it really is, whatever its name or
 * declared type claims. MP3 = ID3 tag or an MPEG frame sync; WAV = RIFF....WAVE.
 */
export function sniffAudioKind(head: Uint8Array): AudioKind | null {
  const b = head;
  if (b.length >= 12) {
    const ascii = (from: number, to: number) => String.fromCharCode(...b.slice(from, to));
    if (ascii(0, 4) === "RIFF" && ascii(8, 12) === "WAVE") return "wav";
  }
  if (b.length >= 3 && b[0] === 0x49 && b[1] === 0x44 && b[2] === 0x33) return "mp3"; // "ID3"
  if (b.length >= 2 && b[0] === 0xff && (b[1] & 0xe0) === 0xe0) return "mp3"; // frame sync
  return null;
}

export type UploadRequestCheck = { ok: true; kind: AudioKind } | { ok: false; error: string };

/** Check what the admin says they are about to upload, before any URL is issued. */
export function checkUploadRequest(input: { mime: string; bytes: number }): UploadRequestCheck {
  const kind = kindFromMime(input.mime);
  if (!kind) return { ok: false, error: "Only MP3 and WAV files can be uploaded." };
  if (!Number.isInteger(input.bytes) || input.bytes <= 0) {
    return { ok: false, error: "The file is empty." };
  }
  if (input.bytes > MAX_UPLOAD_BYTES) {
    return { ok: false, error: "The file is larger than 300 MB." };
  }
  return { ok: true, kind };
}

/**
 * Where an original recording lives. The name never comes from the user, so it cannot
 * collide or escape the folder; each upload gets its own id and is never overwritten.
 */
export function originalAudioKey(id: string, kind: AudioKind): string {
  return `recordings/${id}/original.${KINDS[kind].ext}`;
}

/** Keys we generate look like this; anything else is refused before touching storage. */
export const STORAGE_KEY_PATTERN = /^recordings\/[A-Za-z0-9-]{8,64}\/original\.(mp3|wav)$/;

export function isValidStorageKey(key: string): boolean {
  return STORAGE_KEY_PATTERN.test(key);
}
