import { env } from 'cloudflare:workers';
import { beforeEach, describe, expect, it } from 'vitest';
import type { Env } from '../src/env';
import { runDaily, runFrequent } from '../src/lib/cron';
import worker from '../src/index';
import { putObject } from '../src/lib/clip_store';
import { releaseFree, takeFree } from '../src/lib/free_counter';
import { creditPurchase, reserve } from '../src/lib/ledger';
import { spendCaps } from '../src/lib/provider_router';
import { grantReferral } from '../src/lib/referrals';
import { reserveSpend } from '../src/lib/spend_cap';
import { clearConfigCache } from '../src/routes/config';
import { FakeQueue, makeAccountFor, makeApp, setConfig, type App } from './harness';
import { counter, expectConsistent, newWallet, uid, walletRow } from './helpers';

const db = env.DB;
let queue: FakeQueue;
const cronApp = (): App => makeApp({ CLIP_JOBS: queue as unknown as Env['CLIP_JOBS'] });
const sec = () => Math.floor(Date.now() / 1000);
const MIN = 60_000;
const HOUR = 3_600_000;
const row = <T>(sql: string, ...b: unknown[]) => db.prepare(sql).bind(...b).first<T>();

beforeEach(async () => {
  queue = new FakeQueue();
  // Requests left reserved by an earlier test would also be stale in this one, so each test starts without any.
  await db.prepare("UPDATE requests SET status = 'refunded', settled = 1 WHERE status = 'reserved'").run();
  await db.prepare('DELETE FROM spend').run();
  await db.prepare('DELETE FROM purchases').run();
  await db.prepare('DELETE FROM referrals').run();
  await db.prepare("DELETE FROM config WHERE key IN ('caps_effective', 'r7_summary')").run();
  await db.prepare("DELETE FROM counters WHERE key LIKE 'cap:%' OR key LIKE 'r7:%'").run();
  await setConfig('caps', { video_usd: 10, workers_ai_usd: 3.3, fallback_usd: 3, google_chars_usd: 2 });
  await setConfig('caps_policy', { enabled: true, share_video: 0.3, share_workers_ai: 0.1, window_days: 7, credit_net_usd: 0.0225, ceiling_video_usd: null, ceiling_workers_ai_usd: null });
  await setConfig('clip_retention_hours', 48);
  await setConfig('referral', { min_pack_credits: 90, percent: 10, hold_days: 14, max_referrals_30d: 20, max_bonus_30d: 500 });
  clearConfigCache();
});

describe('stale work', () => {
  it('refunds an analysis abandoned for 15 minutes and gives its free use back; leaves a fresh one alone', async () => {
    const app = cronApp();
    const w = await newWallet(50);
    const project = 'p-' + uid();
    const stale = 'stale-' + uid();
    const fresh = 'fresh-' + uid();
    await takeFree(db, w, project);
    await reserve(db, { key: stale, walletId: w, action: 'structure', cost: 1, projectId: project });
    expect(await counter(`free:${w}:${project}`)).toBe(1);

    expect((await runDaily(app.env, Date.now() + 10 * MIN)).staleRefunded).toBe(0); // not yet 15 minutes old
    const r = await runDaily(app.env, Date.now() + 16 * MIN);
    expect(r.staleRefunded).toBe(1);
    expect((await walletRow(w)).balance).toBe(50);
    expect(await counter(`free:${w}:${project}`)).toBe(0);
    expect((await row<{ status: string }>('SELECT status FROM requests WHERE key = ?', stale))!.status).toBe('refunded');
    await reserve(db, { key: fresh, walletId: w, action: 'picture', cost: 1 });
    expect((await runDaily(app.env, Date.now() + 5 * MIN)).staleRefunded).toBe(0);
    await expectConsistent(w);
  });

  it('refunds a clip waiting 30 minutes, fails it as expired, gives back the daily seconds and clears its inputs', async () => {
    const app = cronApp();
    const w = await newWallet(50);
    const key = 'clip-' + uid();
    await reserve(db, { key, walletId: w, action: 'clip', cost: 10 });
    await db.prepare("INSERT INTO clips(key, wallet_id, shot_id, seconds, state, updated_at) VALUES(?, ?, 's1', 5, 'queued', ?)").bind(key, w, sec()).run();
    const day = new Date().toISOString().slice(0, 10);
    await db.prepare("INSERT INTO counters(key, window, count) VALUES(?, ?, 5)").bind(`daily:anim:${w}:${day}`, day).run();
    await putObject(app.env, `in/${key}/frame`, new Uint8Array([1, 2, 3]));

    expect((await runDaily(app.env, Date.now() + 20 * MIN)).clipsRefunded).toBe(0);
    const r = await runDaily(app.env, Date.now() + 31 * MIN);
    expect(r.clipsRefunded).toBe(1);
    expect((await walletRow(w)).balance).toBe(50);
    expect(await row('SELECT state, error FROM clips WHERE key = ?', key)).toEqual({ state: 'failed_terminal', error: 'expired' });
    expect(await counter(`daily:anim:${w}:${day}`)).toBe(0);
    expect(await app.env.CLIPS.head(`in/${key}/frame`)).toBeNull();
  });

  it('puts a clip whose consumer died back on the queue', async () => {
    const app = cronApp();
    const w = await newWallet(50);
    const key = 'stuck-' + uid();
    await reserve(db, { key, walletId: w, action: 'clip', cost: 10 });
    await db.prepare("INSERT INTO clips(key, wallet_id, shot_id, seconds, state, updated_at) VALUES(?, ?, 's1', 5, 'running', ?)").bind(key, w, sec() - 1300).run();
    const r = await runDaily(app.env);
    expect(r.clipsReset).toBe(1);
    expect(queue.sent).toEqual([key]);
    expect((await row<{ state: string }>('SELECT state FROM clips WHERE key = ?', key))!.state).toBe('queued');
    expect((await runDaily(app.env)).clipsReset).toBe(0);
  });
});

