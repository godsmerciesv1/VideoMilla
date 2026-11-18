import { env } from 'cloudflare:workers';
import { beforeEach, describe, expect, it } from 'vitest';
import { account, balanceOf, type Json, makeApp, post, setConfig } from './harness';
import { counter, uid } from './helpers';
import { spentToday } from '../src/lib/spend_cap';
import { creditPurchase, voidPurchase } from '../src/lib/ledger';

const db = env.DB;
const jpegB64 = btoa(String.fromCharCode(0xff, 0xd8, 0xff, 0xe0, ...Array.from({ length: 80 }, (_, i) => i)));
const mara = { name: 'Mara', age_band: 'child', hair: 'black braids', outfit: 'a red coat' };
const tom = { name: 'Tom', age_band: 'adult' };
const req = (over: Record<string, unknown> = {}) => ({ style: 'storybook', visual: 'Mara holds a lantern in a dark forest', kind: 'keyframe', aspect: '9:16', characters: [mara], project_id: 'proj-' + uid(), ...over });
const img = (app: ReturnType<typeof makeApp>, acc: Awaited<ReturnType<typeof account>>, over: Record<string, unknown> = {}, key?: string | null) => post(app, '/v1/image', acc, req(over), key);
const imageCalls = (app: ReturnType<typeof makeApp>) => app.ai.calls.filter((c) => c.task === 'image');

beforeEach(async () => {
  await db.prepare('DELETE FROM spend').run();
  await setConfig('languages_enabled', ['en', 'ar']);
  await setConfig('caps', { video_usd: 10, workers_ai_usd: 3.3, fallback_usd: 3 });
  await setConfig('fair_use', { established_after_days: 7, pictures_per_day_new: 400, pictures_per_day_established: 0 });
});

