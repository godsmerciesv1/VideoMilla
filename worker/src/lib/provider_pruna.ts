import type { Env } from '../env';
import { type ClipInput, ProviderError, providerFetch, requireMp4, sleep } from './provider_router';

const BASE = 'https://api.pruna.ai/v1';

/** Every string value in a JSON tree, with the key it sits under. */
function* strings(node: unknown, key = ''): Generator<[string, string]> {
  if (typeof node === 'string') yield [key, node];
  else if (Array.isArray(node)) for (const v of node) yield* strings(v, key);
  else if (node && typeof node === 'object') for (const [k, v] of Object.entries(node)) yield* strings(v, k);
}

/** The first http(s) URL under one of the given key names, else the first URL anywhere that looks like a file. */
export function findUrl(json: unknown, keys: string[], fileHint?: RegExp): string | null {
  const all = [...strings(json)].filter(([, v]) => /^https?:\/\//.test(v));
  return all.find(([k]) => keys.includes(k))?.[1] ?? (fileHint ? all.find(([, v]) => fileHint.test(v))?.[1] : undefined) ?? null;
}

async function upload(env: Env, bytes: Uint8Array, name: string, type: string): Promise<string> {
  const form = new FormData();
  form.append('content', new Blob([bytes], { type }), name);
  const res = await providerFetch('pruna', `${BASE}/files`, { method: 'POST', headers: { apikey: env.PRUNA_API_KEY }, body: form });
  if (!res.ok) throw new ProviderError('pruna', res.status, 'upload_failed');
  const url = findUrl(await res.json().catch(() => null), ['url', 'file_url', 'uri', 'get'], /^https?:\/\//);
  if (!url) throw new ProviderError('pruna', 502, 'bad_upload_answer');
  return url;
}

export interface PrunaOptions {
  pollMs?: number;
  maxWaitMs?: number;
}

/**
 * Pruna's own API, fallback 1 for clips (blueprint 23.7). The frame (and audio) are uploaded first and
 * referenced by URL. `disable_safety_filter` is sent as false (its default is true). The exact answer shape
 * (synchronous video URL, or a URL to poll) is confirmed at gate G8; this reads either defensively.
 */
export async function prunaClip(env: Env, i: ClipInput, opts: PrunaOptions = {}): Promise<Uint8Array> {
  const image = await upload(env, i.firstFrame, 'frame.jpg', 'image/jpeg');
  const audio = i.audio ? await upload(env, i.audio, 'line.mp3', 'audio/mpeg') : undefined;
  const input: Record<string, unknown> = {
    prompt: i.prompt,
    image,
    resolution: '720p',
    fps: 24,
    draft: false,
    save_audio: false,
    prompt_upsampling: false,
    disable_safety_filter: false,
    seed: i.seed ?? Math.floor(Math.random() * 2 ** 31),
  };
  if (audio) input.audio = audio;
  else input.duration = i.seconds;

  const headers = { apikey: env.PRUNA_API_KEY, Model: 'p-video-2', 'Try-Sync': 'true', 'Content-Type': 'application/json' };
  const res = await providerFetch('pruna', `${BASE}/predictions`, { method: 'POST', headers, body: JSON.stringify({ input }) });
  if (!res.ok) throw new ProviderError('pruna', res.status, 'provider_error');
  let answer: unknown = await res.json().catch(() => null);

  const deadline = Date.now() + (opts.maxWaitMs ?? 600_000);
  for (;;) {
    const video = findUrl(answer, ['generation_url', 'video', 'output', 'url'], /\.mp4(\?|$)/);
    if (video) {
      const file = await providerFetch('pruna', video, { headers: { apikey: env.PRUNA_API_KEY } });
      if (!file.ok) throw new ProviderError('pruna', file.status, 'download_failed');
      return requireMp4('pruna', new Uint8Array(await file.arrayBuffer()));
    }
    const status = JSON.stringify(answer ?? '').toLowerCase();
    if (/"status":"(failed|error|canceled|cancelled)"/.test(status)) throw new ProviderError('pruna', 502, 'prediction_failed');
    const poll = findUrl(answer, ['get', 'get_url', 'status_url']);
    if (!poll || Date.now() > deadline) throw new ProviderError('pruna', 504, 'timeout');
    await sleep(opts.pollMs ?? 5000);
    const r = await providerFetch('pruna', poll, { headers: { apikey: env.PRUNA_API_KEY } });
    if (!r.ok) throw new ProviderError('pruna', r.status, 'provider_error');
    answer = await r.json().catch(() => null);
  }
}
