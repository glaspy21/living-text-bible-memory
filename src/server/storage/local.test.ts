import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { KEY, fakeMp3, readAll, streamOf, withLocalStorage } from "./test-helpers";

const ctx = withLocalStorage();

describe("LocalStorageDriver", () => {
  it("stores a file and reports its size", async () => {
    const data = fakeMp3(100);
    expect(await ctx.storage.size(KEY)).toBeNull();
    await ctx.storage.write(KEY, streamOf(data), 100);
    expect(await ctx.storage.size(KEY)).toBe(100);
    expect(new Uint8Array(await readFile(path.join(ctx.dir, KEY)))).toEqual(data);
  });

  it("reads a slice and streams a byte range", async () => {
    const data = fakeMp3(100);
    await ctx.storage.write(KEY, streamOf(data), 100);
    expect(await ctx.storage.readBytes(KEY, { start: 0, end: 2 })).toEqual(data.slice(0, 3));
    const { playback } = ctx.storage;
    if (playback.mode !== "stream") throw new Error("expected streaming");
    expect(await readAll(playback.open(KEY, { start: 10, end: 19 }))).toEqual(data.slice(10, 20));
    expect(await readAll(playback.open(KEY))).toEqual(data);
  });

  it("never replaces an existing original", async () => {
    await ctx.storage.write(KEY, streamOf(fakeMp3(50)), 50);
    await expect(ctx.storage.write(KEY, streamOf(fakeMp3(50)), 50)).rejects.toThrow(
      /already exists/,
    );
    expect(await ctx.storage.size(KEY)).toBe(50);
  });

  it("leaves nothing behind when the upload is the wrong size", async () => {
    await expect(ctx.storage.write(KEY, streamOf(fakeMp3(60)), 50)).rejects.toThrow(/More data/);
    await expect(ctx.storage.write(KEY, streamOf(fakeMp3(40)), 50)).rejects.toThrow(/Less data/);
    expect(await ctx.storage.size(KEY)).toBeNull();
    const folder = path.join(ctx.dir, path.dirname(KEY));
    expect(await readdir(folder)).toEqual([]);
  });

  it("removes files, and removing a missing file is fine", async () => {
    await ctx.storage.write(KEY, streamOf(fakeMp3(10)), 10);
    await ctx.storage.remove(KEY);
    await ctx.storage.remove(KEY);
    expect(await ctx.storage.size(KEY)).toBeNull();
  });

  it("refuses keys that could escape the storage folder", async () => {
    for (const bad of [
      "../x",
      "recordings/../../etc/passwd",
      "/etc/passwd",
      "recordings/a/original.sh",
    ]) {
      await expect(ctx.storage.size(bad)).rejects.toThrow(/Invalid storage key/);
      await expect(ctx.storage.write(bad, streamOf(fakeMp3(5)), 5)).rejects.toThrow(/Invalid/);
    }
    await writeFile(path.join(ctx.dir, "secret.txt"), "x");
    await expect(ctx.storage.readBytes("../secret.txt", { start: 0, end: 0 })).rejects.toThrow();
  });

  it("issues an upload target that carries a verifiable, single-file grant", async () => {
    const target = await ctx.storage.createUploadTarget(KEY, "audio/mpeg", 100);
    expect(target.method).toBe("PUT");
    expect(target.url.startsWith("/api/admin/uploads/local?token=")).toBe(true);
    const token = decodeURIComponent(target.url.split("token=")[1]);
    expect(ctx.storage.readGrant(token)).toEqual({ key: KEY, mime: "audio/mpeg", bytes: 100 });
  });
});
