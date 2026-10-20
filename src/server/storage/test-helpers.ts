import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach } from "vitest";
import { LocalStorageDriver } from "./local";

export const SECRET = "test-secret";
export const KEY = "recordings/abc12345-0000/original.mp3";

/** A readable stream over the given bytes, split in chunks so streaming code is exercised. */
export function streamOf(data: Uint8Array, chunk = 7): ReadableStream<Uint8Array> {
  let i = 0;
  return new ReadableStream({
    pull(controller) {
      if (i >= data.length) return controller.close();
      controller.enqueue(data.slice(i, i + chunk));
      i += chunk;
    },
  });
}

/** A tiny but valid-looking MP3: an ID3 header followed by filler. */
export function fakeMp3(length = 100): Uint8Array {
  const data = new Uint8Array(length);
  data.set([0x49, 0x44, 0x33, 0x04, 0, 0, 0, 0, 0, 0].slice(0, length));
  for (let i = 10; i < length; i++) data[i] = i % 256;
  return data;
}

/** Call inside a describe: gives each test a fresh local driver in a temporary folder for each test. */
export function withLocalStorage() {
  const ctx = { dir: "", storage: undefined as unknown as LocalStorageDriver };
  beforeEach(async () => {
    ctx.dir = await mkdtemp(path.join(tmpdir(), "lt-storage-"));
    ctx.storage = new LocalStorageDriver(ctx.dir, SECRET);
  });
  afterEach(() => rm(ctx.dir, { recursive: true, force: true }));
  return ctx;
}

export async function readAll(stream: ReadableStream<Uint8Array>): Promise<Uint8Array> {
  return new Uint8Array(await new Response(stream).arrayBuffer());
}
