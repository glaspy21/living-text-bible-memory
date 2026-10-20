import { describe, expect, it } from "vitest";
import { UPLOAD_URL_TTL_SECONDS } from "@/shared/audio/upload-rules";
import { createStorage } from "./index";
import { R2StorageDriver } from "./r2";
import type { StorageDriver } from "./types";

const KEY = "recordings/abc12345-0000/original.mp3";
const config = {
  accountId: "acct123",
  accessKeyId: "AKIATEST",
  secretAccessKey: "test-secret-key",
  bucket: "living-text-test",
};

describe("R2StorageDriver", () => {
  it("signs a short-lived, create-only upload URL (no network needed)", async () => {
    const driver: StorageDriver = new R2StorageDriver(config);
    const target = await driver.createUploadTarget(KEY, "audio/mpeg", 1000);
    const url = new URL(target.url);
    expect(url.hostname).toBe("living-text-test.acct123.r2.cloudflarestorage.com");
    expect(url.pathname).toBe(`/${KEY}`);
    expect(url.searchParams.get("X-Amz-Expires")).toBe(String(UPLOAD_URL_TTL_SECONDS));
    expect(url.searchParams.get("X-Amz-Signature")).toBeTruthy();
    expect(target.headers["Content-Type"]).toBe("audio/mpeg");
    expect(target.headers["If-None-Match"]).toBe("*");
    expect(target.url).not.toContain(config.secretAccessKey);
    // A checksum baked into the URL would not match the real file, and R2 would reject the upload.
    expect([...url.searchParams.keys()].filter((k) => /checksum/i.test(k))).toEqual([]);
    expect(url.searchParams.get("X-Amz-SignedHeaders")).toBe("host;if-none-match");
  });

  it("signs a one-hour playback URL", async () => {
    const driver = new R2StorageDriver(config);
    if (driver.playback.mode !== "redirect") throw new Error("expected redirect");
    const url = new URL(await driver.playback.url(KEY, "audio/mpeg"));
    expect(url.searchParams.get("X-Amz-Expires")).toBe("3600");
    expect(url.searchParams.get("response-content-type")).toBe("audio/mpeg");
  });

  it("refuses keys that are not ours before signing anything", async () => {
    const driver: StorageDriver = new R2StorageDriver(config);
    await expect(driver.createUploadTarget("../x", "audio/mpeg", 1)).rejects.toThrow(/Invalid/);
  });
});

describe("createStorage", () => {
  it("defaults to local storage", () => {
    expect(createStorage({ AUTH_SECRET: "s" }).name).toBe("local");
  });

  it("local storage needs the app secret to sign upload links", () => {
    expect(() => createStorage({})).toThrow(/AUTH_SECRET/);
  });

  it("r2 needs all four settings", () => {
    expect(() => createStorage({ STORAGE_DRIVER: "r2", R2_BUCKET: "b" })).toThrow(/R2_ACCOUNT_ID/);
    expect(
      createStorage({
        STORAGE_DRIVER: "r2",
        R2_ACCOUNT_ID: "a",
        R2_ACCESS_KEY_ID: "k",
        R2_SECRET_ACCESS_KEY: "s",
        R2_BUCKET: "b",
      }).name,
    ).toBe("r2");
  });

  it("rejects unknown drivers", () => {
    expect(() => createStorage({ STORAGE_DRIVER: "s3" })).toThrow(/Unknown STORAGE_DRIVER/);
  });
});
