import { env } from 'cloudflare:workers';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Env } from '../src/env';
import { mp3Seconds, wavSeconds, audioSeconds } from '../src/lib/audio';
import { zoneCheck } from '../src/lib/animation_rules';
import { getBytes, getSlice, putObject, deleteObjects } from '../src/lib/clip_store';
import { refund } from '../src/lib/ledger';
import { spentToday } from '../src/lib/spend_cap';
import { parseRange } from '../src/routes/clip_file';
import { runClipJob } from '../src/routes/clip_submit';
import { account, balanceOf, FakeQueue, JPEG_B64, jpegBytes, type Json, makeApp, mp3Of, mp4Bytes, Msg, post, setConfig, toB64, type Account, type App } from './harness';
import { counter, uid } from './helpers';

const db = env.DB;
const ROUTES = [
  { provider: 'segmind', model: 'p-video-2', cost_per_second_micro: 25000, role: 'primary', accepts_audio: true },
  { provider: 'pruna', model: 'p-video-2', cost_per_second_micro: 25000, role: 'fallback', accepts_audio: true },
  { provider: 'gemini', model: 'veo-lite', cost_per_second_micro: 80000, role: 'fallback', accepts_audio: false },
];

let queue: FakeQueue;
const clipApp = (): App => makeApp({ CLIP_JOBS: queue as unknown as Env['CLIP_JOBS'] });
const clip = (over: Record<string, unknown> = {}) => ({ key: 'clip-' + uid(), shot_id: 's' + uid().slice(0, 5), visual: 'Mara waves at the lighthouse', camera: 'slow push in', seconds: 5, first_frame: JPEG_B64, ...over });
const body = (clips: unknown[], over: Record<string, unknown> = {}) => ({ project_id: 'proj-' + uid(), n: 6, aspect: '9:16', clips, ...over });
const submit = (app: App, acc: Account, b: unknown) => app.call('/v1/clip/submit', { method: 'POST', headers: acc.headers, body: JSON.stringify(b) });
const row = (key: string) => db.prepare('SELECT state, provider, error, attempts, talking, voice_over FROM clips WHERE key = ?').bind(key).first<Json>();
const request = (key: string) => db.prepare('SELECT status, provider FROM requests WHERE key = ?').bind(key).first<Json>();
const exists = async (app: App, key: string) => (await app.env.CLIPS.head(key)) !== null;

beforeEach(async () => {
  queue = new FakeQueue();
  await db.prepare('DELETE FROM spend').run();
  await setConfig('clip_routes', ROUTES);
  await setConfig('caps', { video_usd: 10, workers_ai_usd: 3.3, fallback_usd: 3 });
  await setConfig('fair_use', { established_after_days: 7, animated_seconds_per_day_new: 600, animated_seconds_per_day_established: 0, clips_in_flight_new: 2, clips_in_flight_established: 6, pictures_per_day_new: 400, pictures_per_day_established: 0 });
  await setConfig('clip_global_concurrency', 30);
  await setConfig('provider_poll_ms', 1);
  await setConfig('languages_enabled', ['en']);
});
afterEach(() => vi.unstubAllGlobals());

/** Stubs every provider by host. Returns the recorded calls. Override a provider's behaviour per test. */
type Handlers = Partial<Record<'segmind' | 'pruna' | 'files' | 'gemini', (url: string, init: RequestInit) => Response | Promise<Response>>>;
function stubProviders(h: Handlers = {}): Array<{ url: string; init: RequestInit }> {
  const calls: Array<{ url: string; init: RequestInit }> = [];
  vi.stubGlobal('fetch', async (url: string, init: RequestInit = {}) => {
    const u = String(url);
    calls.push({ url: u, init });
    if (u.includes('api.segmind.com')) return (h.segmind ?? (() => new Response(mp4Bytes())))(u, init);
    if (u.includes('api.pruna.ai/v1/files')) return Response.json({ url: 'https://files.pruna.ai/f1' });
    if (u.includes('api.pruna.ai/v1/predictions')) return (h.pruna ?? (() => Response.json({ generation_url: 'https://cdn.pruna.ai/o.mp4' })))(u, init);
    if (u.includes('cdn.pruna.ai')) return new Response(mp4Bytes());
    if (u.includes(':predictLongRunning')) return Response.json({ name: 'operations/o' });
    if (u.includes('operations/o')) return Response.json({ done: true, response: { generateVideoResponse: { generatedSamples: [{ video: { uri: 'https://files.google/v1' } }] } } });
    if (u.includes('files.google')) return new Response(mp4Bytes());
    return new Response('unexpected ' + u, { status: 599 });
  });
  return calls;
}
const callsTo = (calls: Array<{ url: string }>, host: string) => calls.filter((c) => c.url.includes(host)).length;

