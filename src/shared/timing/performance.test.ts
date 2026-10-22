import { describe, expect, it } from "vitest";
import { mp3DurationMs, wavDurationMs } from "../audio/duration";
import { peaksFromChannels } from "../audio/peaks";
import { fitPxPerSec, hitHandle, markAt, setBoundary, type TimingRow } from "./timing";
import { validateTiming } from "./validation";

/**
 * Budgets for the largest things the app is meant to handle: a chapter-length recording with
 * every verse of Psalm 119 (176 rows), and far more than that. They are deliberately generous
 * (these run on busy machines and CI); they exist to catch an accidental O(n²) or a full-file read.
 */
const sheet = (n: number): TimingRow[] =>
  Array.from({ length: n }, (_, i) => ({
    chapter: 119,
    verse: i + 1,
    startMs: i * 5000,
    endMs: i * 5000 + 4800,
    ackGap: i % 2 === 0,
    ackOverlap: false,
  }));

function timed<T>(fn: () => T): { ms: number; value: T } {
  const t = performance.now();
  const value = fn();
  return { ms: performance.now() - t, value };
}

describe("timing sheets stay fast at chapter size and well beyond", () => {
  const rows = sheet(1200);
  const duration = 1200 * 5000;

  it("validates 1,200 verses well inside one frame budget", () => {
    const { ms, value } = timed(() => validateTiming(rows, duration));
    expect(value.errors).toEqual([]);
    expect(ms).toBeLessThan(100);
  });

  it("finds the handle under the pointer quickly (it runs on every mouse move)", () => {
    const view = { startMs: 0, pxPerSec: 40 };
    const { ms } = timed(() => {
      for (let i = 0; i < 200; i++) hitHandle(rows, i * 7, view);
    });
    expect(ms / 200).toBeLessThan(2);
  });

  it("edits one boundary in a big sheet without noticeable delay", () => {
    const { ms } = timed(() => {
      for (let i = 0; i < 100; i++) setBoundary(rows, i, "end", i * 5000 + 4900, duration);
    });
    expect(ms / 100).toBeLessThan(2);
    expect(
      timed(() =>
        markAt(
          sheet(1200).map((r) => ({ ...r, startMs: null, endMs: null })),
          1000,
          duration,
        ),
      ).ms,
    ).toBeLessThan(50);
  });

  it("fitting and zooming are constant-time", () => {
    expect(timed(() => fitPxPerSec(3_600_000, 1200)).ms).toBeLessThan(5);
  });
});

describe("long recordings", () => {
  it("draws the waveform of a five-minute stereo recording in a couple of seconds", () => {
    const samples = 44100 * 300;
    const left = new Float32Array(samples);
    const right = new Float32Array(samples);
    for (let i = 0; i < samples; i += 97) {
      left[i] = Math.sin(i / 1000);
      right[i] = Math.cos(i / 900);
    }
    const { ms, value } = timed(() => peaksFromChannels([left, right]));
    expect(value).toHaveLength(2000);
    expect(ms).toBeLessThan(4000);
  });

  it("reads the length of a 300 MB MP3 without reading the file", async () => {
    // A constant-bitrate stream: 128 kbps, 44.1 kHz, MPEG-1 Layer III frames (417 bytes).
    const frame = new Uint8Array([0xff, 0xfb, 0x90, 0x00]);
    const size = 300 * 1024 * 1024;
    let bytesRead = 0;
    const read = async (start: number, length: number) => {
      const out = new Uint8Array(Math.max(0, Math.min(length, size - start)));
      bytesRead += out.length;
      for (let i = 0; i + 4 <= out.length; i++) {
        if ((start + i) % 417 === 0) out.set(frame, i);
      }
      return out;
    };
    const t = performance.now();
    const duration = await mp3DurationMs(read, size);
    expect(performance.now() - t).toBeLessThan(500);
    expect(bytesRead).toBeLessThan(64 * 1024);
    // 300 MB at 128 kbps is about 5 hours; the estimate must be in that range.
    expect(duration).toBeGreaterThan(4.5 * 3600 * 1000);
    expect(duration).toBeLessThan(5.5 * 3600 * 1000);
  });

  it("reads the length of a 300 MB WAV from its header alone", async () => {
    const size = 300 * 1024 * 1024;
    const header = Buffer.alloc(44);
    header.write("RIFF", 0);
    header.writeUInt32LE(size - 8, 4);
    header.write("WAVE", 8);
    header.write("fmt ", 12);
    header.writeUInt32LE(16, 16);
    header.writeUInt16LE(1, 20);
    header.writeUInt16LE(2, 22);
    header.writeUInt32LE(44100, 24);
    header.writeUInt32LE(44100 * 4, 28);
    header.writeUInt16LE(4, 32);
    header.writeUInt16LE(16, 34);
    header.write("data", 36);
    header.writeUInt32LE(size - 44, 40);
    let bytesRead = 0;
    const read = async (start: number, length: number) => {
      const out = new Uint8Array(Math.max(0, Math.min(length, size - start)));
      bytesRead += out.length;
      out.set(header.subarray(start, start + out.length));
      return out;
    };
    const duration = await wavDurationMs(read, size);
    expect(bytesRead).toBeLessThan(64 * 1024);
    expect(duration).toBeGreaterThan(1700 * 1000);
    expect(duration).toBeLessThan(1800 * 1000);
  });
});
