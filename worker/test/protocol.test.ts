import { env } from 'cloudflare:workers';
import { beforeEach, describe, expect, it } from 'vitest';
import { runDaily } from '../src/lib/cron';
import { reserve } from '../src/lib/ledger';
import { account, balanceOf, type Json, makeApp, post, setConfig, type Account, type App } from './harness';
import { expectConsistent, uid, walletRow } from './helpers';

const db = env.DB;
const sec = () => Math.floor(Date.now() / 1000);
const imageReq = (over: Record<string, unknown> = {}) => ({ style: 'storybook', visual: 'A lantern in a forest', kind: 'keyframe', aspect: '9:16', characters: [], project_id: 'proj-' + uid(), ...over });
const structReq = (project = 'proj-' + uid()) => ({ script: 'A girl named Mara follows a lantern through the forest at night.', language: 'en', style: 'storybook', target_length_s: 30, project_id: project });

beforeEach(async () => {
  await db.prepare('DELETE FROM spend').run();
  await setConfig('languages_enabled', ['en']);
  await setConfig('caps', { video_usd: 10, workers_ai_usd: 3.3, fallback_usd: 3 });
  await setConfig('fair_use', { established_after_days: 7, pictures_per_day_new: 100000, pictures_per_day_established: 0 });
});

describe('the request protocol (blueprint 23.4)', () => {
  it('a client that lost the response retries with the same key and is charged once', async () => {
    const app = makeApp();
    const acc = await account(app, 10);
    const key = 'lost-' + uid();
    const project = 'p-' + uid();
    expect((await post(app, '/v1/image', acc, imageReq({ project_id: project }), key)).status).toBe(200); // response "lost"
    expect((await post(app, '/v1/image', acc, imageReq({ project_id: project }), key)).status).toBe(200);
    expect(await balanceOf(acc.walletId)).toBe(9);
  });

  it('a request abandoned for over 120 seconds is taken over by the retry, and charged once', async () => {
    const app = makeApp();
    const acc = await account(app, 10);
    const key = 'lease-' + uid();
    await reserve(db, { key, walletId: acc.walletId, action: 'picture', cost: 1 });
    await db.prepare('UPDATE requests SET updated_at = ? WHERE key = ?').bind(sec() - 200, key).run();
    const r = await post(app, '/v1/image', acc, imageReq(), key);
    expect(r.status).toBe(200);
    expect(await balanceOf(acc.walletId)).toBe(9);
    expect((await db.prepare('SELECT status FROM requests WHERE key = ?').bind(key).first<Json>())!.status).toBe('committed');
  });

  it('within the 120 seconds the retry is told the first call is still in progress', async () => {
    const app = makeApp();
    const acc = await account(app, 10);
    const key = 'busy-' + uid();
    await reserve(db, { key, walletId: acc.walletId, action: 'picture', cost: 1 });
    const r = await post(app, '/v1/image', acc, imageReq(), key);
    expect(r.status).toBe(409);
    expect(((await r.json()) as Json).error).toBe('in_progress');
    expect(await balanceOf(acc.walletId)).toBe(9);
  });

  it('a taken-over request that then fails is refunded', async () => {
    const app = makeApp();
    app.ai.answers.image = () => { throw new Error('model down'); };
    const acc = await account(app, 10);
    const key = 'lease-fail-' + uid();
    await reserve(db, { key, walletId: acc.walletId, action: 'picture', cost: 1 });
    await db.prepare('UPDATE requests SET updated_at = ? WHERE key = ?').bind(sec() - 200, key).run();
    expect((await post(app, '/v1/image', acc, imageReq(), key)).status).toBe(503);
    expect(await balanceOf(acc.walletId)).toBe(10);
    await expectConsistent(acc.walletId);
  });

  it('after the cron refunds an abandoned request, the same key is told so and a new key works', async () => {
    const app = makeApp();
    const acc = await account(app, 10);
    const key = 'expire-' + uid();
    await reserve(db, { key, walletId: acc.walletId, action: 'picture', cost: 1 });
    await runDaily(app.env, Date.now() + 16 * 60_000);
    expect(await balanceOf(acc.walletId)).toBe(10);
    const again = await post(app, '/v1/image', acc, imageReq(), key);
    expect(again.status).toBe(409);
    expect(((await again.json()) as Json).error).toBe('refunded');
    expect((await post(app, '/v1/image', acc, imageReq(), 'fresh-' + uid())).status).toBe(200);
    expect(await balanceOf(acc.walletId)).toBe(9);
  });

  it('delivered results are reported as delivered', async () => {
    const app = makeApp();
    const acc = await account(app, 10);
    const key = 'deliver-' + uid();
    const project = 'p-' + uid();
    await post(app, '/v1/image', acc, imageReq({ project_id: project }), key);
    await app.call('/v1/ack', { method: 'POST', headers: acc.headers, body: JSON.stringify({ key }) });
    const r = await post(app, '/v1/image', acc, imageReq({ project_id: project }), key);
    expect(r.status).toBe(409);
    expect(((await r.json()) as Json).error).toBe('already_delivered');
  });
});

