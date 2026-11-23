import { env } from 'cloudflare:workers';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Env } from '../src/env';
import { verifySignature } from '../src/lib/polar';
import { reserve } from '../src/lib/ledger';
import { account, balanceOf, type Json, makeAccountFor, makeApp, POLAR_SECRET, setConfig, signHook, type App } from './harness';
import { counter, expectConsistent, newWallet, uid, walletRow } from './helpers';

const db = env.DB;
const polarApp = (): App => makeApp({ POLAR_WEBHOOK_SECRET: POLAR_SECRET, POLAR_ACCESS_TOKEN: 'polar-token' } as Partial<Env>);
afterEach(() => vi.unstubAllGlobals());

beforeEach(async () => {
  await setConfig('packs_polar', [{ product_id: 'prod_160', credits: 160 }, { product_id: 'prod_350', credits: 350 }, { product_id: 'prod_750', credits: 750 }]);
  await setConfig('flags', { purchases_enabled: true, cartoon_me_enabled: false, google_signin_enabled: false });
  await setConfig('referral', { min_pack_credits: 90, percent: 10, hold_days: 14, max_referrals_30d: 20, max_bonus_30d: 500 });
});

describe('webhook signature', () => {
  const e = { ...(env as unknown as Env), POLAR_WEBHOOK_SECRET: POLAR_SECRET } as Env;
  const verify = async (body: string, h: Record<string, string>, nowS?: number) => verifySignature(e, new Headers(h), body, nowS);

  it('accepts a correctly signed body, with the secret used as raw bytes or as base64', async () => {
    expect(await verify('{"a":1}', await signHook('{"a":1}'))).toBe(true);
    const b64Secret = 'whsec_' + btoa('another-secret-value-xyz');
    const eb = { ...e, POLAR_WEBHOOK_SECRET: b64Secret } as Env;
    expect(await verifySignature(eb, new Headers(await signHook('{"a":1}', { secret: b64Secret, key: 'base64' })), '{"a":1}')).toBe(true);
  });
  it('accepts when one of several signatures in the header is valid', async () => {
    const h = await signHook('{"a":1}');
    h['webhook-signature'] = `v1,AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA= ${h['webhook-signature']} v2,zzzz`;
    expect(await verify('{"a":1}', h)).toBe(true);
  });
  it('refuses a wrong secret, a changed body, missing headers and an unknown version', async () => {
    expect(await verify('{"a":1}', await signHook('{"a":1}', { secret: 'whsec_somebody_else' }))).toBe(false);
    expect(await verify('{"a":2}', await signHook('{"a":1}'))).toBe(false);
    const h = await signHook('{"a":1}');
    for (const drop of ['webhook-id', 'webhook-timestamp', 'webhook-signature']) {
      const c = { ...h };
      delete c[drop];
      expect(await verify('{"a":1}', c)).toBe(false);
    }
    expect(await verify('{"a":1}', { ...h, 'webhook-signature': h['webhook-signature']!.replace('v1,', 'v2,') })).toBe(false);
  });
  it('refuses timestamps more than 5 minutes away (replay), either direction', async () => {
    const now = Math.floor(Date.now() / 1000);
    expect(await verify('{}', await signHook('{}', { ts: now - 299 }), now)).toBe(true);
    expect(await verify('{}', await signHook('{}', { ts: now - 301 }), now)).toBe(false);
    expect(await verify('{}', await signHook('{}', { ts: now + 301 }), now)).toBe(false);
    expect(await verify('{}', { ...(await signHook('{}')), 'webhook-timestamp': 'abc' })).toBe(false);
  });
  it('refuses everything when no secret is configured', async () => {
    expect(await verifySignature({ ...e, POLAR_WEBHOOK_SECRET: '' } as Env, new Headers(await signHook('{}')), '{}')).toBe(false);
  });
});

