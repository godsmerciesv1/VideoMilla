import { env } from 'cloudflare:workers';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Env } from '../src/env';
import { findUrl, prunaClip } from '../src/lib/provider_pruna';
import { geminiText, veoClip } from '../src/lib/provider_gemini';
import { segmindClip } from '../src/lib/provider_segmind';
import { ProviderError, type ClipInput } from '../src/lib/provider_router';

const e = { ...(env as unknown as Env), SEGMIND_API_KEY: 'seg-key', PRUNA_API_KEY: 'pr-key', GEMINI_API_KEY: 'gem-key' } as Env;

const mp4 = (): Uint8Array => {
  const b = new Uint8Array(4096);
  b.set([0x66, 0x74, 0x79, 0x70], 4);
  return b;
};
const frame = new Uint8Array([0xff, 0xd8, 0xff, 1, 2, 3]);
const input: ClipInput = { prompt: 'Mara waves', firstFrame: frame, seconds: 5, seed: 7 };

type Call = { url: string; init: RequestInit };
function stub(handler: (c: Call, n: number) => Response | Promise<Response>): Call[] {
  const calls: Call[] = [];
  vi.stubGlobal('fetch', async (url: string, init: RequestInit = {}) => {
    const c = { url: String(url), init };
    calls.push(c);
    return handler(c, calls.length);
  });
  return calls;
}
const hdr = (c: Call, k: string): string | null => new Headers(c.init.headers).get(k);
afterEach(() => vi.unstubAllGlobals());

describe('Segmind', () => {
  it('posts the documented body and returns the MP4', async () => {
    const calls = stub(() => new Response(mp4()));
    const out = await segmindClip(e, input);
    expect(out.length).toBe(4096);
    expect(calls[0]!.url).toBe('https://api.segmind.com/v1/p-video-2');
    expect(hdr(calls[0]!, 'x-api-key')).toBe('seg-key');
    const body = JSON.parse(calls[0]!.init.body as string);
    expect(body).toMatchObject({ prompt: 'Mara waves', resolution: '720p', fps: 24, draft: false, save_audio: false, prompt_upsampling: false, duration: 5, seed: 7 });
    expect(body.audio).toBeUndefined();
  });
  it('with line audio it sends the audio and no duration (the audio sets the length)', async () => {
    const calls = stub(() => new Response(mp4()));
    await segmindClip(e, { ...input, audio: new Uint8Array([1, 2, 3]) });
    const body = JSON.parse(calls[0]!.init.body as string);
    expect(body.audio).toBe('AQID');
    expect(body.duration).toBeUndefined();
  });
  it('rejects a file that is not an MP4', async () => {
    stub(() => new Response(new Uint8Array(5000)));
    await expect(segmindClip(e, input)).rejects.toMatchObject({ code: 'bad_output', status: 502 });
  });
  it('classifies failures: out of provider credits is not retriable, 500 and network are', async () => {
    stub(() => new Response('no', { status: 402 }));
    await expect(segmindClip(e, input)).rejects.toMatchObject({ code: 'provider_credits', retriable: false });
    stub(() => new Response('no', { status: 500 }));
    await expect(segmindClip(e, input)).rejects.toMatchObject({ retriable: true });
    vi.stubGlobal('fetch', async () => { throw new TypeError('network'); });
    await expect(segmindClip(e, input)).rejects.toMatchObject({ status: 0, retriable: true });
  });
});