/** A wallet with credits, two clips queued, returns the keys. */
async function queued(app: App, credits = 200, over: Record<string, unknown> = {}, n = 2): Promise<{ acc: Account; keys: string[] }> {
  const acc = await account(app, credits);
  const clips = Array.from({ length: n }, (_, i) => clip({ shot_id: `s${i}`, ...over }));
  const r = await submit(app, acc, body(clips, { n: Math.max(6, n), confirm_high: true }));
  expect(r.status).toBe(200);
  return { acc, keys: clips.map((c) => c.key) };
}

describe('POST /v1/clip/submit', () => {
  it('reserves every clip at 2 credits a second, stores the inputs and queues the jobs', async () => {
    const app = clipApp();
    const acc = await account(app, 100);
    const clips = [clip(), clip({ seconds: 8 })];
    const r = await submit(app, acc, body(clips));
    expect(r.status).toBe(200);
    const j = (await r.json()) as Json;
    expect(j.charged).toBe(26);
    expect(j.jobs.map((x: Json) => [x.state, x.seconds, x.credits])).toEqual([['queued', 5, 10], ['queued', 8, 16]]);
    expect(await balanceOf(acc.walletId)).toBe(74);
    expect(queue.sent).toEqual(clips.map((c) => c.key));
    for (const c of clips) {
      expect((await request(c.key))!.status).toBe('reserved');
      expect((await row(c.key))!.state).toBe('queued');
      expect(await exists(app, `in/${c.key}/meta`)).toBe(true);
      expect(await exists(app, `in/${c.key}/frame`)).toBe(true);
      expect(await exists(app, `in/${c.key}/audio`)).toBe(false);
    }
  });

  it('a talking clip is billed by its real audio length, read from the bytes', async () => {
    const app = clipApp();
    const acc = await account(app, 100);
    const long = clip({ audio: toB64(mp3Of(6.4)), seconds: 3 }); // the client's `seconds` is ignored
    const short = clip({ audio: toB64(mp3Of(1.0)) });
    const j = (await (await submit(app, acc, body([long, short]))).json()) as Json;
    expect(j.jobs[0]).toMatchObject({ seconds: 7, talking: true, credits: 14 });
    expect(j.jobs[1]).toMatchObject({ seconds: 1, talking: true, credits: 6 });
    expect(await exists(app, `in/${long.key}/audio`)).toBe(true);
  });

  it('refuses audio over 8 seconds, or that is not audio', async () => {
    const app = clipApp();
    const acc = await account(app, 100);
    expect(((await (await submit(app, acc, body([clip({ audio: toB64(mp3Of(9.5)) })]))).json()) as Json).error).toBe('audio_too_long');
    expect(((await (await submit(app, acc, body([clip({ audio: btoa('not audio at all, just some text bytes') })]))).json()) as Json).error).toBe('invalid_audio');
    expect(await balanceOf(acc.walletId)).toBe(100);
  });

  describe('animation zones (blueprint 5.7)', () => {
    const many = (n: number) => Array.from({ length: n }, () => clip());
    it('above half the shots needs confirm_high, and all shots (3 or more) also needs confirm_all', async () => {
      const app = clipApp();
      const acc = await account(app, 900);
      expect(((await (await submit(app, acc, body(many(4), { n: 9 }))).json()) as Json).charged).toBe(40); // amber: no confirmation
      const noConfirm = await submit(app, acc, body(many(6), { n: 9 }));
      expect(noConfirm.status).toBe(400);
      expect(((await noConfirm.json()) as Json).error).toBe('confirmation_required');
      expect((await submit(app, acc, body(many(6), { n: 9, confirm_high: true }))).status).toBe(200);
      expect((await submit(app, acc, body(many(3), { n: 3, confirm_high: true }))).status).toBe(400);
      expect((await submit(app, acc, body(many(3), { n: 3, confirm_high: true, confirm_all: true }))).status).toBe(200);
    });
    it('matches the blueprint worked examples for 6, 9 and 15 shots', () => {
      const firstRed = (n: number) => { for (let k = 1; k <= n; k++) if (!zoneCheck(n, k, false, false) && k !== n) return k; return null; };
      expect(firstRed(6)).toBe(4);
      expect(firstRed(9)).toBe(6);
      expect(firstRed(15)).toBe(9);
      for (const [n, k] of [[6, 3], [9, 5], [15, 8], [1, 1], [2, 1]] as const) expect(zoneCheck(n, k, false, false)).toBe(true);
    });
  });

  describe('money', () => {
    it('all or none: if the last clip does not fit, nothing is reserved, stored or queued', async () => {
      const app = clipApp();
      const acc = await account(app, 25);
      const clips = [clip({ seconds: 5 }), clip({ seconds: 5 }), clip({ seconds: 5 })];
      const r = await submit(app, acc, body(clips));
      expect(r.status).toBe(402);
      expect(((await r.json()) as Json).error).toBe('insufficient_credits');
      expect(await balanceOf(acc.walletId)).toBe(25);
      expect(queue.sent).toHaveLength(0);
      for (const c of clips) {
        expect(await request(c.key)).toBeNull();
        expect(await row(c.key)).toBeNull();
        expect(await exists(app, `in/${c.key}/frame`)).toBe(false);
      }
      const day = new Date().toISOString().slice(0, 10);
      expect(await counter(`daily:anim:${acc.walletId}:${day}`)).toBe(0);
    });
    it('a wallet in debt is refused', async () => {
      const app = clipApp();
      const acc = await account(app, 100);
      await db.prepare('UPDATE wallets SET owed = 4 WHERE id = ?').bind(acc.walletId).run();
      expect(((await (await submit(app, acc, body([clip()]))).json()) as Json).error).toBe('debt');
    });
    it('repeating a submit reports the clips and charges nothing more', async () => {
      const app = clipApp();
      const acc = await account(app, 100);
      const clips = [clip(), clip()];
      await submit(app, acc, body(clips, { project_id: 'p1' }));
      const again = (await (await submit(app, acc, body(clips, { project_id: 'p1' }))).json()) as Json;
      expect(again).toMatchObject({ duplicate: true, charged: 0 });
      expect(again.jobs).toHaveLength(2);
      expect(await balanceOf(acc.walletId)).toBe(80);
      expect(queue.sent).toHaveLength(2);
      expect(await exists(app, `in/${clips[0]!.key}/frame`)).toBe(true);
    });
    it('another wallet cannot reuse a key', async () => {
      const app = clipApp();
      const a = await account(app, 100);
      const b = await account(app, 100);
      const c = clip();
      await submit(app, a, body([c]));
      expect((await submit(app, b, body([c]))).status).toBe(409);
    });
    it('the daily budget used up is busy and charges nothing', async () => {
      const app = clipApp();
      const acc = await account(app, 100);
      await setConfig('caps', { video_usd: 0.001, workers_ai_usd: 3.3, fallback_usd: 0.001 });
      expect((await submit(app, acc, body([clip()]))).status).toBe(503);
      expect(await balanceOf(acc.walletId)).toBe(100);
    });
    it('no provider route configured is busy', async () => {
      const app = clipApp();
      await setConfig('clip_routes', []);
      expect((await submit(app, await account(app, 100), body([clip()]))).status).toBe(503);
    });
    it('a failure to queue refunds every clip and removes the stored inputs', async () => {
      const app = clipApp();
      const acc = await account(app, 100);
      queue.fail = true;
      const clips = [clip(), clip()];
      const r = await submit(app, acc, body(clips));
      expect(r.status).toBe(503);
      expect(await balanceOf(acc.walletId)).toBe(100);
      for (const c of clips) {
        expect((await row(c.key))!.state).toBe('failed_terminal');
        expect(await exists(app, `in/${c.key}/frame`)).toBe(false);
      }
    });
  });

  describe('daily animated seconds follow trust (D-113)', () => {
    beforeEach(() => setConfig('fair_use', { established_after_days: 7, animated_seconds_per_day_new: 12, animated_seconds_per_day_established: 0, clips_in_flight_new: 2, clips_in_flight_established: 6 }));
    it('a new wallet stops at its limit, and the refused request changes nothing', async () => {
      const app = clipApp();
      const acc = await account(app, 200);
      expect((await submit(app, acc, body([clip(), clip()]))).status).toBe(200); // 10 s of 12
      expect((await submit(app, acc, body([clip({ seconds: 3 })]))).status).toBe(429); // 13 s would pass the limit
      expect((await submit(app, acc, body([clip({ seconds: 2 })]))).status).toBe(400); // too short a clip, refused on its own merits
      expect((await submit(app, acc, body([clip({ seconds: 3 })]))).status).toBe(429);
      expect(await balanceOf(acc.walletId)).toBe(200 - 20);
      const second = await account(app, 200);
      expect((await submit(app, second, body([clip({ seconds: 7 })]))).status).toBe(200); // 7 s
      expect((await submit(app, second, body([clip({ seconds: 5 })]))).status).toBe(200); // 12 s: exactly the limit
      expect((await submit(app, second, body([clip({ seconds: 3 })]))).status).toBe(429);
      expect(await balanceOf(acc.walletId)).toBe(200 - 20);
      expect(await balanceOf(second.walletId)).toBe(200 - 14 - 10);
    });
    it('a wallet whose first purchase is a week old has no daily limit', async () => {
      const app = clipApp();
      const acc = await account(app, 500);
      await db.prepare('UPDATE purchases SET created_at = ? WHERE wallet_id = ?').bind(Math.floor(Date.now() / 1000) - 8 * 86400, acc.walletId).run();
      expect((await submit(app, acc, body([clip({ seconds: 8 }), clip({ seconds: 8 })]))).status).toBe(200);
      expect((await submit(app, acc, body([clip({ seconds: 8 })]))).status).toBe(200);
    });
  });

  describe('input checks', () => {
    it('refuses bad input before anything moves', async () => {
      const app = clipApp();
      const acc = await account(app, 100);
      const dup = clip();
      const bads: Array<[string, unknown]> = [
        ['project', body([clip()], { project_id: 'bad id' })],
        ['n zero', body([clip()], { n: 0 })],
        ['n 16', body([clip()], { n: 16 })],
        ['no clips', body([])],
        ['more clips than shots', body([clip(), clip(), clip()], { n: 2 })],
        ['duplicate keys', body([dup, dup])],
        ['bad key', body([clip({ key: 'short' })])],
        ['seconds 2', body([clip({ seconds: 2 })])],
        ['seconds 9', body([clip({ seconds: 9 })])],
        ['seconds fraction', body([clip({ seconds: 4.5 })])],
        ['frame not a jpeg', body([clip({ first_frame: btoa('hello world, not a jpeg image at all') })])],
        ['frame too big', body([clip({ first_frame: toB64(new Uint8Array([0xff, 0xd8, 0xff, ...new Uint8Array(950_000)])) })])],
        ['frame missing', body([clip({ first_frame: undefined })])],
        ['aspect', body([clip()], { aspect: '4:3' })],
        ['no visual', body([clip({ visual: '' })])],
      ];
      for (const [name, b] of bads) expect([name, (await submit(app, acc, b)).status]).toEqual([name, 400]);
      expect((await app.call('/v1/clip/submit', { method: 'POST', body: '{}' })).status).toBe(401);
      expect(await balanceOf(acc.walletId)).toBe(100);
      expect(queue.sent).toHaveLength(0);
    });
    it('an unsafe motion prompt is blocked and costs nothing', async () => {
      const app = clipApp();
      const acc = await account(app, 100);
      expect((await submit(app, acc, body([clip({ visual: 'UNSAFE something the guard refuses' })]))).status).toBe(422);
      expect(await balanceOf(acc.walletId)).toBe(100);
    });
  });
});

