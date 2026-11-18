import { env } from 'cloudflare:workers';
import { beforeEach, describe, expect, it } from 'vitest';
import type { Env } from '../src/env';
import { b64ToBytes, bytesToB64, clipRoutes, looksLikeMp4, pickClipProvider, pickImageModels, pickTextModels, pickVisionModels, ProviderError, spendCaps } from '../src/lib/provider_router';
import { spentToday } from '../src/lib/spend_cap';
import { clearConfigCache } from '../src/routes/config';

const db = env.DB;
const e = env as unknown as Env;

async function setConfig(key: string, value: unknown): Promise<void> {
  await db.prepare('INSERT INTO config(key, value) VALUES(?1, ?2) ON CONFLICT(key) DO UPDATE SET value = ?2').bind(key, JSON.stringify(value)).run();
  clearConfigCache();
}

const ROUTES = [
  { provider: 'segmind', model: 'p-video-2', cost_per_second_micro: 25000, role: 'primary', accepts_audio: true },
  { provider: 'pruna', model: 'p-video-2', cost_per_second_micro: 25000, role: 'fallback', accepts_audio: true },
  { provider: 'gemini', model: 'veo-lite', cost_per_second_micro: 80000, role: 'fallback', accepts_audio: false },
];

beforeEach(async () => {
  await db.prepare('DELETE FROM spend').run();
  await setConfig('clip_routes', ROUTES);
  await setConfig('caps', { video_usd: 1, workers_ai_usd: 3.3, fallback_usd: 1 });
});

describe('clip routing', () => {
  it('reads the configured routes in order and ignores malformed ones', async () => {
    await setConfig('clip_routes', [...ROUTES, { provider: 'nope', model: 'x', cost_per_second_micro: 1 }, { provider: 'segmind' }, 'junk', null]);
    const r = await clipRoutes(db);
    expect(r.map((x) => x.provider)).toEqual(['segmind', 'pruna', 'gemini']);
    expect(r[0]).toMatchObject({ role: 'primary', acceptsAudio: true, costPerSecondMicro: 25000 });
    expect(r[2]!.acceptsAudio).toBe(false);
  });

  it('picks the primary and charges its estimated cost to the video counter', async () => {
    const p = await pickClipProvider(e, { seconds: 5, hasAudio: false });
    expect(p?.route.provider).toBe('segmind');
    expect(p?.estMicro).toBe(125000);
    expect(p?.kind).toBe('video');
    expect(p?.dropAudio).toBe(false);
    expect(await spentToday(db, 'video')).toBe(125000);
  });

  it('moves to the fallback when the video cap is used up, charging the fallback counter', async () => {
    await setConfig('caps', { video_usd: 0.1, workers_ai_usd: 3.3, fallback_usd: 1 });
    const p = await pickClipProvider(e, { seconds: 5, hasAudio: false });
    expect(p?.route.provider).toBe('pruna');
    expect(p?.kind).toBe('fallback');
    expect(await spentToday(db, 'video')).toBe(0);
    expect(await spentToday(db, 'fallback')).toBe(125000);
  });

  it('says busy (null) when every budget is used up, and reserves nothing', async () => {
    await setConfig('caps', { video_usd: 0.05, workers_ai_usd: 3.3, fallback_usd: 0.05 });
    expect(await pickClipProvider(e, { seconds: 8, hasAudio: false })).toBeNull();
    expect(await spentToday(db, 'video')).toBe(0);
    expect(await spentToday(db, 'fallback')).toBe(0);
  });

  it('a route that cannot take audio reports dropAudio so the shot becomes voice-over', async () => {
    const p = await pickClipProvider(e, { seconds: 4, hasAudio: true, skip: ['segmind', 'pruna'] });
    expect(p?.route.provider).toBe('gemini');
    expect(p?.dropAudio).toBe(true);
  });

  it('100 simultaneous picks never overspend the cap', async () => {
    await setConfig('caps', { video_usd: 0.5, workers_ai_usd: 3.3, fallback_usd: 0 });
    const picks = await Promise.all(Array.from({ length: 100 }, () => pickClipProvider(e, { seconds: 4, hasAudio: false })));
    const ok = picks.filter(Boolean).length;
    expect(ok).toBe(5);
    expect(await spentToday(db, 'video')).toBe(500000);
  });
});

describe('caps and models', () => {
  it('converts dollars to micro-dollars, with the blueprint defaults when config is missing', async () => {
    expect(await spendCaps(db)).toEqual({ videoMicro: 1_000_000, workersAiMicro: 3_300_000, fallbackMicro: 1_000_000, googleCharsMicro: 2_000_000 });
    await db.prepare("DELETE FROM config WHERE key = 'caps'").run();
    clearConfigCache();
    expect(await spendCaps(db)).toEqual({ videoMicro: 10_000_000, workersAiMicro: 3_300_000, fallbackMicro: 3_000_000, googleCharsMicro: 2_000_000 });
  });

  it('text models: the default then the fallback, or a per-language override', async () => {
    expect(await pickTextModels(db, 'en')).toEqual(['@cf/google/gemma-4-26b-a4b-it', '@cf/meta/llama-3.3-70b-instruct-fp8-fast']);
    await setConfig('language_models', { ja: '@cf/qwen/qwen3.8-27b' });
    expect((await pickTextModels(db, 'ja'))[0]).toBe('@cf/qwen/qwen3.8-27b');
    expect((await pickTextModels(db, 'en'))[0]).toBe('@cf/google/gemma-4-26b-a4b-it');
  });

  it('image and vision models come from config (D-102: Gemma first, Scout second)', async () => {
    expect(await pickImageModels(db)).toEqual({ primary: '@cf/black-forest-labs/flux-2-klein-4b', fallback: '@cf/black-forest-labs/flux-2-klein-9b' });
    expect(await pickVisionModels(db)).toEqual(['@cf/google/gemma-4-26b-a4b-it', '@cf/meta/llama-4-scout-17b-16e-instruct']);
  });
});

describe('helpers', () => {
  it('base64 round trips large byte arrays', () => {
    const b = new Uint8Array(100_000).map((_, i) => i % 251);
    expect(b64ToBytes(bytesToB64(b))).toEqual(b);
  });
  it('recognizes an MP4 and rejects anything else', () => {
    const mp4 = new Uint8Array(2000);
    mp4.set([0x66, 0x74, 0x79, 0x70], 4);
    expect(looksLikeMp4(mp4)).toBe(true);
    expect(looksLikeMp4(new Uint8Array(2000))).toBe(false);
    expect(looksLikeMp4(mp4.subarray(0, 100))).toBe(false);
  });
  it('ProviderError says which failures are worth retrying', () => {
    for (const s of [0, 408, 429, 500, 503]) expect(new ProviderError('x', s).retriable).toBe(true);
    for (const s of [400, 401, 402, 404, 422]) expect(new ProviderError('x', s).retriable).toBe(false);
  });
});