describe('POST /v1/image', () => {
  it('makes a 9:16 keyframe for 1 credit, with the Worker writing the prompt', async () => {
    const app = makeApp();
    const acc = await account(app, 10);
    const r = await img(app, acc);
    expect(r.status).toBe(200);
    const j = (await r.json()) as Json;
    expect(j).toMatchObject({ mime: 'image/png', width: 720, height: 1280, charged: 1 });
    expect(typeof j.image).toBe('string');
    expect(await balanceOf(acc.walletId)).toBe(9);
    const call = imageCalls(app)[0]!;
    expect(call.model).toBe('@cf/black-forest-labs/flux-2-klein-4b');
    expect(call.input.form).toMatchObject({ width: 720, height: 1280, refs: 0 });
    expect(call.input.form.prompt).toContain('No text, letters');
    expect(call.input.form.prompt).toContain('Mara, child');
  });

  it('16:9 is 1280x720; a portrait is 448x448 and needs exactly one character', async () => {
    const app = makeApp();
    const acc = await account(app, 10);
    expect(((await (await img(app, acc, { aspect: '16:9' })).json()) as Json)).toMatchObject({ width: 1280, height: 720 });
    expect(((await (await img(app, acc, { kind: 'portrait' })).json()) as Json)).toMatchObject({ width: 448, height: 448, charged: 1 });
    expect((await img(app, acc, { kind: 'portrait', characters: [] })).status).toBe(400);
    expect((await img(app, acc, { kind: 'portrait', characters: [mara, tom] })).status).toBe(400);
  });

  it('passes up to four reference pictures to the model and refuses a fifth, a non-picture or an oversized one', async () => {
    const app = makeApp();
    const acc = await account(app, 10);
    expect((await img(app, acc, { references: [jpegB64, jpegB64] })).status).toBe(200);
    expect(imageCalls(app)[0]!.input.form.refs).toBe(2);
    expect((await img(app, acc, { references: [jpegB64, jpegB64, jpegB64, jpegB64] })).status).toBe(200);
    expect((await img(app, acc, { references: Array(5).fill(jpegB64) })).status).toBe(400);
    expect((await img(app, acc, { references: [btoa('plain text that is not a picture at all, sorry')] })).status).toBe(400);
    expect((await img(app, acc, { references: [btoa(String.fromCharCode(0xff, 0xd8, 0xff) + 'x'.repeat(700_000))] })).status).toBe(400);
    expect(await balanceOf(acc.walletId)).toBe(8);
  });

  it('accepts multipart: a meta field and reference files', async () => {
    const app = makeApp();
    const acc = await account(app, 5);
    const form = new FormData();
    form.append('meta', JSON.stringify(req()));
    form.append('ref0', new Blob([Uint8Array.from(atob(jpegB64), (c) => c.charCodeAt(0))], { type: 'image/jpeg' }), 'a.jpg');
    const headers = { Authorization: acc.headers.Authorization!, 'X-Idempotency-Key': 'mp-' + uid() };
    const r = await app.call('/v1/image', { method: 'POST', headers, body: form });
    expect(r.status).toBe(200);
    expect(imageCalls(app)[0]!.input.form.refs).toBe(1);
  });

  describe('when it fails, nothing is kept', () => {
    it('both models down: busy, refunded, the daily count given back', async () => {
      const app = makeApp();
      app.ai.answers.image = () => { throw new Error('model unavailable'); };
      const acc = await account(app, 10);
      const r = await img(app, acc);
      expect(r.status).toBe(503);
      expect(((await r.json()) as Json).error).toBe('busy');
      expect(await balanceOf(acc.walletId)).toBe(10);
      expect(imageCalls(app)).toHaveLength(2);
      const day = new Date().toISOString().slice(0, 10);
      expect(await counter(`daily:pic:${acc.walletId}:${day}`)).toBe(0);
      expect(await spentToday(db, 'fallback')).toBe(0);
      expect(await spentToday(db, 'workers_ai')).toBe(0);
    });
    it('the larger model is the fallback and spends from the fallback budget', async () => {
      const app = makeApp();
      app.ai.answers.image = (n) => { if (n === 1) throw new Error('capacity'); return { image: btoa(String.fromCharCode(0x89, 0x50, 0x4e, 0x47, ...Array(30).fill(1))) }; };
      const acc = await account(app, 10);
      expect((await img(app, acc)).status).toBe(200);
      expect(imageCalls(app).map((c) => c.model)).toEqual(['@cf/black-forest-labs/flux-2-klein-4b', '@cf/black-forest-labs/flux-2-klein-9b']);
      expect(await spentToday(db, 'fallback')).toBe(25000);
    });
    it('with the fallback budget used up it answers busy without trying the larger model', async () => {
      const app = makeApp();
      app.ai.answers.image = () => { throw new Error('capacity'); };
      await setConfig('caps', { video_usd: 10, workers_ai_usd: 3.3, fallback_usd: 0.001 });
      const acc = await account(app, 10);
      expect((await img(app, acc)).status).toBe(503);
      expect(imageCalls(app)).toHaveLength(1);
      expect(await balanceOf(acc.walletId)).toBe(10);
    });
    it("the provider's own safety filter is a plain 'output_flagged' with no retry and no charge (D-106)", async () => {
      const app = makeApp();
      app.ai.answers.image = () => { throw new Error('Your output has been flagged. Please choose another prompt.'); };
      const acc = await account(app, 10);
      const r = await img(app, acc);
      expect(r.status).toBe(422);
      expect(((await r.json()) as Json).error).toBe('output_flagged');
      expect(imageCalls(app)).toHaveLength(1);
      expect(await balanceOf(acc.walletId)).toBe(10);
    });
    it('an answer that is not a picture is a failure, not a charge', async () => {
      const app = makeApp();
      app.ai.answers.image = () => ({ image: btoa('definitely not a picture here, just text') });
      const acc = await account(app, 10);
      expect((await img(app, acc)).status).toBe(503);
      expect(await balanceOf(acc.walletId)).toBe(10);
    });
  });

  describe('safety', () => {
    it('an unsafe prompt is blocked before any picture is made, and costs nothing', async () => {
      const app = makeApp();
      const acc = await account(app, 10);
      const r = await img(app, acc, { visual: 'UNSAFE something the guard refuses' });
      expect(r.status).toBe(422);
      expect(imageCalls(app)).toHaveLength(0);
      expect(await balanceOf(acc.walletId)).toBe(10);
    });
    it('children and teenagers only in the four cartoon styles', async () => {
      const app = makeApp();
      const acc = await account(app, 10);
      for (const style of ['cinematic', 'ink_noir', 'photoreal_story']) expect((await img(app, acc, { style })).status).toBe(400);
      for (const style of ['storybook', 'comic', 'flat_vector', 'watercolor']) expect((await img(app, acc, { style })).status).toBe(200);
      expect((await img(app, acc, { style: 'cinematic', characters: [tom] })).status).toBe(200);
    });
    it('Realistic Scenes shows no people: characters are refused and the prompt forbids people', async () => {
      const app = makeApp();
      const acc = await account(app, 10);
      expect((await img(app, acc, { style: 'realistic_scenes', characters: [tom] })).status).toBe(400);
      expect((await img(app, acc, { style: 'realistic_scenes', characters: [] })).status).toBe(200);
      expect(imageCalls(app)[0]!.input.form.prompt).toContain('No people');
    });
    it("Photoreal Story's prompt carries the fictional-adults rule", async () => {
      const app = makeApp();
      await img(app, await account(app, 5), { style: 'photoreal_story', characters: [tom] });
      expect(imageCalls(app)[0]!.input.form.prompt).toContain('fictional adult');
    });
    it("the own-face mode is not available yet", async () => {
      const app = makeApp();
      const r = await img(app, await account(app, 5), { self_mode: true });
      expect(r.status).toBe(400);
      expect(((await r.json()) as Json).error).toBe('self_mode_unavailable');
    });
  });

  describe('money', () => {
    it('no credits: 402 and nothing generated; a wallet in debt is refused too', async () => {
      const app = makeApp();
      const acc = await account(app);
      const r = await img(app, acc);
      expect(r.status).toBe(402);
      expect(((await r.json()) as Json).error).toBe('insufficient_credits');
      const debtor = await account(app, 5);
      await db.prepare('UPDATE wallets SET owed = 2 WHERE id = ?').bind(debtor.walletId).run();
      expect(((await (await img(app, debtor)).json()) as Json).error).toBe('debt');
      expect(imageCalls(app)).toHaveLength(0);
    });
    it('the same key twice charges once', async () => {
      const app = makeApp();
      const acc = await account(app, 10);
      const key = 'same-' + uid();
      const project = 'p-' + uid();
      expect((await img(app, acc, { project_id: project }, key)).status).toBe(200);
      expect((await img(app, acc, { project_id: project }, key)).status).toBe(200);
      expect(await balanceOf(acc.walletId)).toBe(9);
    });
    it('ten simultaneous calls with one key: one succeeds, the others are told it is in progress', async () => {
      const app = makeApp();
      const acc = await account(app, 10);
      const key = 'race-' + uid();
      const project = 'p-' + uid();
      const res = await Promise.all(Array.from({ length: 10 }, () => img(app, acc, { project_id: project }, key)));
      expect(res.filter((r) => r.status === 200)).toHaveLength(1);
      expect(res.filter((r) => r.status === 409)).toHaveLength(9);
      expect(await balanceOf(acc.walletId)).toBe(9);
    });
    it('30 simultaneous pictures against 20 credits: exactly 20 are made', async () => {
      const app = makeApp();
      const acc = await account(app, 20);
      const res = await Promise.all(Array.from({ length: 30 }, () => img(app, acc)));
      expect(res.filter((r) => r.status === 200)).toHaveLength(20);
      expect(res.filter((r) => r.status === 402)).toHaveLength(10);
      expect(await balanceOf(acc.walletId)).toBe(0);
    });
    it('the daily AI budget used up: busy, no charge', async () => {
      const app = makeApp();
      const acc = await account(app, 10);
      await setConfig('caps', { video_usd: 10, workers_ai_usd: 0.001, fallback_usd: 3 });
      expect((await img(app, acc)).status).toBe(503);
      expect(await balanceOf(acc.walletId)).toBe(10);
    });
  });

  describe('daily limit follows trust (D-113)', () => {
    beforeEach(() => setConfig('fair_use', { established_after_days: 7, pictures_per_day_new: 3, pictures_per_day_established: 0 }));

    it('a new wallet stops at its limit, and the refused picture costs nothing', async () => {
      const app = makeApp();
      const acc = await account(app, 20);
      for (let i = 0; i < 3; i++) expect((await img(app, acc)).status).toBe(200);
      const r = await img(app, acc);
      expect(r.status).toBe(429);
      expect(((await r.json()) as Json).error).toBe('daily_limit');
      expect(await balanceOf(acc.walletId)).toBe(17);
    });
    it('a wallet whose first purchase is a week old has no daily limit', async () => {
      const app = makeApp();
      const acc = await account(app, 20);
      await db.prepare('UPDATE purchases SET created_at = ? WHERE wallet_id = ?').bind(Math.floor(Date.now() / 1000) - 8 * 86400, acc.walletId).run();
      for (let i = 0; i < 6; i++) expect((await img(app, acc)).status).toBe(200);
    });
    it('a refunded purchase keeps a wallet in the limited tier however old it is', async () => {
      const app = makeApp();
      const acc = await account(app, 20);
      const old = Math.floor(Date.now() / 1000) - 30 * 86400;
      await db.prepare('UPDATE purchases SET created_at = ? WHERE wallet_id = ?').bind(old, acc.walletId).run();
      const ref = 'p-' + uid();
      await creditPurchase(db, { refHash: ref, walletId: acc.walletId, channel: 'play', credits: 25 });
      await voidPurchase(db, ref);
      await db.prepare('UPDATE wallets SET balance = 20, owed = 0 WHERE id = ?').bind(acc.walletId).run();
      for (let i = 0; i < 3; i++) expect((await img(app, acc)).status).toBe(200);
      expect((await img(app, acc)).status).toBe(429);
    });
  });

  describe('input checks', () => {
    it('refuses bad input before any model is called', async () => {
      const app = makeApp();
      const acc = await account(app, 10);
      const bads: Array<Record<string, unknown>> = [{ style: 'anime' }, { kind: 'poster' }, { aspect: '4:3' }, { visual: '' }, { visual: undefined }, { project_id: 'bad id' }, { characters: 'Mara' }, { characters: [{ name: 'X', age_band: 'baby' }] }, { characters: [mara, tom, tom] }];
      for (const over of bads) expect((await img(app, acc, over)).status).toBe(400);
      expect((await img(app, acc, {}, null)).status).toBe(400);
      expect((await img(app, acc, {}, 'bad key!')).status).toBe(400);
      expect((await app.call('/v1/image', { method: 'POST', body: '{}' })).status).toBe(401);
      expect((await app.call('/v1/image', { method: 'POST', headers: { ...acc.headers, 'X-Idempotency-Key': 'big-' + uid(), 'content-length': '9000000' }, body: '{}' })).status).toBe(413);
      expect(imageCalls(app)).toHaveLength(0);
    });
  });
});
