import type { Env } from '../env';
import { bytesToB64, type ClipInput, ProviderError, providerFetch, requireMp4 } from './provider_router';

/**
 * Segmind: the primary clip provider (P Video 2, blueprint 23.7). The MP4 is the response body and is
 * billed per second returned. A line audio file, when given, sets the length, so `duration` is omitted.
 * `segmindImageEdit` (the picture fallback) is NOT built yet: its request shape is unverified and needs a
 * Segmind key to confirm (decision D-115).
 */
export async function segmindClip(env: Env, i: ClipInput, model = 'p-video-2'): Promise<Uint8Array> {
  const body: Record<string, unknown> = {
    prompt: i.prompt,
    image: bytesToB64(i.firstFrame),
    resolution: '720p',
    fps: 24,
    draft: false,
    save_audio: false,
    prompt_upsampling: false,
    seed: i.seed ?? Math.floor(Math.random() * 2 ** 31),
  };
  if (i.audio) body.audio = bytesToB64(i.audio);
  else body.duration = i.seconds;

  const res = await providerFetch('segmind', `https://api.segmind.com/v1/${model}`, {
    method: 'POST',
    headers: { 'x-api-key': env.SEGMIND_API_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new ProviderError('segmind', res.status, res.status === 402 ? 'provider_credits' : 'provider_error');
  return requireMp4('segmind', new Uint8Array(await res.arrayBuffer()));
}
