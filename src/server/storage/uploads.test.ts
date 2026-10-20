import { describe, expect, it } from "vitest";
import { MAX_UPLOAD_BYTES } from "@/shared/audio/upload-rules";
import { fakeMp3, streamOf, withLocalStorage } from "./test-helpers";
import { completeUpload, requestUpload } from "./uploads";

const ctx = withLocalStorage();

describe("requestUpload", () => {
  it("issues a key and target for an MP3", async () => {
    const result = await requestUpload(ctx.storage, { mime: "audio/mpeg", bytes: 1000 });
    if ("error" in result) throw new Error(result.error);
    expect(result.kind).toBe("mp3");
    expect(result.key).toMatch(/^recordings\/[0-9a-f-]{36}\/original\.mp3$/);
    expect(result.target.method).toBe("PUT");
  });

  it("gives every upload its own key", async () => {
    const [a, b] = await Promise.all([
      requestUpload(ctx.storage, { mime: "audio/wav", bytes: 10 }),
      requestUpload(ctx.storage, { mime: "audio/wav", bytes: 10 }),
    ]);
    expect("key" in a && "key" in b && a.key !== b.key).toBe(true);
  });

  it("refuses wrong types, empty files and oversize files with a 400", async () => {
    for (const input of [
      { mime: "video/mp4", bytes: 10 },
      { mime: "audio/mpeg", bytes: 0 },
      { mime: "audio/mpeg", bytes: MAX_UPLOAD_BYTES + 1 },
    ]) {
      expect(await requestUpload(ctx.storage, input)).toMatchObject({ status: 400 });
    }
  });
});

describe("completeUpload", () => {
  async function upload(data: Uint8Array, mime = "audio/mpeg") {
    const req = await requestUpload(ctx.storage, { mime, bytes: data.length });
    if ("error" in req) throw new Error(req.error);
    await ctx.storage.write(req.key, streamOf(data), data.length);
    return req.key;
  }

  it("accepts a real MP3 of the declared size", async () => {
    const key = await upload(fakeMp3(100));
    expect(await completeUpload(ctx.storage, { key, bytes: 100 })).toEqual({
      key,
      kind: "mp3",
      bytes: 100,
    });
  });

  it("accepts a real WAV", async () => {
    const wav = new Uint8Array(60);
    wav.set(
      Array.from("RIFF").map((c) => c.charCodeAt(0)),
      0,
    );
    wav.set(
      Array.from("WAVE").map((c) => c.charCodeAt(0)),
      8,
    );
    const key = await upload(wav, "audio/wav");
    expect(await completeUpload(ctx.storage, { key, bytes: 60 })).toMatchObject({ kind: "wav" });
  });

  it("rejects and deletes a file that is not audio, whatever it was called", async () => {
    const html = new TextEncoder().encode("<!doctype html><script>alert(1)</script>");
    const key = await upload(html);
    expect(await completeUpload(ctx.storage, { key, bytes: html.length })).toMatchObject({
      status: 422,
    });
    expect(await ctx.storage.size(key)).toBeNull();
  });

  it("rejects and deletes a file whose size differs from what was declared", async () => {
    const key = await upload(fakeMp3(100));
    expect(await completeUpload(ctx.storage, { key, bytes: 99 })).toMatchObject({ status: 422 });
    expect(await ctx.storage.size(key)).toBeNull();
  });

  it("reports a missing file and refuses keys that are not ours", async () => {
    expect(
      await completeUpload(ctx.storage, { key: "recordings/abc12345-0000/original.mp3", bytes: 5 }),
    ).toMatchObject({ status: 404 });
    expect(await completeUpload(ctx.storage, { key: "../etc/passwd", bytes: 5 })).toMatchObject({
      status: 400,
    });
  });
});
