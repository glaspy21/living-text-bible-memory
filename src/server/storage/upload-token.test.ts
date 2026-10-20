import { describe, expect, it } from "vitest";
import { signUploadToken, verifyUploadToken } from "./upload-token";

const grant = { key: "recordings/abc12345-0000/original.mp3", mime: "audio/mpeg", bytes: 1234 };
const NOW = 1_700_000_000_000;

describe("upload tokens", () => {
  it("round-trips the grant", () => {
    const token = signUploadToken(grant, "s", 60, NOW);
    expect(verifyUploadToken(token, "s", NOW + 1000)).toEqual(grant);
  });

  it("expires", () => {
    const token = signUploadToken(grant, "s", 60, NOW);
    expect(verifyUploadToken(token, "s", NOW + 61_000)).toBeNull();
  });

  it("rejects a different secret", () => {
    const token = signUploadToken(grant, "s", 60, NOW);
    expect(verifyUploadToken(token, "other", NOW)).toBeNull();
  });

  it("rejects a tampered payload", () => {
    const [, signature] = signUploadToken(grant, "s", 60, NOW).split(".");
    const forged = Buffer.from(
      JSON.stringify({ ...grant, key: "recordings/evil12345/original.mp3", exp: NOW / 1000 + 60 }),
    ).toString("base64url");
    expect(verifyUploadToken(`${forged}.${signature}`, "s", NOW)).toBeNull();
  });

  it("rejects garbage", () => {
    for (const t of ["", "abc", "a.b.c", ".", "x."])
      expect(verifyUploadToken(t, "s", NOW)).toBeNull();
  });
});