describe('POST /v1/checkout/polar', () => {
  const checkout = (a: App, acc: Awaited<ReturnType<typeof account>>, body: unknown) => a.call('/v1/checkout/polar', { method: 'POST', headers: acc.headers, body: JSON.stringify(body) });
  const stub = (handler: () => Response = () => Response.json({ url: 'https://polar.test/checkout/abc', id: 'chk_1' })): Array<{ url: string; init: RequestInit }> => {
    const calls: Array<{ url: string; init: RequestInit }> = [];
    vi.stubGlobal('fetch', async (url: string, init: RequestInit = {}) => { calls.push({ url: String(url), init }); return handler(); });
    return calls;
  };

  it('stays off until purchases are switched on', async () => {
    const a = polarApp();
    await setConfig('flags', { purchases_enabled: false });
    const acc = await account(a);
    await makeAccountFor(acc.walletId);
    const r = await checkout(a, acc, { product_id: 'prod_160' });
    expect(r.status).toBe(403);
    expect(((await r.json()) as Json).error).toBe('purchases_disabled');
  });
  it('needs a signed-in account', async () => {
    const a = polarApp();
    const calls = stub();
    const r = await checkout(a, await account(a), { product_id: 'prod_160' });
    expect(r.status).toBe(401);
    expect(((await r.json()) as Json).error).toBe('sign_in_required');
    expect(calls).toHaveLength(0);
  });
  it('an account without an email (or a deleted one) is not signed in', async () => {
    const a = polarApp();
    stub();
    const x = await account(a);
    await makeAccountFor(x.walletId, { email: null });
    expect((await checkout(a, x, { product_id: 'prod_160' })).status).toBe(401);
    const y = await account(a);
    await makeAccountFor(y.walletId, { deleted: true });
    expect((await checkout(a, y, { product_id: 'prod_160' })).status).toBe(401);
  });
  it('creates a checkout with the wallet as customer, the account email, and a return address', async () => {
    const a = polarApp();
    const calls = stub();
    const acc = await account(a);
    await makeAccountFor(acc.walletId, { email: 'buyer@example.test' });
    const r = await checkout(a, acc, { product_id: 'prod_350' });
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ url: 'https://polar.test/checkout/abc', id: 'chk_1' });
    expect(calls[0]!.url).toBe('https://api.polar.sh/v1/checkouts/');
    expect(new Headers(calls[0]!.init.headers).get('Authorization')).toBe('Bearer polar-token');
    const sent = JSON.parse(String(calls[0]!.init.body));
    expect(sent).toMatchObject({ products: ['prod_350'], external_customer_id: acc.walletId, customer_email: 'buyer@example.test', metadata: { wallet_id: acc.walletId, credits: '350' } });
    expect(sent.success_url).toContain('{CHECKOUT_ID}');
    expect(sent.success_url.startsWith(a.env.WEB_ORIGIN)).toBe(true);
  });
  it('uses the sandbox when config says so, with no code change', async () => {
    const a = polarApp();
    await setConfig('polar_api_base', 'https://sandbox-api.polar.sh/v1');
    const calls = stub();
    const acc = await account(a);
    await makeAccountFor(acc.walletId);
    await checkout(a, acc, { product_id: 'prod_160' });
    expect(calls[0]!.url).toBe('https://sandbox-api.polar.sh/v1/checkouts/');
    await setConfig('polar_api_base', 'https://api.polar.sh/v1');
  });
  it('refuses a pack that is not in the web list, limits to 20 an hour, and reports a Polar outage as busy', async () => {
    const a = polarApp();
    stub();
    const acc = await account(a);
    await makeAccountFor(acc.walletId);
    expect((await checkout(a, acc, { product_id: 'credits_25' })).status).toBe(400);
    expect((await checkout(a, acc, {})).status).toBe(400);
    stub(() => new Response('down', { status: 500 }));
    const down = await checkout(a, acc, { product_id: 'prod_160' });
    expect(down.status).toBe(503);
    expect(((await down.json()) as Json).error).toBe('busy');
    stub();
    let last = 200;
    for (let i = 0; i < 20; i++) last = (await checkout(a, acc, { product_id: 'prod_160' })).status;
    expect(last).toBe(429);
    expect((await a.call('/v1/checkout/polar', { method: 'POST', body: '{}' })).status).toBe(401);
  });
});