describe('storage cleanup (48 hours, D-099)', () => {
  it('keeps files younger than the retention period and deletes older ones', async () => {
    const app = cronApp();
    const names = [`out/${uid()}`, `in/${uid()}/frame`];
    for (const n of names) await putObject(app.env, n, new Uint8Array([9, 9, 9]));
    expect((await runDaily(app.env, Date.now() + 47 * HOUR)).objectsDeleted).toBe(0);
    for (const n of names) expect(await app.env.CLIPS.head(n)).not.toBeNull();
    const r = await runDaily(app.env, Date.now() + 49 * HOUR);
    expect(r.objectsDeleted).toBeGreaterThanOrEqual(2);
    for (const n of names) expect(await app.env.CLIPS.head(n)).toBeNull();
  });
  it('follows the configured retention', async () => {
    const app = cronApp();
    await setConfig('clip_retention_hours', 24);
    const n = `out/${uid()}`;
    await putObject(app.env, n, new Uint8Array([1, 2, 3]));
    await runDaily(app.env, Date.now() + 23 * HOUR);
    expect(await app.env.CLIPS.head(n)).not.toBeNull();
    await runDaily(app.env, Date.now() + 25 * HOUR);
    expect(await app.env.CLIPS.head(n)).toBeNull();
  });
});