/** A small seeded generator so a failing run can be replayed. */
function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe('randomized fault run', () => {
  for (const seed of [11, 2026, 90210]) {
    it(`seed ${seed}: failures, duplicates, abandoned requests and cron runs never break the money`, async () => {
      const app: App = makeApp();
      const rand = rng(seed);
      const pick = <T>(a: T[]): T => a[Math.floor(rand() * a.length)]!;
      let aiCalls = 0;
      // Every AI call can fail; picture calls can also be refused by the provider's own filter.
      app.ai.answers.image = () => {
        aiCalls++;
        const x = rand();
        if (x < 0.2) throw new Error('capacity');
        if (x < 0.3) throw new Error('Your output has been flagged');
        return { image: btoa(String.fromCharCode(0x89, 0x50, 0x4e, 0x47, ...Array(30).fill(1))) };
      };
      app.ai.answers.structure = (_n, _i) => {
        aiCalls++;
        if (rand() < 0.3) throw new Error('capacity');
        return { choices: [{ message: { content: JSON.stringify({ title: 't', characters: [], scenes: [{ id: 'a', heading: '', shots: [0, 1, 2, 3, 4, 5].map((i) => ({ id: `s${i}`, duration_s: 5, visual: 'v', narration: 'n', narration_en: 'n', lines: [], camera: 'c', motion: 'hold', character_ids: [] })) }] }) } }] };
      };

      const FUNDING = 40;
      const wallets: Array<{ acc: Account; keys: string[]; projects: string[] }> = [];
      for (let i = 0; i < 4; i++) wallets.push({ acc: await account(app, FUNDING), keys: Array.from({ length: 12 }, () => 'k-' + uid()), projects: ['p-' + uid(), 'p-' + uid()] });

      for (let step = 0; step < 90; step++) {
        const w = pick(wallets);
        const key = pick(w.keys);
        const op = rand();
        if (op < 0.45) await post(app, '/v1/image', w.acc, imageReq({ project_id: pick(w.projects) }), key);
        else if (op < 0.7) await post(app, '/v1/structure', w.acc, structReq(pick(w.projects)), key);
        else if (op < 0.8) await Promise.all([1, 2, 3].map(() => post(app, '/v1/image', w.acc, imageReq({ project_id: pick(w.projects) }), key)));
        else if (op < 0.9) await reserve(db, { key: 'ghost-' + uid(), walletId: w.acc.walletId, action: 'picture', cost: 1 }); // a call that crashed after reserving
        else await runDaily(app.env, Date.now() + (rand() < 0.5 ? 16 * 60_000 : 60_000));
      }
      await runDaily(app.env, Date.now() + 60 * 60_000); // everything still abandoned is now stale

      for (const w of wallets) {
        const id = w.acc.walletId;
        await expectConsistent(id); // balance equals the ledger, nothing negative
        const spent = await db.prepare("SELECT COALESCE(SUM(credits), 0) AS c FROM requests WHERE wallet_id = ? AND status IN ('committed', 'delivered')").bind(id).first<{ c: number }>();
        expect((await walletRow(id)).balance).toBe(FUNDING - spent!.c); // exactly what completed work cost, nothing else
      }
      const bad = await db.prepare(
        `SELECT r.key, r.status,
                (SELECT COUNT(*) FROM ledger l WHERE l.ref = r.key AND l.kind = 'reserve') AS reserves,
                (SELECT COUNT(*) FROM ledger l WHERE l.ref = r.key AND l.kind = 'refund') AS refunds
           FROM requests r`,
      ).all<{ key: string; status: string; reserves: number; refunds: number }>();
      for (const q of bad.results) {
        expect(q.reserves).toBe(1); // reserved exactly once
        if (q.status === 'refunded') expect(q.refunds).toBe(1); // refunded exactly once
        else expect(q.refunds).toBe(0); // completed work is never also refunded
        expect(['committed', 'delivered', 'refunded']).toContain(q.status); // nothing left hanging
      }
      expect(aiCalls).toBeGreaterThan(10);
      // The run must have seen both outcomes, or it proved nothing.
      const seen = await db.prepare("SELECT status, COUNT(*) AS n FROM requests WHERE wallet_id IN (" + wallets.map(() => '?').join(',') + ') GROUP BY status').bind(...wallets.map((w) => w.acc.walletId)).all<{ status: string; n: number }>();
      const count = (st: string) => seen.results.find((r) => r.status === st)?.n ?? 0;
      expect(count('refunded')).toBeGreaterThan(3);
      expect(count('committed') + count('delivered')).toBeGreaterThan(3);
    });
  }
});