describe('the queue consumer (runClipJob)', () => {
  it('makes the clip: stores the MP4, commits, records the provider and the spend, and clears the inputs', async () => {
    const app = clipApp();
    const calls = stubProviders();
    const { keys } = await queued(app);
    const msg = new Msg();
    await runClipJob(app.env, keys[0]!, msg);
    expect(msg.acked).toBe(1);
    expect(await row(keys[0]!)).toMatchObject({ state: 'ready', provider: 'segmind' });
    expect(await request(keys[0]!)).toMatchObject({ status: 'committed', provider: 'segmind' });
    expect((await getBytes(app.env, `out/${keys[0]}`))!.length).toBe(4096);
    expect(await exists(app, `in/${keys[0]}/frame`)).toBe(false);
    expect(await spentToday(db, 'video')).toBe(125000);
    const sent = JSON.parse(String(calls[0]!.init.body));
    expect(sent).toMatchObject({ duration: 5, resolution: '720p' });
    expect(sent.prompt).toContain('identical to the first frame');
  });

  it('a talking clip sends the audio and no duration', async () => {
    const app = clipApp();
    const calls = stubProviders();
    const { keys } = await queued(app, 200, { audio: toB64(mp3Of(2.2)) });
    await runClipJob(app.env, keys[0]!, new Msg());
    const sent = JSON.parse(String(calls[0]!.init.body));
    expect(typeof sent.audio).toBe('string');
    expect(sent.duration).toBeUndefined();
    expect((await row(keys[0]!))!.talking).toBe(1);
  });

  it('moves to the next provider in the same job, releasing the failed one\'s budget', async () => {
    const app = clipApp();
    const calls = stubProviders({ segmind: () => new Response('boom', { status: 500 }) });
    const { keys } = await queued(app);
    await runClipJob(app.env, keys[0]!, new Msg());
    expect(callsTo(calls, 'segmind')).toBe(1);
    expect(await row(keys[0]!)).toMatchObject({ state: 'ready', provider: 'pruna' });
    expect(await spentToday(db, 'video')).toBe(0);
    expect(await spentToday(db, 'fallback')).toBe(125000);
  });

  it('every provider failing retries with a growing delay, then refunds after three tries', async () => {
    const app = clipApp();
    stubProviders({ segmind: () => new Response('x', { status: 500 }), pruna: () => new Response('x', { status: 500 }) });
    await setConfig('clip_routes', ROUTES.slice(0, 2));
    const { acc, keys } = await queued(app);
    const m1 = new Msg();
    await runClipJob(app.env, keys[0]!, m1);
    expect(m1.retried).toEqual([15]);
    expect(await row(keys[0]!)).toMatchObject({ state: 'queued', attempts: 1 });
    const m2 = new Msg();
    await runClipJob(app.env, keys[0]!, m2);
    expect(m2.retried).toEqual([30]);
    expect(await balanceOf(acc.walletId)).toBe(200 - 20);
    const m3 = new Msg();
    await runClipJob(app.env, keys[0]!, m3);
    expect(m3.acked).toBe(1);
    expect(await row(keys[0]!)).toMatchObject({ state: 'failed_retriable' });
    expect(await request(keys[0]!)).toMatchObject({ status: 'refunded' });
    expect(await balanceOf(acc.walletId)).toBe(200 - 10);
    expect(await spentToday(db, 'video')).toBe(0);
    expect(await spentToday(db, 'fallback')).toBe(0);
  });

  it('a refusal that cannot be retried (the provider account is out of credit) refunds at once', async () => {
    const app = clipApp();
    stubProviders({ segmind: () => new Response('no', { status: 402 }) });
    await setConfig('clip_routes', ROUTES.slice(0, 1));
    const { acc, keys } = await queued(app);
    const msg = new Msg();
    await runClipJob(app.env, keys[0]!, msg);
    expect(msg.retried).toEqual([]);
    expect(await row(keys[0]!)).toMatchObject({ state: 'failed_terminal', error: 'provider_credits' });
    expect(await balanceOf(acc.walletId)).toBe(200 - 10);
  });

  it('when the daily budget is gone by the time the job runs it refunds and says busy', async () => {
    const app = clipApp();
    const calls = stubProviders();
    const { acc, keys } = await queued(app);
    await setConfig('caps', { video_usd: 0.001, workers_ai_usd: 3.3, fallback_usd: 0.001 });
    await runClipJob(app.env, keys[0]!, new Msg());
    expect(calls).toHaveLength(0);
    expect(await row(keys[0]!)).toMatchObject({ state: 'failed_retriable', error: 'busy' });
    expect(await balanceOf(acc.walletId)).toBe(200 - 10);
  });

  it('missing inputs refund the clip', async () => {
    const app = clipApp();
    stubProviders();
    const { acc, keys } = await queued(app);
    await deleteObjects(app.env, [`in/${keys[0]}/frame`]);
    await runClipJob(app.env, keys[0]!, new Msg());
    expect(await row(keys[0]!)).toMatchObject({ state: 'failed_terminal', error: 'inputs_missing' });
    expect(await balanceOf(acc.walletId)).toBe(200 - 10);
  });

  it('does nothing for a request that is no longer reserved', async () => {
    const app = clipApp();
    const calls = stubProviders();
    const { keys } = await queued(app);
    await refund(db, keys[0]!);
    const msg = new Msg();
    await runClipJob(app.env, keys[0]!, msg);
    expect(msg.acked).toBe(1);
    expect(calls).toHaveLength(0);
    const unknown = new Msg();
    await runClipJob(app.env, 'never-existed-key', unknown);
    expect(unknown.acked).toBe(1);
  });

  it('a duplicate delivery runs the provider once', async () => {
    const app = clipApp();
    const calls = stubProviders();
    const { keys } = await queued(app);
    const msgs = [new Msg(), new Msg(), new Msg()];
    await Promise.all(msgs.map((m) => runClipJob(app.env, keys[0]!, m)));
    expect(callsTo(calls, 'segmind')).toBe(1);
    expect(msgs.every((m) => m.acked === 1)).toBe(true);
    expect(await spentToday(db, 'video')).toBe(125000);
  });

  describe('concurrency limits (D-110, D-113)', () => {
    it("holds a clip while the wallet is at its own limit, and runs it once one finishes", async () => {
      const app = clipApp();
      const calls = stubProviders();
      const { keys } = await queued(app, 300, {}, 3);
      await db.prepare("UPDATE clips SET state = 'running' WHERE key IN (?, ?)").bind(keys[0], keys[1]).run();
      const held = new Msg();
      await runClipJob(app.env, keys[2]!, held);
      expect(held.retried).toEqual([15]);
      expect(calls).toHaveLength(0);
      expect((await row(keys[2]!))!.state).toBe('queued');
      await db.prepare("UPDATE clips SET state = 'ready' WHERE key = ?").bind(keys[0]).run();
      const go = new Msg();
      await runClipJob(app.env, keys[2]!, go);
      expect(go.acked).toBe(1);
      expect((await row(keys[2]!))!.state).toBe('ready');
    });
    it('holds a clip while the whole service is at its ceiling', async () => {
      const app = clipApp();
      const calls = stubProviders();
      await setConfig('clip_global_concurrency', 1);
      const other = await queued(app);
      await db.prepare("UPDATE clips SET state = 'running' WHERE key = ?").bind(other.keys[0]).run();
      const { keys } = await queued(app);
      const msg = new Msg();
      await runClipJob(app.env, keys[0]!, msg);
      expect(msg.retried).toEqual([15]);
      expect(calls).toHaveLength(0);
    });
    it('an established wallet may run more clips at once', async () => {
      const app = clipApp();
      stubProviders();
      const { acc, keys } = await queued(app, 400, {}, 4);
      await db.prepare('UPDATE purchases SET created_at = ? WHERE wallet_id = ?').bind(Math.floor(Date.now() / 1000) - 9 * 86400, acc.walletId).run();
      await db.prepare("UPDATE clips SET state = 'running' WHERE key IN (?, ?, ?)").bind(keys[0], keys[1], keys[2]).run();
      const msg = new Msg();
      await runClipJob(app.env, keys[3]!, msg);
      expect(msg.acked).toBe(1);
      expect((await row(keys[3]!))!.state).toBe('ready');
    });
  });

  it('a provider that cannot take audio makes the shot voice-over on a motion clip', async () => {
    const app = clipApp();
    const calls = stubProviders();
    await setConfig('clip_routes', [ROUTES[2]]);
    const { keys } = await queued(app, 200, { audio: toB64(mp3Of(2.2)) });
    await runClipJob(app.env, keys[0]!, new Msg());
    expect(await row(keys[0]!)).toMatchObject({ state: 'ready', provider: 'gemini', talking: 0, voice_over: 1 });
    expect(calls.some((c) => c.url.includes(':predictLongRunning') && String(c.init.body).includes('audio'))).toBe(false);
  });

  it('if the cron refunded the clip while it was being made, the result is thrown away and nobody is charged twice', async () => {
    const app = clipApp();
    const { acc, keys } = await queued(app);
    stubProviders({ segmind: async () => { await refund(db, keys[0]!); return new Response(mp4Bytes()); } });
    await runClipJob(app.env, keys[0]!, new Msg());
    expect(await row(keys[0]!)).toMatchObject({ state: 'failed_terminal', error: 'expired' });
    expect(await exists(app, `out/${keys[0]}`)).toBe(false);
    expect(await balanceOf(acc.walletId)).toBe(200 - 10);
  });
});

