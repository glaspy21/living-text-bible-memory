import "server-only";
import { parseRange } from "@/shared/audio/byte-range";
import type { StorageDriver } from "./types";

/**
 * Answer a request for a stored recording. Seeking needs HTTP Range support, so local files are
 * streamed with 206 responses; R2 gets a redirect to a short-lived signed URL, which supports
 * Range natively. `cacheControl` is the caller's call (published audio may be cached, drafts not).
 */
export async function serveAudio(
  storage: StorageDriver,
  file: { key: string; mime: string },
  rangeHeader: string | null,
  cacheControl: string,
): Promise<Response> {
  const size = await storage.size(file.key);
  if (size === null) return new Response("Not found", { status: 404 });

  const { playback } = storage;
  if (playback.mode === "redirect") {
    return new Response(null, {
      status: 302,
      headers: { Location: await playback.url(file.key, file.mime), "Cache-Control": "no-store" },
    });
  }

  const base = {
    "Content-Type": file.mime,
    "Accept-Ranges": "bytes",
    "Cache-Control": cacheControl,
    "X-Content-Type-Options": "nosniff",
  };
  const result = parseRange(rangeHeader, size);

  if (result.kind === "unsatisfiable") {
    return new Response(null, {
      status: 416,
      headers: { ...base, "Content-Range": `bytes */${size}` },
    });
  }
  if (result.kind === "partial") {
    const { start, end } = result.range;
    return new Response(playback.open(file.key, result.range), {
      status: 206,
      headers: {
        ...base,
        "Content-Range": `bytes ${start}-${end}/${size}`,
        "Content-Length": String(end - start + 1),
      },
    });
  }
  return new Response(playback.open(file.key), {
    status: 200,
    headers: { ...base, "Content-Length": String(size) },
  });
}
