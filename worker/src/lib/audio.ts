/**
 * Audio length from the bytes themselves. A talking clip is billed by its audio's length, so the server reads
 * it instead of trusting a figure from the client (blueprint 23.6). MP3 (Layer III, which Google and Aura produce)
 * is read frame by frame; WAV from its header.
 */
const V1_L3_KBPS = [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320];
const V2_L3_KBPS = [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160];
const RATES: Record<number, number[]> = { 3: [44100, 48000, 32000], 2: [22050, 24000, 16000], 0: [11025, 12000, 8000] };

export function mp3Seconds(b: Uint8Array): number | null {
  let i = 0;
  if (b.length > 10 && b[0] === 0x49 && b[1] === 0x44 && b[2] === 0x33) {
    i = 10 + (((b[6]! & 0x7f) << 21) | ((b[7]! & 0x7f) << 14) | ((b[8]! & 0x7f) << 7) | (b[9]! & 0x7f));
  }
  let total = 0;
  let frames = 0;
  let skipped = 0;
  while (i + 4 <= b.length) {
    if (b[i] === 0xff && (b[i + 1]! & 0xe0) === 0xe0) {
      const version = (b[i + 1]! >> 3) & 3;
      const layer = (b[i + 1]! >> 1) & 3;
      const bitrateIdx = (b[i + 2]! >> 4) & 15;
      const rateIdx = (b[i + 2]! >> 2) & 3;
      const pad = (b[i + 2]! >> 1) & 1;
      if (version !== 1 && layer === 1 && bitrateIdx !== 0 && bitrateIdx !== 15 && rateIdx !== 3) {
        const v1 = version === 3;
        const bitrate = (v1 ? V1_L3_KBPS : V2_L3_KBPS)[bitrateIdx]! * 1000;
        const rate = RATES[version]![rateIdx]!;
        const len = Math.floor((v1 ? 144 : 72) * bitrate / rate) + pad;
        total += (v1 ? 1152 : 576) / rate;
        frames++;
        i += len;
        continue;
      }
    }
    i++;
    if (frames === 0 && ++skipped > 8192) return null;
  }
  return frames >= 2 ? total : null;
}

export function wavSeconds(b: Uint8Array): number | null {
  const dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
  if (b.length < 44 || dv.getUint32(0, false) !== 0x52494646 || dv.getUint32(8, false) !== 0x57415645) return null;
  let byteRate = 0;
  for (let p = 12; p + 8 <= b.length; ) {
    const id = dv.getUint32(p, false);
    const size = dv.getUint32(p + 4, true);
    if (id === 0x666d7420 && p + 20 <= b.length) byteRate = dv.getUint32(p + 16, true); // "fmt "
    if (id === 0x64617461) return byteRate > 0 ? Math.min(size, b.length - p - 8) / byteRate : null; // "data"
    p += 8 + size + (size % 2);
  }
  return null;
}

/** Seconds of audio, or null when the bytes are not audio this reader understands. */
export function audioSeconds(b: Uint8Array): number | null {
  if (b[0] === 0x52 && b[1] === 0x49) return wavSeconds(b);
  return mp3Seconds(b);
}
