import { describe, expect, it } from "vitest";
import {
  MAX_UPLOAD_BYTES,
  canonicalMime,
  checkUploadRequest,
  isValidStorageKey,
  kindFromMime,
  originalAudioKey,
  sniffAudioKind,
} from "./upload-rules";

const bytes = (...values: number[]) => Uint8Array.from(values);
const ascii = (s: string) => Uint8Array.from(Array.from(s).map((c) => c.charCodeAt(0)));

describe("accepted types", () => {
  it("accepts MP3 and WAV by MIME type, ignoring case", () => {
    expect(kindFromMime("audio/mpeg")).toBe("mp3");
    expect(kindFromMime("Audio/WAV")).toBe("wav");
    expect(kindFromMime("audio/x-wav")).toBe("wav");
  });

  it("rejects everything else", () => {
    for (const mime of ["audio/ogg", "video/mp4", "text/html", "application/octet-stream", ""]) {
      expect(kindFromMime(mime)).toBeNull();
    }
  });

  it("has one canonical MIME per kind", () => {
    expect(canonicalMime("mp3")).toBe("audio/mpeg");
    expect(canonicalMime("wav")).toBe("audio/wav");
  });
});

describe("sniffAudioKind", () => {
  it("recognises MP3 by ID3 tag or frame sync", () => {
    expect(sniffAudioKind(ascii("ID3\u0004\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000"))).toBe(
      "mp3",
    );
    expect(sniffAudioKind(bytes(0xff, 0xfb, 0x90, 0x00, 0, 0, 0, 0, 0, 0, 0, 0))).toBe("mp3");
  });

  it("recognises WAV by RIFF and WAVE markers", () => {
    expect(sniffAudioKind(ascii("RIFF\u0000\u0000\u0000\u0000WAVE"))).toBe("wav");
  });

  it("rejects a RIFF file that is not WAVE, and other formats", () => {
    expect(sniffAudioKind(ascii("RIFF\u0000\u0000\u0000\u0000AVI "))).toBeNull();
    expect(sniffAudioKind(ascii("<!doctype html>"))).toBeNull();
    expect(sniffAudioKind(ascii("MZ\u0090\u0000\u0003\u0000\u0000\u0000"))).toBeNull();
    expect(sniffAudioKind(bytes())).toBeNull();
  });
});

describe("checkUploadRequest", () => {
  it("accepts a normal MP3 and WAV", () => {
    expect(checkUploadRequest({ mime: "audio/mpeg", bytes: 5_000_000 })).toEqual({
      ok: true,
      kind: "mp3",
    });
    expect(checkUploadRequest({ mime: "audio/wav", bytes: MAX_UPLOAD_BYTES })).toEqual({
      ok: true,
      kind: "wav",
    });
  });

  it("refuses wrong types, empty files, fractions and oversize files", () => {
    expect(checkUploadRequest({ mime: "audio/ogg", bytes: 10 }).ok).toBe(false);
    expect(checkUploadRequest({ mime: "audio/mpeg", bytes: 0 }).ok).toBe(false);
    expect(checkUploadRequest({ mime: "audio/mpeg", bytes: 1.5 }).ok).toBe(false);
    expect(checkUploadRequest({ mime: "audio/mpeg", bytes: MAX_UPLOAD_BYTES + 1 }).ok).toBe(false);
  });
});

describe("storage keys", () => {
  it("builds a key from an id and kind, never from a file name", () => {
    expect(originalAudioKey("abc12345-def", "mp3")).toBe("recordings/abc12345-def/original.mp3");
  });

  it("accepts only keys in that exact shape", () => {
    expect(isValidStorageKey("recordings/abc12345-def/original.wav")).toBe(true);
    for (const bad of [
      "../secrets",
      "recordings/../../etc/passwd",
      "recordings/abc12345/original.exe",
      "recordings/abc/original.mp3",
      "recordings/abc12345/other.mp3",
      "/recordings/abc12345/original.mp3",
      "recordings/abc12345/original.mp3/extra",
    ]) {
      expect(isValidStorageKey(bad)).toBe(false);
    }
  });
});
