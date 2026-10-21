/**
 * Waveform peaks: a coarse picture of a recording (one 0–1 height per slice) that the timing
 * editor draws instead of decoding the whole file. Computed in the admin's browser, where the
 * audio decoder lives, and validated again on the server.
 */

export const PEAK_BUCKETS = 2000;
export const MAX_PEAK_BUCKETS = 4000;

/** The loudest sample in each of `buckets` equal slices, across all channels, scaled to 0–1. */
export function peaksFromChannels(
  channels: readonly Float32Array[],
  buckets: number = PEAK_BUCKETS,
): number[] {
  const length = channels[0]?.length ?? 0;
  if (length === 0 || buckets <= 0) return [];
  const count = Math.min(buckets, length);
  const peaks: number[] = [];
  for (let b = 0; b < count; b++) {
    const from = Math.floor((b * length) / count);
    const to = Math.floor(((b + 1) * length) / count);
    let max = 0;
    for (const channel of channels) {
      for (let i = from; i < to; i++) {
        const v = Math.abs(channel[i]);
        if (v > max) max = v;
      }
    }
    peaks.push(Math.round(Math.min(1, max) * 1000) / 1000);
  }
  return peaks;
}

/** True for a plausible peaks list: 1–4000 numbers between 0 and 1. */
export function isValidPeaks(value: unknown): value is number[] {
  return (
    Array.isArray(value) &&
    value.length >= 1 &&
    value.length <= MAX_PEAK_BUCKETS &&
    value.every((v) => typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= 1)
  );
}
