import type { ByteRange } from "@/shared/audio/byte-range";

/** Where and how the browser sends a file straight to storage. */
export type UploadTarget = {
  method: "PUT";
  url: string;
  headers: Record<string, string>;
};

/** How a stored file reaches a listener's player. */
export type Playback =
  /** The app streams the bytes itself, honoring Range requests (local development). */
  | { mode: "stream"; open(key: string, range?: ByteRange): ReadableStream<Uint8Array> }
  /** The browser is sent to a short-lived signed storage URL, which handles Range itself (R2). */
  | { mode: "redirect"; url(key: string, mime: string): Promise<string> };

/**
 * Storage for original audio. Everything is addressed by a key from `originalAudioKey()`;
 * drivers refuse any other shape. Originals are written once and never overwritten.
 */
export interface StorageDriver {
  readonly name: "local" | "r2";
  readonly playback: Playback;
  /** A short-lived, single-file upload target for the browser. */
  createUploadTarget(key: string, mime: string, bytes: number): Promise<UploadTarget>;
  /** Size in bytes, or null if nothing is stored under the key. */
  size(key: string): Promise<number | null>;
  /** A small slice of the file (for checking what it really is). */
  readBytes(key: string, range: ByteRange): Promise<Uint8Array>;
  remove(key: string): Promise<void>;
}