describe('POST /v1/hooks/polar', () => {
  const order = (walletId: string, o: Record<string, unknown> = {}, type = 'order.paid') => ({ type, data: { id: 'ord_' + uid(), status: 'paid', product_id: 'prod_160', metadata: { wallet_id: walletId, credits: '999999' }, ...o } });
  const send = async (a: App, ev: unknown, sign: Parameters<typeof signHook>[1] = {}, raw?: string) => {
    const body = raw ?? JSON.stringify(ev);
    return a.call('/v1/hooks/polar', { method: 'POST', headers: await signHook(body, sign), body });
  };

  it('credits the wallet once per order, with credits from config and not from the payload', async () => {
    const a = polarApp();
    const w = await newWallet();
    const ev = order(w);
    const before = await counter('r7:first_buyers');
    const r = await send(a, ev);
    expect(r.status).toBe(200);
    expect(((await r.json()) as Json).status).toBe('credited');
    expect(await balanceOf(w)).toBe(160);
    expect((await walletRow(w)).ever_purchased).toBe(1);
    expect(await counter('r7:first_buyers')).toBe(before + 1);
    await expectConsistent(w);
  });
  it('the same order delivered ten times at once is credited once', async () => {
    const a = polarApp();
    const w = await newWallet();
    const ev = order(w);
    const res = await Promise.all(Array.from({ length: 10 }, () => send(a, ev)));
    expect(res.every((r) => r.status === 200)).toBe(true);
    const statuses = (await Promise.all(res.map((r) => r.json()))).map((j) => (j as Json).status);
    expect(statuses.filter((s) => s === 'credited')).toHaveLength(1);
    expect(statuses.filter((s) => s === 'already_credited')).toHaveLength(9);
    expect(await balanceOf(w)).toBe(160);
  });
  it('refuses unsigned, wrongly signed, replayed and malformed requests, crediting nothing', async () => {
    const a = polarApp();
    const w = await newWallet();
    const ev = order(w);
    expect((await a.call('/v1/hooks/polar', { method: 'POST', body: JSON.stringify(ev) })).status).toBe(401);
    expect((await send(a, ev, { secret: 'whsec_wrong' })).status).toBe(401);
    expect((await send(a, ev, { ts: Math.floor(Date.now() / 1000) - 3600 })).status).toBe(401);
    expect((await send(a, null, {}, '{not json')).status).toBe(400);
    expect(await balanceOf(w)).toBe(0);
  });
  it('answers 200 and credits nothing for an unknown product, an unknown event, or an order with no id', async () => {
    const a = polarApp();
    const w = await newWallet();
    expect(((await (await send(a, order(w, { product_id: 'prod_unknown' }))).json()) as Json).ignored).toBe('unknown_product_or_wallet');
    expect(((await (await send(a, { type: 'checkout.updated', data: { id: 'x' } })).json()) as Json).ignored).toBe('event');
    expect(((await (await send(a, { type: 'order.paid', data: {} })).json()) as Json).ignored).toBe('no_order');
    expect(await balanceOf(w)).toBe(0);
  });
  it('a wallet that no longer exists is recorded for the operator, not retried forever', async () => {
    const a = polarApp();
    const ev = order('w-vanished');
    const r = await send(a, ev);
    expect(r.status).toBe(200);
    expect(((await r.json()) as Json).ignored).toBe('wallet_unavailable');
    const row = await db.prepare("SELECT ref FROM reports WHERE kind = 'polar_orphan' AND ref = ?").bind((ev.data as Json).id).first();
    expect(row).toBeTruthy();
  });

  describe('refunds', () => {
    it('a refund removes the credits once; a repeat or a partial refund event changes nothing more', async () => {
      const a = polarApp();
      const w = await newWallet();
      const paid = order(w);
      await send(a, paid);
      const refunded = { type: 'order.updated', data: { ...(paid.data as Json), status: 'refunded' } };
      expect(((await (await send(a, refunded)).json()) as Json).status).toBe('voided');
      expect(await balanceOf(w)).toBe(0);
      expect(((await (await send(a, refunded)).json()) as Json).status).toBe('nothing_to_void');
      const w2 = await newWallet();
      const p2 = order(w2);
      await send(a, p2);
      await send(a, { type: 'order.updated', data: { ...(p2.data as Json), status: 'partially_refunded' } });
      expect(await balanceOf(w2)).toBe(0);
    });
    it('an order.updated that is not a refund is ignored', async () => {
      const a = polarApp();
      const w = await newWallet();
      const paid = order(w);
      await send(a, paid);
      expect(((await (await send(a, { type: 'order.updated', data: { ...(paid.data as Json), status: 'paid' } })).json()) as Json).ignored).toBe('not_a_refund');
      expect(await balanceOf(w)).toBe(160);
    });
    it('credits already spent become debt, which a new purchase repays first', async () => {
      const a = polarApp();
      const w = await newWallet();
      const paid = order(w);
      await send(a, paid);
      await reserve(db, { key: 'spend-' + uid(), walletId: w, action: 'picture', cost: 100 });
      await send(a, { type: 'order.updated', data: { ...(paid.data as Json), status: 'refunded' } });
      expect(await walletRow(w)).toMatchObject({ balance: 0, owed: 100 });
      await send(a, order(w, { product_id: 'prod_350' }));
      expect(await walletRow(w)).toMatchObject({ balance: 250, owed: 0 });
      await expectConsistent(w);
    });
  });

  describe('referrals through the webhook', () => {
    it('the referred buyer gets 10% at once, and a refund inside the hold takes it back', async () => {
      const a = polarApp();
      const referrerWallet = await newWallet();
      const referrer = await makeAccountFor(referrerWallet);
      const buyerWallet = await newWallet();
      await makeAccountFor(buyerWallet, { referredBy: referrer });
      const paid = order(buyerWallet);
      const r = (await (await send(a, paid)).json()) as Json;
      expect(r.referral).toBe('granted');
      expect(await balanceOf(buyerWallet)).toBe(160 + 16);
      expect((await db.prepare('SELECT state, referred_bonus FROM referrals').first<Json>())).toMatchObject({ state: 'pending', referred_bonus: 16 });
      await send(a, { type: 'order.updated', data: { ...(paid.data as Json), status: 'refunded' } });
      expect(await balanceOf(buyerWallet)).toBe(0);
      expect((await db.prepare("SELECT state FROM referrals WHERE referred_account = (SELECT id FROM accounts WHERE wallet_id = ?)").bind(buyerWallet).first<Json>())!.state).toBe('void');
      await expectConsistent(buyerWallet);
    });
    it('a buyer with no referrer gets no bonus', async () => {
      const a = polarApp();
      const w = await newWallet();
      await makeAccountFor(w);
      expect(((await (await send(a, order(w))).json()) as Json).referral).toBe('not_eligible');
      expect(await balanceOf(w)).toBe(160);
    });
  });
});