describe('spend caps', () => {
  it('writes the 50% and 80% milestones once each', async () => {
    const app = cronApp();
    await reserveSpend(db, 'video', 5_000_000, 10_000_000);
    expect((await runDaily(app.env)).milestones).toContain('video:50');
    expect((await runDaily(app.env)).milestones).not.toContain('video:50');
    await reserveSpend(db, 'video', 3_000_000, 10_000_000);
    expect((await runDaily(app.env)).milestones).toContain('video:80');
  });

  describe('follow revenue (D-111)', () => {
    const sell = async (credits: number) => { await creditPurchase(db, { refHash: 'sale-' + uid(), walletId: await newWallet(), channel: 'play', credits }); };
    const effective = async () => { clearConfigCache(); const c = await spendCaps(db); return { video: c.videoMicro / 1e6, ai: c.workersAiMicro / 1e6 }; };

    it('with no sales the caps are the configured floors', async () => {
      const r = await runDaily(cronApp().env);
      expect(r.capsEffective).toEqual({ video_usd: 10, workers_ai_usd: 3.3 });
      expect(await effective()).toEqual({ video: 10, ai: 3.3 });
    });
    it('rise with a week of sales: 30% of daily sales for video, 10% for Workers AI', async () => {
      await sell(70_000); // 10,000 credits a day at $0.0225 = $225 a day
      const r = await runDaily(cronApp().env);
      expect(r.capsEffective).toEqual({ video_usd: 67.5, workers_ai_usd: 22.5 });
      expect(await effective()).toEqual({ video: 67.5, ai: 22.5 });
    });
    it('stay at the floor while sales are small', async () => {
      await sell(700); // $2.25 a day: 30% of that is far below the $10 floor
      await runDaily(cronApp().env);
      expect(await effective()).toEqual({ video: 10, ai: 3.3 });
    });
    it('never go above the ceiling the operator sets for the funded balance', async () => {
      await sell(70_000);
      await setConfig('caps_policy', { enabled: true, share_video: 0.3, share_workers_ai: 0.1, window_days: 7, credit_net_usd: 0.0225, ceiling_video_usd: 50, ceiling_workers_ai_usd: 5 });
      await runDaily(cronApp().env);
      expect(await effective()).toEqual({ video: 50, ai: 5 });
    });
    it('ignore refunded purchases and old sales', async () => {
      await sell(70_000);
      await db.prepare("UPDATE purchases SET state = 'voided'").run();
      await runDaily(cronApp().env);
      expect(await effective()).toEqual({ video: 10, ai: 3.3 });
      await db.prepare("UPDATE purchases SET state = 'paid', created_at = ?").bind(sec() - 30 * 86400).run();
      await runDaily(cronApp().env);
      expect(await effective()).toEqual({ video: 10, ai: 3.3 });
    });
    it('can be switched off, and a raised floor always wins', async () => {
      await sell(70_000);
      await setConfig('caps_policy', { enabled: false });
      expect((await runDaily(cronApp().env)).capsEffective).toBeNull();
      expect(await effective()).toEqual({ video: 10, ai: 3.3 });
      await setConfig('caps_policy', { enabled: true });
      await runDaily(cronApp().env);
      await setConfig('caps', { video_usd: 100, workers_ai_usd: 3.3, fallback_usd: 3, google_chars_usd: 2 });
      expect((await effective()).video).toBe(100);
    });
  });
});

describe('referrals, tokens and the conversion summary', () => {
  it('settles referrals whose hold is over', async () => {
    const app = cronApp();
    const referrerWallet = await newWallet();
    const referrer = await makeAccountFor(referrerWallet);
    const buyer = await newWallet();
    await makeAccountFor(buyer, { referredBy: referrer });
    const ref = 'p-' + uid();
    const t0 = sec();
    await creditPurchase(db, { refHash: ref, walletId: buyer, channel: 'play', credits: 160 });
    await grantReferral(db, { walletId: buyer, purchaseRef: ref, packCredits: 160 }, t0);
    expect((await runDaily(app.env, (t0 + 13 * 86400) * 1000)).referrals?.settled).toBe(0);
    expect((await runDaily(app.env, (t0 + 15 * 86400) * 1000)).referrals?.settled).toBe(1);
    expect((await walletRow(referrerWallet)).balance).toBe(16);
  });

  it('clears expired login tokens and old email counters, keeps live ones', async () => {
    const app = cronApp();
    const t = (id: string, expires: number) => db.prepare("INSERT INTO auth_tokens(id, email, token_hash, code_hash, expires_at) VALUES(?, 'a@example.test', ?, 'c', ?)").bind(id, 'h-' + id, expires).run();
    await t('old-' + uid(), sec() - 3 * 86400);
    await t('live-' + uid(), sec() + 600);
    const r = await runDaily(app.env);
    expect(r.tokensCleared).toBeGreaterThanOrEqual(1);
    expect((await row<{ n: number }>("SELECT COUNT(*) AS n FROM auth_tokens WHERE id LIKE 'live-%'"))!.n).toBe(1);
    expect((await row<{ n: number }>("SELECT COUNT(*) AS n FROM auth_tokens WHERE id LIKE 'old-%'"))!.n).toBe(0);
  });

  it('writes the purchase-gate conversion summary, and a milestone when gate wallets pass the review figure', async () => {
    const app = cronApp();
    await db.prepare("INSERT INTO counters(key, window, count) VALUES('r7:gate_wallets', 'all', 600), ('r7:first_buyers', 'all', 150)").run();
    const r = await runDaily(app.env);
    expect(r.conversion).toEqual({ gate_wallets: 600, first_buyers: 150 });
    clearConfigCache();
    const s = JSON.parse((await row<{ value: string }>("SELECT value FROM config WHERE key = 'r7_summary'"))!.value);
    expect(s).toMatchObject({ gate_wallets: 600, first_buyers: 150, ratio: 0.25 });
    expect(await counter('r7:review_milestone')).toBe(600);
  });
});