describe('Pruna', () => {
  it('uploads the frame, sends the safety filter ON, and downloads the finished video', async () => {
    const calls = stub((c) => {
      if (c.url.endsWith('/files')) return Response.json({ url: 'https://files.pruna.ai/frame1' });
      if (c.url.endsWith('/predictions')) return Response.json({ generation_url: 'https://cdn.pruna.ai/out.mp4' });
      return new Response(mp4());
    });
    const out = await prunaClip(e, input);
    expect(out.length).toBe(4096);
    expect(calls.map((c) => c.url)).toEqual(['https://api.pruna.ai/v1/files', 'https://api.pruna.ai/v1/predictions', 'https://cdn.pruna.ai/out.mp4']);
    expect(hdr(calls[0]!, 'apikey')).toBe('pr-key');
    expect(calls[0]!.init.body).toBeInstanceOf(FormData);
    expect((calls[0]!.init.body as FormData).get('content')).toBeTruthy();
    expect(hdr(calls[1]!, 'Model')).toBe('p-video-2');
    expect(hdr(calls[1]!, 'Try-Sync')).toBe('true');
    const sent = JSON.parse(calls[1]!.init.body as string).input;
    expect(sent.disable_safety_filter).toBe(false);
    expect(sent.image).toBe('https://files.pruna.ai/frame1');
    expect(sent.duration).toBe(5);
  });
  it('polls when the answer is not final yet', async () => {
    let polls = 0;
    stub((c) => {
      if (c.url.endsWith('/files')) return Response.json({ url: 'https://files.pruna.ai/f' });
      if (c.url.endsWith('/predictions')) return Response.json({ status: 'processing', urls: { get: 'https://api.pruna.ai/v1/predictions/9' } });
      if (c.url.endsWith('/predictions/9')) return ++polls < 3 ? Response.json({ status: 'processing', urls: { get: 'https://api.pruna.ai/v1/predictions/9' } }) : Response.json({ generation_url: 'https://cdn.pruna.ai/a.mp4' });
      return new Response(mp4());
    });
    expect((await prunaClip(e, input, { pollMs: 1 })).length).toBe(4096);
    expect(polls).toBe(3);
  });
  it('a failed prediction and a timeout are errors', async () => {
    stub((c) => (c.url.endsWith('/files') ? Response.json({ url: 'https://f/x' }) : Response.json({ status: 'failed' })));
    await expect(prunaClip(e, input, { pollMs: 1 })).rejects.toMatchObject({ code: 'prediction_failed' });
    stub((c) => (c.url.endsWith('/files') ? Response.json({ url: 'https://f/x' }) : Response.json({ status: 'processing', urls: { get: 'https://api.pruna.ai/v1/p/1' } })));
    await expect(prunaClip(e, input, { pollMs: 1, maxWaitMs: 20 })).rejects.toMatchObject({ code: 'timeout', status: 504 });
  });
  it('findUrl prefers the named key and ignores non-URLs', () => {
    expect(findUrl({ a: 'x', output: 'https://h/o.mp4', other: 'https://h/z' }, ['output'])).toBe('https://h/o.mp4');
    expect(findUrl({ a: 'nothing' }, ['url'])).toBeNull();
  });
});

describe('Gemini', () => {
  const done = { done: true, response: { generateVideoResponse: { generatedSamples: [{ video: { uri: 'https://files.google/v1' } }] } } };

  it('starts a long-running job, polls it, and downloads with the key header', async () => {
    let polls = 0;
    const calls = stub((c) => {
      if (c.url.endsWith(':predictLongRunning')) return Response.json({ name: 'operations/abc' });
      if (c.url.endsWith('operations/abc')) return Response.json(++polls < 2 ? { done: false } : done);
      return new Response(mp4());
    });
    const out = await veoClip(e, { ...input, aspect: '16:9', seconds: 5 }, 'veo-lite', { pollMs: 1 });
    expect(out.length).toBe(4096);
    expect(calls[0]!.url).toContain('/models/veo-lite:predictLongRunning');
    expect(hdr(calls[0]!, 'x-goog-api-key')).toBe('gem-key');
    const body = JSON.parse(calls[0]!.init.body as string);
    expect(body.parameters).toEqual({ aspectRatio: '16:9', durationSeconds: 6 });
    expect(body.instances[0].image.mimeType).toBe('image/jpeg');
    expect(hdr(calls[calls.length - 1]!, 'x-goog-api-key')).toBe('gem-key');
  });
  it('a failed operation, a missing video and a timeout are errors', async () => {
    stub((c) => (c.url.endsWith(':predictLongRunning') ? Response.json({ name: 'operations/x' }) : Response.json({ done: true, error: { code: 3 } })));
    await expect(veoClip(e, input, 'm', { pollMs: 1 })).rejects.toMatchObject({ code: 'generation_failed' });
    stub((c) => (c.url.endsWith(':predictLongRunning') ? Response.json({ name: 'operations/x' }) : Response.json({ done: true, response: {} })));
    await expect(veoClip(e, input, 'm', { pollMs: 1 })).rejects.toMatchObject({ code: 'no_video' });
    stub((c) => (c.url.endsWith(':predictLongRunning') ? Response.json({ name: 'operations/x' }) : Response.json({ done: false })));
    await expect(veoClip(e, input, 'm', { pollMs: 1, maxWaitMs: 15 })).rejects.toMatchObject({ code: 'timeout' });
  });
  it('maps requested seconds to the nearest allowed Veo length', async () => {
    const lengths: number[] = [];
    for (const s of [3, 4, 5, 6, 7, 8]) {
      const calls = stub((c) => (c.url.endsWith(':predictLongRunning') ? Response.json({ name: 'operations/q' }) : c.url.endsWith('operations/q') ? Response.json(done) : new Response(mp4())));
      await veoClip(e, { ...input, seconds: s }, 'm', { pollMs: 1 });
      lengths.push(JSON.parse(calls[0]!.init.body as string).parameters.durationSeconds);
    }
    expect(lengths).toEqual([4, 4, 6, 6, 8, 8]);
  });
  it('text fallback returns the JSON text and fails cleanly on an empty answer', async () => {
    stub(() => Response.json({ candidates: [{ content: { parts: [{ text: '{"ok":true}' }] } }] }));
    expect(await geminiText(e, 'flash-lite', 'hello')).toBe('{"ok":true}');
    stub(() => Response.json({ candidates: [] }));
    await expect(geminiText(e, 'flash-lite', 'hello')).rejects.toBeInstanceOf(ProviderError);
  });
});
