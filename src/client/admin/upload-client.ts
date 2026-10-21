"use client";

import { MAX_UPLOAD_BYTES, checkUploadRequest, mimeForFileName } from "@/shared/audio/upload-rules";
import { PEAK_BUCKETS, peaksFromChannels } from "@/shared/audio/peaks";

/** Browsers must hold the whole file to decode it; past this size the waveform is skipped. */
const MAX_DECODE_BYTES = 200 * 1024 * 1024;

export type UploadedFile = { key: string; bytes: number };

export class UploadError extends Error {}

async function readError(response: Response, fallback: string): Promise<string> {
  try {
    const body = await response.json();
    return body.error ?? body.errors?.[0] ?? fallback;
  } catch {
    return fallback;
  }
}

/** The mime type to declare for a chosen file, or an error for files we won't take. */
export function checkChosenFile(file: File): string | null {
  const check = checkUploadRequest({
    mime: mimeForFileName(file.name, file.type),
    bytes: file.size,
  });
  if (check.ok) return null;
  return check.error;
}

/**
 * Send a file straight to storage: ask the server for a one-file target, PUT the bytes (with
 * progress), then have the server verify what arrived. Throws `UploadError` with a plain message.
 */
export async function uploadAudio(
  file: File,
  onProgress: (fraction: number) => void,
): Promise<UploadedFile> {
  const mime = mimeForFileName(file.name, file.type);
  const requested = await fetch("/api/admin/uploads", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mime, bytes: file.size }),
  });
  if (!requested.ok)
    throw new UploadError(await readError(requested, "The upload could not be started."));
  const { key, upload } = (await requested.json()) as {
    key: string;
    upload: { url: string; headers: Record<string, string> };
  };

  await new Promise<void>((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open("PUT", upload.url);
    for (const [name, value] of Object.entries(upload.headers))
      request.setRequestHeader(name, value);
    request.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(event.loaded / event.total);
    };
    request.onload = () =>
      request.status >= 200 && request.status < 300
        ? resolve()
        : reject(new UploadError(`The upload was refused (${request.status}).`));
    request.onerror = () =>
      reject(new UploadError("The upload was interrupted. Check your connection and try again."));
    request.send(file);
  });

  const completed = await fetch("/api/admin/uploads/complete", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ key, bytes: file.size }),
  });
  if (!completed.ok)
    throw new UploadError(await readError(completed, "The file could not be verified."));
  return { key, bytes: file.size };
}

export type AudioAnalysis = { durationSec: number; peaks: number[] };

/**
 * Decode the file in the browser to get its waveform peaks (the server has no audio decoder).
 * Returns null if the file is too large to decode here or the browser can't decode it; the
 * recording is still saved, just without a waveform.
 */
export async function analyzeAudio(file: File): Promise<AudioAnalysis | null> {
  if (file.size > MAX_DECODE_BYTES || file.size > MAX_UPLOAD_BYTES) return null;
  try {
    const Context =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const context = new Context();
    try {
      const buffer = await context.decodeAudioData(await file.arrayBuffer());
      const channels = Array.from({ length: buffer.numberOfChannels }, (_, i) =>
        buffer.getChannelData(i),
      );
      return { durationSec: buffer.duration, peaks: peaksFromChannels(channels, PEAK_BUCKETS) };
    } finally {
      void context.close();
    }
  } catch {
    return null;
  }
}
