// Measures the real length of the narration by walking the MPEG audio frame
// headers. The narration is a concatenation of several text to speech
// responses, so we sum every frame rather than assume one constant bitrate.

const BITRATES_V1_L3 = [
  0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320,
] as const;
const BITRATES_V2_L3 = [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160] as const;
const SAMPLE_RATES = {
  mpeg1: [44100, 48000, 32000],
  mpeg2: [22050, 24000, 16000],
  mpeg25: [11025, 12000, 8000],
} as const;

type Frame = { seconds: number; length: number };

function readFrame(buf: Buffer, at: number): Frame | null {
  if (at + 4 > buf.length) return null;
  // Frame sync: eleven set bits.
  if (buf[at] !== 0xff || (buf[at + 1] & 0xe0) !== 0xe0) return null;

  const versionBits = (buf[at + 1] >> 3) & 0x03;
  const layerBits = (buf[at + 1] >> 1) & 0x03;
  // Only Layer III is relevant, and version bits of 1 are reserved.
  if (layerBits !== 0x01 || versionBits === 0x01) return null;

  const bitrateIndex = (buf[at + 2] >> 4) & 0x0f;
  const sampleRateIndex = (buf[at + 2] >> 2) & 0x03;
  const padding = (buf[at + 2] >> 1) & 0x01;
  if (bitrateIndex === 0 || bitrateIndex === 0x0f || sampleRateIndex === 0x03) return null;

  const isMpeg1 = versionBits === 0x03;
  const bitrate = (isMpeg1 ? BITRATES_V1_L3 : BITRATES_V2_L3)[bitrateIndex] * 1000;
  const sampleRate =
    SAMPLE_RATES[isMpeg1 ? "mpeg1" : versionBits === 0x02 ? "mpeg2" : "mpeg25"][sampleRateIndex];
  const samplesPerFrame = isMpeg1 ? 1152 : 576;

  const length = Math.floor((samplesPerFrame / 8) * (bitrate / sampleRate)) + padding;
  if (length <= 4) return null;

  return { seconds: samplesPerFrame / sampleRate, length };
}

// Skips an ID3v2 tag, whose size is stored as four 7-bit bytes.
function skipId3(buf: Buffer, at: number): number {
  if (at + 10 > buf.length) return at;
  if (buf.toString("ascii", at, at + 3) !== "ID3") return at;
  const size =
    (buf[at + 6] << 21) | (buf[at + 7] << 14) | (buf[at + 8] << 7) | buf[at + 9];
  return at + 10 + size;
}

/** Total playing time in seconds, fractional, or null if no frames could be read. */
export function mp3DurationSeconds(buf: Buffer): number | null {
  let pos = skipId3(buf, 0);
  let seconds = 0;
  let frames = 0;

  while (pos + 4 <= buf.length) {
    const frame = readFrame(buf, pos);
    if (frame) {
      seconds += frame.seconds;
      frames++;
      pos += frame.length;
      continue;
    }
    // Not a frame boundary. This is normal at the seams between concatenated
    // responses, so skip any tag and resync a byte at a time.
    const afterTag = skipId3(buf, pos);
    pos = afterTag > pos ? afterTag : pos + 1;
  }

  return frames > 0 ? seconds : null;
}
