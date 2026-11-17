import type { Env } from '../env';
import { bytesToB64, type ClipInput, ProviderError, providerFetch, requireMp4, sleep } from './provider_router';

const BASE = 'https://generativelanguage.googleapis.com/v1beta';

export interface VeoOptions {
  pollMs?: number;
  maxWaitMs?: number;
}

/** Veo accepts 4, 6 or 8 seconds (confirmed at G8). The nearest allowed length at or above the request. */
function veoSeconds(s: number): number {
  return s <= 4 ? 4 : s <= 6 ? 6 : 8;
}

/**
 * Veo through the Gemini API, fallback 2 for clips (blueprint 23.7). It does not accept supplied audio,
 * so a talking shot becomes voice-over on a motion shot (the router reports `dropAudio`). The request
 * shape and the Lite model id are confirmed at gate G8.
 */
export async function veoClip(env: Env, i: ClipInput, model: string, opts: VeoOptions = {}): Promise<Uint8Array> {
  const headers = { 'x-goog-api-key': env.GEMINI_API_KEY, 'Content-Type': 'application/json' };
  const start = await providerFetch('gemini', `${BASE}/models/${model}:predictLongRunning`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      instances: [{ prompt: i.prompt, image: { bytesBase64Encoded: bytesToB64(i.firstFrame), mimeType: 'image/jpeg' } }],
      parameters: { aspectRatio: i.aspect ?? '9:16', durationSeconds: veoSeconds(i.seconds) },
    }),
  });
  if (!start.ok) throw new ProviderError('gemini', start.status, 'provider_error');
  const op = (await start.json().catch(() => null)) as { name?: string } | null;
  if (!op?.name) throw new ProviderError('gemini', 502, 'bad_operation');

  const deadline = Date.now() + (opts.maxWaitMs ?? 600_000);
  for (;;) {
    await sleep(opts.pollMs ?? 10_000);
    const r = await providerFetch('gemini', `${BASE}/${op.name}`, { headers });
    if (!r.ok) throw new ProviderError('gemini', r.status, 'provider_error');
    const s = (await r.json().catch(() => null)) as {
      done?: boolean;
      error?: unknown;
      response?: { generateVideoResponse?: { generatedSamples?: Array<{ video?: { uri?: string } }> } };
    } | null;
    if (s?.error) throw new ProviderError('gemini', 502, 'generation_failed');
    if (s?.done) {
      const uri = s.response?.generateVideoResponse?.generatedSamples?.[0]?.video?.uri;
      if (!uri) throw new ProviderError('gemini', 502, 'no_video');
      const f = await providerFetch('gemini', uri, { headers: { 'x-goog-api-key': env.GEMINI_API_KEY } });
      if (!f.ok) throw new ProviderError('gemini', f.status, 'download_failed');
      return requireMp4('gemini', new Uint8Array(await f.arrayBuffer()));
    }
    if (Date.now() > deadline) throw new ProviderError('gemini', 504, 'timeout');
  }
}

/** Gemini Flash-Lite as the last script fallback: the model's JSON text. The model id comes from config. */
export async function geminiText(env: Env, model: string, prompt: string): Promise<string> {
  const res = await providerFetch('gemini', `${BASE}/models/${model}:generateContent`, {
    method: 'POST',
    headers: { 'x-goog-api-key': env.GEMINI_API_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { responseMimeType: 'application/json', temperature: 0.4 },
    }),
  });
  if (!res.ok) throw new ProviderError('gemini', res.status, 'provider_error');
  const j = (await res.json().catch(() => null)) as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> } | null;
  const text = j?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (typeof text !== 'string' || !text) throw new ProviderError('gemini', 502, 'empty_answer');
  return text;
}
