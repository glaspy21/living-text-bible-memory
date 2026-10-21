/**
 * How long an uploaded recording is, read from the file itself (no decoder needed, so it runs on
 * any server). Both functions take a `read(start, length)` so they only fetch the few bytes they
 * need from storage. They return null when the file isn't something they understand.
 */

export type ReadBytes = (start: number, length: number) => Promise<Uint8Array>;

const u32le = (b: Uint8Array, o: number) =>
  (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0;
const u32be = (b: Uint8Array, o: number) =>
  ((b[o] << 24) | (b[o + 1] << 16) | (b[o + 2] << 8) | b[o + 3]) >>> 0;
const tag = (b: Uint8Array, o: number, text: string) =>
  text.split("").every((c, i) => b[o + i] === c.charCodeAt(0));

// ---- WAV ---------------------------------------------------------------------------------

/** Duration of a PCM/WAVE file from its fmt and data chunks. */
export async function wavDurationMs(read: ReadBytes, fileSize: number): Promise<number | null> {
  const head = await read(0, Math.min(fileSize, 4096));
  if (head.length < 12 || !tag(head, 0, "RIFF") || !tag(head, 8, "WAVE")) return null;

  let byteRate = 0;
  let offset = 12;
  while (offset + 8 <= head.length) {
    const size = u32le(head, offset + 4);
    if (tag(head, offset, "fmt ")) {
      if (offset + 8 + 16 > head.length) return null;
      byteRate = u32le(head, offset + 16); // average bytes per second
    } else if (tag(head, offset, "data")) {
      if (byteRate <= 0) return null;
      // A streamed or unfinished file can declare a size of 0 or 0xFFFFFFFF: use what is there.
      const start = offset + 8;
      const available = fileSize - start;
      const bytes = size === 0 || size === 0xffffffff || size > available ? available : size;
      return Math.round((bytes / byteRate) * 1000);
    }
    offset += 8 + size + (size % 2); // chunks are padded to an even length
  }
  return null;
}

// ---- MP3 ---------------------------------------------------------------------------------

const BITRATES_V1_L3 = [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320];
const BITRATES_V2_L3 = [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160];
const SAMPLE_RATES = {
  3: [44100, 48000, 32000],
  2: [22050, 24000, 16000],
  0: [11025, 12000, 8000],
};

type FrameHeader = {
  bitrate: number; // bits per second
  sampleRate: number;
  samplesPerFrame: number;
  /** Where the Xing/Info tag sits, counted from the start of the frame. */
  xingOffset: number;
  frameBytes: number;
};

/** Parse four bytes as an MPEG audio Layer III frame header, or null if they aren't one. */
function parseFrameHeader(b: Uint8Array, o: number): FrameHeader | null {
  if (b[o] !== 0xff || (b[o + 1] & 0xe0) !== 0xe0) return null;
  const versionBits = (b[o + 1] >> 3) & 3; // 3 = MPEG1, 2 = MPEG2, 0 = MPEG2.5, 1 = reserved
  const layerBits = (b[o + 1] >> 1) & 3; // 1 = Layer III
  if (versionBits === 1 || layerBits !== 1) return null;
  const bitrateIndex = b[o + 2] >> 4;
  const rateIndex = (b[o + 2] >> 2) & 3;
  if (bitrateIndex === 0 || bitrateIndex === 15 || rateIndex === 3) return null;

  const mpeg1 = versionBits === 3;
  const bitrate = (mpeg1 ? BITRATES_V1_L3 : BITRATES_V2_L3)[bitrateIndex] * 1000;
  const sampleRate = SAMPLE_RATES[versionBits as 3 | 2 | 0][rateIndex];
  const padding = (b[o + 2] >> 1) & 1;
  const mono = b[o + 3] >> 6 === 3;
  const crc = (b[o + 1] & 1) === 0 ? 2 : 0;
  const samplesPerFrame = mpeg1 ? 1152 : 576;
  const sideInfo = mpeg1 ? (mono ? 17 : 32) : mono ? 9 : 17;
  return {
    bitrate,
    sampleRate,
    samplesPerFrame,
    xingOffset: 4 + crc + sideInfo,
    frameBytes: Math.floor(((mpeg1 ? 144 : 72) * bitrate) / sampleRate) + padding,
  };
}

/** Skip an ID3v2 tag at the start of the file; returns where the audio begins. */
async function audioStart(read: ReadBytes, fileSize: number): Promise<number> {
  const id3 = await read(0, Math.min(fileSize, 10));
  if (id3.length === 10 && tag(id3, 0, "ID3")) {
    const size =
      ((id3[6] & 0x7f) << 21) | ((id3[7] & 0x7f) << 14) | ((id3[8] & 0x7f) << 7) | (id3[9] & 0x7f);
    return 10 + size + ((id3[5] & 0x10) !== 0 ? 10 : 0); // a footer adds 10 more bytes
  }
  return 0;
}

/**
 * Duration of an MP3. Uses the frame count in the Xing/Info or VBRI tag when there is one
 * (exact, also for variable bitrate); otherwise estimates from the file size and the bitrate,
 * which is exact for constant-bitrate files.
 */
export async function mp3DurationMs(read: ReadBytes, fileSize: number): Promise<number | null> {
  const start = await audioStart(read, fileSize);
  // The first frame can be preceded by a little junk or padding, so look a short way ahead.
  const window = await read(start, Math.min(Math.max(fileSize - start, 0), 4096));
  let at = -1;
  let frame: FrameHeader | null = null;
  for (let i = 0; i + 4 <= window.length; i++) {
    frame = parseFrameHeader(window, i);
    // Two frames in a row make a false match on stray bytes very unlikely.
    if (frame && frame.frameBytes > 0) {
      const next = i + frame.frameBytes;
      if (next + 4 > window.length || parseFrameHeader(window, next)) {
        at = i;
        break;
      }
    }
    frame = null;
  }
  if (!frame || at < 0) return null;

  const tagAt = at + frame.xingOffset;
  let frames: number | null = null;
  if ((tag(window, tagAt, "Xing") || tag(window, tagAt, "Info")) && tagAt + 12 <= window.length) {
    if (window[tagAt + 7] & 1) frames = u32be(window, tagAt + 8);
  } else if (tag(window, at + 36, "VBRI") && at + 36 + 18 <= window.length) {
    frames = u32be(window, at + 36 + 14);
  }
  if (frames && frames > 0) {
    return Math.round(((frames * frame.samplesPerFrame) / frame.sampleRate) * 1000);
  }

  // No frame count: constant-bitrate estimate. Ignore a trailing 128-byte ID3v1 tag.
  const trailer = await read(Math.max(fileSize - 128, 0), Math.min(fileSize, 128));
  const audioBytes = fileSize - (start + at) - (tag(trailer, 0, "TAG") ? 128 : 0);
  if (audioBytes <= 0) return null;
  return Math.round(((audioBytes * 8) / frame.bitrate) * 1000);
}
