import { describe, expect, it } from "vitest";
import { mp3DurationMs, wavDurationMs, type ReadBytes } from "./duration";

const reader =
  (bytes: Uint8Array): ReadBytes =>
  async (start, length) =>
    bytes.subarray(start, Math.min(start + length, bytes.length));

function wav(seconds: number, opts: { sampleRate?: number; dataSizeField?: number } = {}) {
  const sampleRate = opts.sampleRate ?? 8000;
  const samples = Math.round(sampleRate * seconds);
  const b = Buffer.alloc(44 + samples * 2);
  b.write("RIFF", 0);
  b.writeUInt32LE(36 + samples * 2, 4);
  b.write("WAVE", 8);
  b.write("fmt ", 12);
  b.writeUInt32LE(16, 16);
  b.writeUInt16LE(1, 20);
  b.writeUInt16LE(1, 22);
  b.writeUInt32LE(sampleRate, 24);
  b.writeUInt32LE(sampleRate * 2, 28);
  b.writeUInt16LE(2, 32);
  b.writeUInt16LE(16, 34);
  b.write("data", 36);
  b.writeUInt32LE(opts.dataSizeField ?? samples * 2, 40);
  return new Uint8Array(b);
}

describe("wavDurationMs", () => {
  it("reads the length from the header", async () => {
    const file = wav(12);
    expect(await wavDurationMs(reader(file), file.length)).toBe(12_000);
    const cd = wav(3.5, { sampleRate: 44100 });
    expect(await wavDurationMs(reader(cd), cd.length)).toBe(3500);
  });

  it("uses the bytes that are there when the data size field is unfinished", async () => {
    for (const field of [0, 0xffffffff]) {
      const file = wav(5, { dataSizeField: field });
      expect(await wavDurationMs(reader(file), file.length)).toBe(5000);
    }
  });

  it("skips other chunks before the data", async () => {
    const base = wav(2);
    const list = Buffer.concat([
      Buffer.from("LIST"),
      Buffer.from([5, 0, 0, 0]),
      Buffer.from("abcde"),
      Buffer.from([0]),
    ]);
    const file = new Uint8Array(Buffer.concat([base.subarray(0, 36), list, base.subarray(36)]));
    expect(await wavDurationMs(reader(file), file.length)).toBe(2000);
  });

  it("returns null for anything else", async () => {
    const junk = new TextEncoder().encode("<!doctype html><p>not audio</p>");
    expect(await wavDurationMs(reader(junk), junk.length)).toBeNull();
    const noFmt = wav(1).slice();
    noFmt.set(new TextEncoder().encode("junk"), 12); // the fmt chunk's name is gone
    expect(await wavDurationMs(reader(noFmt), noFmt.length)).toBeNull();
    expect(await wavDurationMs(reader(new Uint8Array()), 0)).toBeNull();
  });
});

// MPEG-1 Layer III, 128 kbps, 44.1 kHz, stereo, no CRC: 417-byte frames of 1152 samples.
const FRAME = 417;
const frameHeader = () => Uint8Array.from([0xff, 0xfb, 0x90, 0x00]);

function mp3(
  frames: number,
  opts: { id3Bytes?: number; xingFrames?: number; id3v1?: boolean } = {},
) {
  const parts: Uint8Array[] = [];
  if (opts.id3Bytes !== undefined) {
    const size = opts.id3Bytes;
    parts.push(
      Uint8Array.from([
        0x49,
        0x44,
        0x33,
        4,
        0,
        0,
        (size >> 21) & 0x7f,
        (size >> 14) & 0x7f,
        (size >> 7) & 0x7f,
        size & 0x7f,
      ]),
      new Uint8Array(size),
    );
  }
  for (let i = 0; i < frames; i++) {
    const f = new Uint8Array(FRAME);
    f.set(frameHeader(), 0);
    if (i === 0 && opts.xingFrames !== undefined) {
      f.set(new TextEncoder().encode("Xing"), 36);
      f[36 + 7] = 1; // flags: frame count present
      new DataView(f.buffer).setUint32(36 + 8, opts.xingFrames);
    }
    parts.push(f);
  }
  if (opts.id3v1) {
    const t = new Uint8Array(128);
    t.set(new TextEncoder().encode("TAG"), 0);
    parts.push(t);
  }
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const p of parts) {
    out.set(p, at);
    at += p.length;
  }
  return out;
}

describe("mp3DurationMs", () => {
  it("estimates a constant-bitrate file from its size", async () => {
    const file = mp3(100);
    // 100 × 417 bytes at 128 kbps ≈ 2.606 s
    expect(await mp3DurationMs(reader(file), file.length)).toBe(2606);
  });

  it("uses the frame count in the Xing tag when there is one", async () => {
    const file = mp3(10, { xingFrames: 1000 });
    expect(await mp3DurationMs(reader(file), file.length)).toBe(
      Math.round(((1000 * 1152) / 44100) * 1000),
    );
  });

  it("skips an ID3v2 tag in front, and an ID3v1 tag behind", async () => {
    const plain = mp3(100);
    const tagged = mp3(100, { id3Bytes: 5000, id3v1: true });
    expect(await mp3DurationMs(reader(tagged), tagged.length)).toBe(
      await mp3DurationMs(reader(plain), plain.length),
    );
  });

  it("finds the first frame after a little junk", async () => {
    const body = mp3(100);
    const file = new Uint8Array(20 + body.length);
    file.set(body, 20);
    expect(await mp3DurationMs(reader(file), file.length)).not.toBeNull();
  });

  it("returns null for a file with no MP3 frames", async () => {
    const junk = new TextEncoder().encode("this is not an mp3 file at all, just text ".repeat(100));
    expect(await mp3DurationMs(reader(junk), junk.length)).toBeNull();
    expect(await mp3DurationMs(reader(new Uint8Array()), 0)).toBeNull();
    const id3Only = mp3(0, { id3Bytes: 100 });
    expect(await mp3DurationMs(reader(id3Only), id3Only.length)).toBeNull();
  });
});
