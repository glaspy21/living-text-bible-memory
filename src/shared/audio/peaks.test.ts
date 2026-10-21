import { describe, expect, it } from "vitest";
import { MAX_PEAK_BUCKETS, isValidPeaks, peaksFromChannels } from "./peaks";

describe("peaksFromChannels", () => {
  it("takes the loudest sample in each slice", () => {
    const channel = Float32Array.from([0.1, 0.5, -0.9, 0.2, 0, 0.3, -0.4, 0.05]);
    expect(peaksFromChannels([channel], 4)).toEqual([0.5, 0.9, 0.3, 0.4]);
  });

  it("looks across channels", () => {
    const left = Float32Array.from([0.1, 0.1]);
    const right = Float32Array.from([0.8, 0.2]);
    expect(peaksFromChannels([left, right], 1)).toEqual([0.8]);
  });

  it("makes fewer peaks than asked for when the audio is shorter", () => {
    expect(peaksFromChannels([Float32Array.from([0.2, 0.4, 0.6])], 2000)).toHaveLength(3);
  });

  it("clamps to 1 and handles silence and empty audio", () => {
    expect(peaksFromChannels([Float32Array.from([2, 0])], 1)).toEqual([1]);
    expect(peaksFromChannels([new Float32Array(10)], 2)).toEqual([0, 0]);
    expect(peaksFromChannels([], 10)).toEqual([]);
    expect(peaksFromChannels([new Float32Array(0)], 10)).toEqual([]);
  });
});

describe("isValidPeaks", () => {
  it("accepts a list of 0–1 numbers", () => {
    expect(isValidPeaks([0, 0.5, 1])).toBe(true);
  });

  it("rejects everything else", () => {
    for (const bad of [
      [],
      "x",
      null,
      [0.5, 1.2],
      [-0.1],
      [Number.NaN],
      ["0.5"],
      Array.from({ length: MAX_PEAK_BUCKETS + 1 }, () => 0.5),
    ]) {
      expect(isValidPeaks(bad)).toBe(false);
    }
  });
});
