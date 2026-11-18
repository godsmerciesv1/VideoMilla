import { env } from 'cloudflare:workers';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Env } from '../src/env';
import { clearTokenCache } from '../src/lib/google_tts';
import { spentToday } from '../src/lib/spend_cap';
import { account, balanceOf, type Json, makeApp, post, setConfig } from './harness';
import { uid } from './helpers';

const db = env.DB;
const b64 = (b: ArrayBuffer): string => { let s = ''; for (const x of new Uint8Array(b)) s += String.fromCharCode(x); return btoa(s); };

let saJson = '';
beforeEach(async () => {
  clearTokenCache();
  if (!saJson) {
    const pair = (await crypto.subtle.generateKey({ name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }, true, ['sign', 'verify'])) as CryptoKeyPair;
    const label = ['PRIVATE', 'KEY'].join(' ');
    const pem = `-----BEGIN ${label}-----\n${b64((await crypto.subtle.exportKey('pkcs8', pair.privateKey)) as ArrayBuffer)}\n-----END ${label}-----\n`;
    saJson = JSON.stringify({ client_email: 'svc@videomilla.iam.example', private_key: pem });
  }
  await db.prepare('DELETE FROM spend').run();
  await setConfig('languages_enabled', ['en', 'ar']);
  await setConfig('caps', { video_usd: 10, workers_ai_usd: 3.3, fallback_usd: 3, google_chars_usd: 2 });
  await setConfig('voice_routes', {
    default: { provider: 'google' },
    en: { provider: 'workers_ai', model: '@cf/deepgram/aura-2-en', voices: { standard: ['luna', 'asteria'], studio: ['en-US-Studio-O'] } },
  });
});
afterEach(() => vi.unstubAllGlobals());

const mp3 = (): Uint8Array => new Uint8Array([0x49, 0x44, 0x33, ...Array.from({ length: 200 }, (_, i) => i % 200)]);

/** Stubs Google: the token endpoint and Text-to-Speech. Returns the recorded Text-to-Speech request bodies. */
function stubGoogle(tts: () => Response = () => Response.json({ audioContent: btoa(String.fromCharCode(...mp3())) })): Array<Record<string, any>> {
  const sent: Array<Record<string, any>> = [];
  vi.stubGlobal('fetch', async (url: string, init: RequestInit = {}) => {
    if (String(url).includes('oauth2')) return Response.json({ access_token: 'tok', expires_in: 3600 });
    sent.push(JSON.parse(String(init.body)));
    return tts();
  });
  return sent;
}
const app = () => makeApp({ GOOGLE_SA_JSON: saJson } as Partial<Env>);
const say = (a: ReturnType<typeof makeApp>, acc: Awaited<ReturnType<typeof account>>, over: Record<string, unknown> = {}, key: string | null = null) =>
  post(a, '/v1/tts', acc, { text: 'The night was quiet.', language: 'en', ...over }, key);
const ttsCalls = (a: ReturnType<typeof makeApp>) => a.ai.calls.filter((c) => c.task === 'tts');