describe('the run itself', () => {
  it('writes the heartbeat last, reports no errors, and is safe to repeat', async () => {
    const app = cronApp();
    const t = Date.now();
    const first = await runDaily(app.env, t);
    expect(first.errors).toEqual([]);
    expect((await row<{ last_run: number }>("SELECT last_run FROM heartbeats WHERE job = 'daily'"))!.last_run).toBe(Math.floor(t / 1000));
    const second = await runDaily(app.env, t);
    expect(second).toMatchObject({ staleRefunded: 0, clipsReset: 0, clipsRefunded: 0, objectsDeleted: 0, errors: [] });
  });

  it('one failing step does not stop the others, and the failure is reported', async () => {
    const app = cronApp();
    const w = await newWallet(20);
    const key = 'stale-' + uid();
    await reserve(db, { key, walletId: w, action: 'picture', cost: 1 });
    const broken = { ...app.env, CLIPS: { list: async () => { throw new Error('R2 list failed'); }, delete: async () => undefined, head: async () => null } } as unknown as Env;
    const r = await runDaily(broken, Date.now() + 16 * MIN);
    expect(r.errors.some((e) => e.startsWith('storage_cleanup'))).toBe(true);
    expect(r.staleRefunded).toBe(1);
    expect(r.capsEffective).not.toBeNull();
    expect((await row<{ last_run: number }>("SELECT last_run FROM heartbeats WHERE job = 'daily'"))).toBeTruthy();
  });

  it('releaseFree never goes below zero', async () => {
    const w = await newWallet();
    await releaseFree(db, w, 'never-used');
    expect(await counter(`free:${w}:never-used`)).toBe(0);
  });
});

describe('the 15-minute pass (D-134)', () => {
  it('refunds abandoned work and writes its own heartbeat, but does none of the daily jobs', async () => {
    const app = cronApp();
    const w = await newWallet(20);
    const key = 'abandoned-' + uid();
    await reserve(db, { key, walletId: w, action: 'picture', cost: 1 });
    await putObject(app.env, `out/${uid()}`, new Uint8Array([1, 2, 3]));
    await db.prepare("DELETE FROM heartbeats WHERE job = 'daily'").run();
    const r = await runFrequent(app.env, Date.now() + 49 * HOUR);
    expect(r).toMatchObject({ staleRefunded: 1, errors: [] });
    expect((await walletRow(w)).balance).toBe(20);
    expect(await row("SELECT last_run FROM heartbeats WHERE job = 'frequent'")).toBeTruthy();
    expect(await row("SELECT last_run FROM heartbeats WHERE job = 'daily'")).toBeNull(); // no daily run happened
    expect((await app.env.CLIPS.list({ prefix: 'out/' })).objects.length).toBeGreaterThan(0); // storage untouched
  });

  it('is what the scheduler runs on the 15-minute trigger; any other trigger runs the daily job', async () => {
    const app = cronApp();
    const w = await newWallet(20);
    await reserve(db, { key: 'sched-' + uid(), walletId: w, action: 'picture', cost: 1 });
    await db.prepare("DELETE FROM heartbeats").run();
    await worker.scheduled({ cron: '*/15 * * * *' } as ScheduledController, app.env);
    expect(await row("SELECT last_run FROM heartbeats WHERE job = 'frequent'")).toBeTruthy();
    expect(await row("SELECT last_run FROM heartbeats WHERE job = 'daily'")).toBeNull();
    await worker.scheduled({ cron: '0 3 * * *' } as ScheduledController, app.env);
    expect(await row("SELECT last_run FROM heartbeats WHERE job = 'daily'")).toBeTruthy();
  });

  it('is safe to repeat and to overlap with the daily run', async () => {
    const app = cronApp();
    const w = await newWallet(20);
    await reserve(db, { key: 'overlap-' + uid(), walletId: w, action: 'picture', cost: 1 });
    const t = Date.now() + 16 * MIN;
    const res = await Promise.all([runFrequent(app.env, t), runFrequent(app.env, t), runDaily(app.env, t)]);
    expect(res.reduce((a, x) => a + x.staleRefunded, 0)).toBe(1);
    expect((await walletRow(w)).balance).toBe(20);
    await expectConsistent(w);
  });
});