describe('status, download and acknowledgement', () => {
  async function ready(app: App): Promise<{ acc: Account; key: string }> {
    stubProviders();
    const { acc, keys } = await queued(app);
    await runClipJob(app.env, keys[0]!, new Msg());
    return { acc, key: keys[0]! };
  }
  const get = (app: App, acc: Account, path: string, headers: Record<string, string> = {}) => app.call(path, { headers: { ...acc.headers, ...headers } });

  it('status shows the wallet\'s own clips only', async () => {
    const app = clipApp();
    const { acc, key } = await ready(app);
    const other = await account(app, 50);
    const j = (await (await get(app, acc, `/v1/clip/status?keys=${key},nobody-here-1`)).json()) as Json;
    expect(j.clips).toEqual([{ key, shot_id: expect.any(String), state: 'ready', seconds: 5, talking: false, voice_over: false, error: null }]);
    expect(((await (await get(app, other, `/v1/clip/status?keys=${key}`)).json()) as Json).clips).toEqual([]);
    expect((await get(app, acc, '/v1/clip/status')).status).toBe(400);
  });

  it('downloads the whole file with no caching, and resumes from a byte range', async () => {
    const app = clipApp();
    const { acc, key } = await ready(app);
    const full = await get(app, acc, `/v1/clip/file?key=${key}`);
    expect(full.status).toBe(200);
    expect(full.headers.get('Cache-Control')).toBe('no-store');
    expect(full.headers.get('Accept-Ranges')).toBe('bytes');
    expect((await full.arrayBuffer()).byteLength).toBe(4096);
    const part = await get(app, acc, `/v1/clip/file?key=${key}`, { Range: 'bytes=0-99' });
    expect(part.status).toBe(206);
    expect(part.headers.get('Content-Range')).toBe('bytes 0-99/4096');
    expect((await part.arrayBuffer()).byteLength).toBe(100);
    const rest = await get(app, acc, `/v1/clip/file?key=${key}`, { Range: 'bytes=4000-' });
    expect(rest.headers.get('Content-Range')).toBe('bytes 4000-4095/4096');
    expect((await rest.arrayBuffer()).byteLength).toBe(96);
    const tail = await get(app, acc, `/v1/clip/file?key=${key}`, { Range: 'bytes=-50' });
    expect(tail.headers.get('Content-Range')).toBe('bytes 4046-4095/4096');
    expect((await get(app, acc, `/v1/clip/file?key=${key}`, { Range: 'bytes=5000-' })).status).toBe(416);
    expect((await get(app, acc, `/v1/clip/file?key=${key}`, { Range: 'items=1-2' })).status).toBe(416);
  });

  it('refuses a clip that is not ready, is another wallet\'s, or is gone', async () => {
    const app = clipApp();
    const { acc, key } = await ready(app);
    const queuedOne = await queued(app);
    expect((await get(app, queuedOne.acc, `/v1/clip/file?key=${queuedOne.keys[0]}`)).status).toBe(409);
    expect((await get(app, await account(app, 5), `/v1/clip/file?key=${key}`)).status).toBe(404);
    await deleteObjects(app.env, [`out/${key}`]);
    expect((await get(app, acc, `/v1/clip/file?key=${key}`)).status).toBe(404);
  });

  it('serves from the free KV store if the file is only there', async () => {
    const app = clipApp();
    const { acc, key } = await ready(app);
    const bytes = await getBytes(app.env, `out/${key}`);
    await app.env.CLIPS.delete(`out/${key}`);
    await app.env.CLIPS_KV.put(`out/${key}`, bytes!);
    const r = await get(app, acc, `/v1/clip/file?key=${key}`, { Range: 'bytes=10-19' });
    expect(r.status).toBe(206);
    expect(r.headers.get('Content-Range')).toBe('bytes 10-19/4096');
  });

  it('ack moves a committed result to delivered, once, and only for its owner', async () => {
    const app = clipApp();
    const { acc, key } = await ready(app);
    const ack = (a: Account) => app.call('/v1/ack', { method: 'POST', headers: a.headers, body: JSON.stringify({ key }) });
    expect(((await (await ack(await account(app, 5))).json()) as Json).delivered).toBe(false);
    expect(((await (await ack(acc)).json()) as Json).delivered).toBe(true);
    expect(((await (await ack(acc)).json()) as Json).delivered).toBe(false);
    expect((await request(key))!.status).toBe('delivered');
    expect((await app.call('/v1/ack', { method: 'POST', headers: acc.headers, body: '{}' })).status).toBe(400);
  });
});