describe('POST /v1/tts', () => {
  describe('who may use it', () => {
    it('needs a purchase on the wallet, and calls no provider without one', async () => {
      const a = app();
      const sent = stubGoogle();
      const acc = await account(a);
      const r = await say(a, acc);
      expect(r.status).toBe(402);
      expect(((await r.json()) as Json).error).toBe('purchase_required');
      expect(ttsCalls(a)).toHaveLength(0);
      expect(sent).toHaveLength(0);
    });
    it('a short preview works before any purchase, is capped at 80 characters and limited to 20 an hour', async () => {
      const a = app();
      stubGoogle();
      const acc = await account(a);
      expect((await say(a, acc, { preview: true, text: 'Hello, this is a voice.' })).status).toBe(200);
      expect((await say(a, acc, { preview: true, text: 'x'.repeat(81) })).status).toBe(400);
      expect((await say(a, acc, { preview: true, studio: true, text: 'Hi there' })).status).toBe(400);
      let last = 200;
      for (let i = 0; i < 20; i++) last = (await say(a, acc, { preview: true, text: 'Hello again' })).status;
      expect(last).toBe(429);
    });
  });

  describe('standard voice (free)', () => {
    it('uses Workers AI where the language is configured for it, charges nothing and returns audio', async () => {
      const a = app();
      const sent = stubGoogle();
      const acc = await account(a, 5);
      const r = await say(a, acc);
      expect(r.status).toBe(200);
      const j = (await r.json()) as Json;
      expect(j).toMatchObject({ mime: 'audio/mpeg', charged: 0 });
      expect(j.audio.length).toBeGreaterThan(100);
      expect(sent).toHaveLength(0);
      expect(await balanceOf(acc.walletId)).toBe(5);
      expect(ttsCalls(a)[0]!.model).toBe('@cf/deepgram/aura-2-en');
    });
    it('a client may choose only a voice the config allows; anything else gets the default', async () => {
      const a = app();
      stubGoogle();
      const acc = await account(a, 5);
      await say(a, acc, { voice: 'asteria' });
      await say(a, acc, { voice: 'dearest-studio-voice' });
      await say(a, acc);
      expect(ttsCalls(a).map((c) => c.input.speaker)).toEqual(['asteria', 'luna', 'luna']);
    });
    it('falls back to Google when Workers AI fails, and counts the characters against the Google budget', async () => {
      const a = app();
      a.ai.answers.tts = () => { throw new Error('capacity'); };
      const sent = stubGoogle();
      const acc = await account(a, 5);
      const r = await say(a, acc, { text: 'Twenty characters!!' });
      expect(r.status).toBe(200);
      expect(sent).toHaveLength(1);
      expect(sent[0]).toMatchObject({ input: { text: 'Twenty characters!!' }, voice: { languageCode: 'en-US', name: 'luna' }, audioConfig: { audioEncoding: 'MP3' } });
      expect(await spentToday(db, 'google_chars')).toBe(19 * 30);
    });
    it('also falls back when Workers AI answers something that is not audio', async () => {
      const a = app();
      a.ai.answers.tts = () => new Uint8Array([1, 2, 3]);
      const sent = stubGoogle();
      expect((await say(a, await account(a, 5))).status).toBe(200);
      expect(sent).toHaveLength(1);
    });
    it('a language routed to Google goes straight there with its Google language code', async () => {
      const a = app();
      const sent = stubGoogle();
      expect((await say(a, await account(a, 5), { language: 'ar', text: 'مرحبا بكم' })).status).toBe(200);
      expect(ttsCalls(a)).toHaveLength(0);
      expect(sent[0]!.voice.languageCode).toBe('ar-XA');
    });
    it('Google failing is busy, and the reserved budget is given back', async () => {
      const a = app();
      stubGoogle(() => new Response('no', { status: 500 }));
      const r = await say(a, await account(a, 5), { language: 'ar', text: 'مرحبا بكم' });
      expect(r.status).toBe(503);
      expect(await spentToday(db, 'google_chars')).toBe(0);
    });
    it('the daily Google budget used up is busy', async () => {
      const a = app();
      stubGoogle();
      await setConfig('caps', { video_usd: 10, workers_ai_usd: 3.3, fallback_usd: 3, google_chars_usd: 0.0001 });
      expect((await say(a, await account(a, 5), { language: 'ar', text: 'مرحبا بكم' })).status).toBe(503);
    });
  });

  describe('studio voice (credits)', () => {
    it('is refused where the language has no studio voice configured', async () => {
      const a = app();
      stubGoogle();
      const r = await say(a, await account(a, 5), { language: 'ar', studio: true, text: 'مرحبا' });
      expect(r.status).toBe(400);
      expect(((await r.json()) as Json).error).toBe('studio_unavailable');
    });
    it('charges 1 credit per 9 seconds of video, minimum 2, once per video', async () => {
      const a = app();
      const sent = stubGoogle();
      const acc = await account(a, 20);
      const first = (await (await say(a, acc, { studio: true, charge_seconds: 20 }, 'studio-' + uid())).json()) as Json;
      expect(first.charged).toBe(3);
      expect(await balanceOf(acc.walletId)).toBe(17);
      expect(sent[0]!.voice.name).toBe('en-US-Studio-O');
      expect(ttsCalls(a)).toHaveLength(0);
      // later lines of the same video carry no charge and need no key
      expect(((await (await say(a, acc, { studio: true })).json()) as Json).charged).toBe(0);
      expect(await balanceOf(acc.walletId)).toBe(17);
      // a 5-second video still costs the minimum of 2
      expect(((await (await say(a, acc, { studio: true, charge_seconds: 5 }, 'studio-' + uid())).json()) as Json).charged).toBe(2);
      expect(await balanceOf(acc.walletId)).toBe(15);
    });
    it('a studio charge needs an idempotency key and enough credits, and a failure is refunded', async () => {
      const a = app();
      stubGoogle(() => new Response('no', { status: 500 }));
      const acc = await account(a, 3);
      expect((await say(a, acc, { studio: true, charge_seconds: 20 }, null)).status).toBe(400);
      expect((await say(a, acc, { studio: true, charge_seconds: 90 }, 'studio-' + uid())).status).toBe(402);
      expect((await say(a, acc, { studio: true, charge_seconds: 20 }, 'studio-' + uid())).status).toBe(503);
      expect(await balanceOf(acc.walletId)).toBe(3);
    });
    it('the same key twice charges once', async () => {
      const a = app();
      stubGoogle();
      const acc = await account(a, 20);
      const key = 'studio-' + uid();
      expect((await say(a, acc, { studio: true, charge_seconds: 20 }, key)).status).toBe(200);
      expect((await say(a, acc, { studio: true, charge_seconds: 20 }, key)).status).toBe(200);
      expect(await balanceOf(acc.walletId)).toBe(17);
    });
  });

  describe('input checks', () => {
    it('refuses bad input before any provider is called', async () => {
      const a = app();
      const sent = stubGoogle();
      const acc = await account(a, 5);
      const bads: Array<Record<string, unknown>> = [{ text: '' }, { text: 'x'.repeat(601) }, { language: 'xx' }, { language: 'fr' }, { voice: 'has space' }, { voice: 5 }, { charge_seconds: 10 }, { studio: true, charge_seconds: 0 }, { studio: true, charge_seconds: 91 }, { studio: true, charge_seconds: 1.5 }];
      for (const over of bads) expect((await say(a, acc, over, 'k-' + uid())).status).toBe(400);
      expect((await a.call('/v1/tts', { method: 'POST', body: '{}' })).status).toBe(401);
      expect(ttsCalls(a)).toHaveLength(0);
      expect(sent).toHaveLength(0);
    });
    it('blocks unsafe text', async () => {
      const a = app();
      stubGoogle();
      const r = await say(a, await account(a, 5), { text: 'UNSAFE narration' });
      expect(r.status).toBe(422);
      expect(ttsCalls(a)).toHaveLength(0);
    });
  });
});
