import "server-only";
import { randomUUID } from "node:crypto";
import {
  MAX_UPLOAD_BYTES,
  SNIFF_BYTES,
  canonicalMime,
  checkUploadRequest,
  isValidStorageKey,
  originalAudioKey,
  sniffAudioKind,
  type AudioKind,
} from "@/shared/audio/upload-rules";
import type { StorageDriver, UploadTarget } from "./types";

export type UploadRequest = { key: string; kind: AudioKind; target: UploadTarget };

export type UploadFailure = { status: 400 | 404 | 422; error: string };

/** Step 1: check what the admin is about to send, then hand back a one-file upload target. */
export async function requestUpload(
  storage: StorageDriver,
  input: { mime: string; bytes: number },
): Promise<UploadRequest | UploadFailure> {
  const check = checkUploadRequest(input);
  if (!check.ok) return { status: 400, error: check.error };
  const key = originalAudioKey(randomUUID(), check.kind);
  const mime = canonicalMime(check.kind);
  return {
    key,
    kind: check.kind,
    target: await storage.createUploadTarget(key, mime, input.bytes),
  };
}

export type CompletedUpload = { key: string; kind: AudioKind; bytes: number };

/**
 * Step 2, after the browser has finished uploading: confirm the file is there, is the size the
 * admin declared, and really is the kind of audio its key says. Anything else is deleted, so
 * a rejected file never stays in storage.
 */
export async function completeUpload(
  storage: StorageDriver,
  input: { key: string; bytes: number },
): Promise<CompletedUpload | UploadFailure> {
  if (!isValidStorageKey(input.key)) return { status: 400, error: "Unknown upload." };
  const size = await storage.size(input.key);
  if (size === null) return { status: 404, error: "The file has not arrived yet." };

  const expected = input.key.endsWith(".wav") ? "wav" : "mp3";
  const reject = async (error: string): Promise<UploadFailure> => {
    await storage.remove(input.key);
    return { status: 422, error };
  };

  if (size > MAX_UPLOAD_BYTES) return reject("The file is larger than 300 MB.");
  if (size !== input.bytes) return reject("The uploaded file is not the size that was declared.");
  const head = await storage.readBytes(input.key, { start: 0, end: SNIFF_BYTES - 1 });
  if (sniffAudioKind(head) !== expected) {
    return reject(`That file is not a real ${expected.toUpperCase()} recording.`);
  }
  return { key: input.key, kind: expected, bytes: size };
}
