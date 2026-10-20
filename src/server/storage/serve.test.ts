import { describe, expect, it } from "vitest";
import { KEY, fakeMp3, readAll, streamOf, withLocalStorage } from "./test-helpers";
import { serveAudio } from "./serve";
import type { StorageDriver } from "./types";

const ctx = withLocalStorage();
const file = { key: KEY, mime: "audio/mpeg" };
const CACHE = "private, no-store";

async function stored(length = 1000) {
  const data = fakeMp3(length);
  await ctx.storage.write(KEY, streamOf(data, 64), length);
  return data;
}

describe("serveAudio (local streaming)", () => {
  it("serves the whole file and advertises Range support", async () => {
    const data = await stored();
    const res = await serveAudio(ctx.storage, file, null, CACHE);
    expect(res.status).toBe(200);
    expect(res.headers.get("Accept-Ranges")).toBe("bytes");
    expect(res.headers.get("Content-Type")).toBe("audio/mpeg");
    expect(res.headers.get("Content-Length")).toBe("1000");
    expect(res.headers.get("Cache-Control")).toBe(CACHE);
    expect(await readAll(res.body!)).toEqual(data);
  });

  it("answers a Range request with 206 and exactly those bytes (what seeking needs)", async () => {
    const data = await stored();
    const res = await serveAudio(ctx.storage, file, "bytes=200-299", CACHE);
    expect(res.status).toBe(206);
    expect(res.headers.get("Content-Range")).toBe("bytes 200-299/1000");
    expect(res.headers.get("Content-Length")).toBe("100");
    expect(await readAll(res.body!)).toEqual(data.slice(200, 300));
  });

  it("supports open-ended and suffix ranges", async () => {
    const data = await stored();
    const tail = await serveAudio(ctx.storage, file, "bytes=900-", CACHE);
    expect(tail.headers.get("Content-Range")).toBe("bytes 900-999/1000");
    expect(await readAll(tail.body!)).toEqual(data.slice(900));
    const last = await serveAudio(ctx.storage, file, "bytes=-10", CACHE);
    expect(await readAll(last.body!)).toEqual(data.slice(990));
  });

  it("answers 416 for a range past the end", async () => {
    await stored();
    const res = await serveAudio(ctx.storage, file, "bytes=5000-", CACHE);
    expect(res.status).toBe(416);
    expect(res.headers.get("Content-Range")).toBe("bytes */1000");
  });

  it("answers 404 when nothing is stored", async () => {
    expect((await serveAudio(ctx.storage, file, null, CACHE)).status).toBe(404);
  });
});

describe("serveAudio (redirecting storage)", () => {
  const redirecting: StorageDriver = {
    name: "r2",
    playback: { mode: "redirect", url: async (key) => `https://signed.example/${key}?sig=1` },
    createUploadTarget: async () => {
      throw new Error("unused");
    },
    size: async () => 5,
    readBytes: async () => new Uint8Array(),
    remove: async () => {},
  };

  it("sends the browser to a signed URL that must not be cached", async () => {
    const res = await serveAudio(redirecting, file, "bytes=0-1", "public, max-age=3600");
    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toBe(`https://signed.example/${KEY}?sig=1`);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
  });
});