describe('clip storage', () => {
  it('falls back to the free KV store when R2 fails, and reads, ranges and deletes across both', async () => {
    const app = clipApp();
    const broken = { ...app.env, CLIPS: { put: async () => { throw new Error('R2 down'); }, get: async () => { throw new Error('R2 down'); }, delete: async () => { throw new Error('R2 down'); } } } as unknown as Env;
    const key = 'out/kv-' + uid();
    await putObject(broken, key, new Uint8Array([1, 2, 3, 4, 5, 6]));
    expect(Array.from((await getBytes(broken, key))!)).toEqual([1, 2, 3, 4, 5, 6]);
    const slice = await getSlice(broken, key, { offset: 2, length: 3 });
    expect(slice).toMatchObject({ size: 6, offset: 2, length: 3 });
    expect(Array.from(slice!.body as Uint8Array)).toEqual([3, 4, 5]);
    await deleteObjects(broken, [key]);
    expect(await getBytes(broken, key)).toBeNull();
  });
});

describe('reading audio and ranges', () => {
  it('reads MP3 length from the frames, WAV from the header, and refuses anything else', () => {
    expect(mp3Seconds(mp3Of(2.6))!).toBeCloseTo(2.6, 1);
    expect(mp3Seconds(mp3Of(8))!).toBeCloseTo(8, 1);
    const wav = new Uint8Array(44 + 32000);
    const dv = new DataView(wav.buffer);
    wav.set([0x52, 0x49, 0x46, 0x46], 0); dv.setUint32(4, wav.length - 8, true); wav.set([0x57, 0x41, 0x56, 0x45], 8);
    wav.set([0x66, 0x6d, 0x74, 0x20], 12); dv.setUint32(16, 16, true); dv.setUint32(28, 16000, true);
    wav.set([0x64, 0x61, 0x74, 0x61], 36); dv.setUint32(40, 32000, true);
    expect(wavSeconds(wav)).toBe(2);
    expect(audioSeconds(wav)).toBe(2);
    expect(audioSeconds(new Uint8Array(500))).toBeNull();
    expect(audioSeconds(jpegBytes())).toBeNull();
    expect(mp3Seconds(new Uint8Array([0x49, 0x44, 0x33, 3, 0, 0, 0, 0, 0, 0]))).toBeNull();
  });
  it('parses byte ranges', () => {
    expect(parseRange('bytes=0-99', 1000)).toEqual({ start: 0, end: 99 });
    expect(parseRange('bytes=900-', 1000)).toEqual({ start: 900, end: 999 });
    expect(parseRange('bytes=-100', 1000)).toEqual({ start: 900, end: 999 });
    expect(parseRange('bytes=0-5000', 1000)).toEqual({ start: 0, end: 999 });
    for (const bad of ['bytes=1000-', 'bytes=50-10', 'bytes=-0', 'bytes=-', 'bytes=a-b', 'items=1-2']) expect(parseRange(bad, 1000)).toBe('invalid');
  });
});
