import { env } from 'cloudflare:workers';
import { beforeEach, describe, expect, it } from 'vitest';
import worker from '../src/index';
import { randomBase64Url, randomCode, sha256Hex, timingSafeEqual } from '../src/lib/crypto';
import { HttpError, belowMin, readJson } from '../src/lib/http';
import { hit } from '../src/lib/rate_limit';
import { clearConfigCache } from '../src/routes/config';

type Json = Record<string, any>;

async function call(path: string, init: RequestInit = {}): Promise<Response> {
  return worker.fetch(new Request('https://api.test' + path, init), env);
}

async function newSession(platform: string = 'android', ip = '203.0.113.7'): Promise<{ res: Response; body: Json }> {
  const res = await call('/v1/session', {
    method: 'POST',
    headers: { 'CF-Connecting-IP': ip, 'Content-Type': 'application/json' },
    body: JSON.stringify({ platform }),
  });
  return { res, body: (await res.json()) as Json };
}

function deviceAuth(s: Json): HeadersInit {
  return { Authorization: `Device ${s.deviceId}.${s.secret}` };
}

beforeEach(async () => {
  clearConfigCache();
  await env.DB.prepare("UPDATE config SET value = '\"0.0.0\"' WHERE key = 'min_app_version'").run();
  await env.DB.prepare('DELETE FROM counters').run();
});

describe('crypto helpers', () => {
  it('hashes to 64 hex characters, the same every time', async () => {
    const a = await sha256Hex('abc');
    expect(a).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
    expect(await sha256Hex('abc')).toBe(a);
  });
  it('compares in constant time and rejects different lengths', () => {
    expect(timingSafeEqual('abcd', 'abcd')).toBe(true);
    expect(timingSafeEqual('abcd', 'abce')).toBe(false);
    expect(timingSafeEqual('abc', 'abcd')).toBe(false);
  });
  it('makes URL-safe random strings of the expected length', () => {
    expect(randomBase64Url(16)).toMatch(/^[A-Za-z0-9_-]{22}$/);
    expect(randomBase64Url(32)).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });
  it('codes use only look-alike-free symbols', () => {
    for (let i = 0; i < 50; i++) expect(randomCode(8)).toMatch(/^[A-HJ-NP-Z2-9]{8}$/);
  });
});

describe('session and authentication', () => {
  it('registers a device and returns a working credential', async () => {
    const { res, body } = await newSession('android');
    expect(res.status).toBe(201);
    expect(body.deviceId).toHaveLength(22);
    expect(body.secret).toHaveLength(43);
    expect(body.balance).toBe(0);
    expect(body.configVersion).toBe(1);

    const bal = await call('/v1/balance', { headers: deviceAuth(body) });
    expect(bal.status).toBe(200);
    const w = (await bal.json()) as Json;
    expect(w.balance).toBe(0);
    expect(w.owed).toBe(0);
    expect(w.ever_purchased).toBe(false);
    expect(w.support_id).toMatch(/^[A-HJ-NP-Z2-9]{8}$/);
  });

  it('stores only a keyed hash, never the secret', async () => {
    const { body } = await newSession('web');
    const row = await env.DB.prepare('SELECT secret_hash AS h, platform FROM devices WHERE id = ?').bind(body.deviceId).first<{ h: string; platform: string }>();
    expect(row!.platform).toBe('web');
    expect(row!.h).toBe(await sha256Hex(body.secret + env.PEPPER));
    expect(row!.h).not.toContain(body.secret);
  });

  it('refuses an invalid platform and a missing body', async () => {
    expect((await newSession('desktop')).res.status).toBe(400);
    const empty = await call('/v1/session', { method: 'POST' });
    expect(empty.status).toBe(400);
  });

  it('refuses a missing, malformed or wrong credential', async () => {
    const { body } = await newSession();
    expect((await call('/v1/balance')).status).toBe(401);
    expect((await call('/v1/balance', { headers: { Authorization: 'Bearer x' } })).status).toBe(401);
    expect((await call('/v1/balance', { headers: { Authorization: `Device ${body.deviceId}.${randomBase64Url(32)}` } })).status).toBe(401);
    expect((await call('/v1/balance', { headers: { Authorization: `Device ${randomBase64Url(16)}.${body.secret}` } })).status).toBe(401);
    expect((await call('/v1/balance', { headers: { Authorization: 'Device short.short' } })).status).toBe(401);
  });

  it('refuses a revoked device and a deleted wallet', async () => {
    const a = (await newSession()).body;
    await env.DB.prepare('UPDATE devices SET revoked = 1 WHERE id = ?').bind(a.deviceId).run();
    expect((await call('/v1/balance', { headers: deviceAuth(a) })).status).toBe(401);

    const b = (await newSession()).body;
    await env.DB.prepare('UPDATE wallets SET deleted = 1 WHERE id = (SELECT wallet_id FROM devices WHERE id = ?)').bind(b.deviceId).run();
    expect((await call('/v1/balance', { headers: deviceAuth(b) })).status).toBe(401);
  });

  it('gives every device its own wallet and its own support id', async () => {
    const a = (await newSession()).body;
    const b = (await newSession()).body;
    const wa = (await (await call('/v1/balance', { headers: deviceAuth(a) })).json()) as Json;
    const wb = (await (await call('/v1/balance', { headers: deviceAuth(b) })).json()) as Json;
    expect(wa.support_id).not.toBe(wb.support_id);
  });

  it('limits sessions per network address', async () => {
    let last = 201;
    for (let i = 0; i < 101; i++) last = (await newSession('android', '198.51.100.9')).res.status;
    expect(last).toBe(429);
    expect((await newSession('android', '198.51.100.10')).res.status).toBe(201);
  });

  it('updates last_seen at most once an hour', async () => {
    const { body } = await newSession();
    await env.DB.prepare('UPDATE devices SET last_seen = 1000 WHERE id = ?').bind(body.deviceId).run();
    await call('/v1/balance', { headers: deviceAuth(body) });
    const first = (await env.DB.prepare('SELECT last_seen AS t FROM devices WHERE id = ?').bind(body.deviceId).first<{ t: number }>())!.t;
    expect(first).toBeGreaterThan(1000);
    await call('/v1/balance', { headers: deviceAuth(body) });
    const second = (await env.DB.prepare('SELECT last_seen AS t FROM devices WHERE id = ?').bind(body.deviceId).first<{ t: number }>())!.t;
    expect(second).toBe(first);
  });
});

describe('config', () => {
  it('serves the client keys and hides the server-only ones', async () => {
    const { body } = await newSession();
    const res = await call('/v1/config', { headers: deviceAuth(body) });
    expect(res.status).toBe(200);
    const c = (await res.json()) as Json;
    expect(c.version).toBe(1);
    expect(c.credit_costs.clip_per_second).toBe(2);
    expect(c.credit_costs.analysis_free_per_project).toBe(3);
    expect(c.packs_play).toHaveLength(5);
    expect(c.packs_play[0].product_id).toBe('com.zdmgold.videomilla.credits_25');
    expect(c.packs_polar).toEqual([]);
    expect(c.languages_enabled).toEqual(['en']);
    expect(c.flags.cartoon_me_enabled).toBe(false);
    expect(c.fair_use.pictures_per_day).toBe(200);
    expect(c.models).toBeUndefined();
    expect(c.clip_routes).toBeUndefined();
    expect(c.language_models).toBeUndefined();
  });

  it('needs a credential', async () => {
    expect((await call('/v1/config')).status).toBe(401);
  });
});

describe('minimum app version', () => {
  it('turns away an old app with 426 and lets a current one through', async () => {
    const { body } = await newSession();
    await env.DB.prepare("UPDATE config SET value = '\"2.0.0\"' WHERE key = 'min_app_version'").run();
    clearConfigCache();
    expect((await call('/v1/balance', { headers: { ...deviceAuth(body), 'X-App-Version': '1.9.9' } })).status).toBe(426);
    expect((await call('/v1/balance', { headers: { ...deviceAuth(body), 'X-App-Version': '2.0.0' } })).status).toBe(200);
    expect((await call('/v1/balance', { headers: { ...deviceAuth(body), 'X-App-Version': '10.0.0' } })).status).toBe(200);
  });

  it('compares versions numerically', () => {
    expect(belowMin('1.9.0', '1.10.0')).toBe(true);
    expect(belowMin('1.10.0', '1.9.0')).toBe(false);
    expect(belowMin('2.0.0', '2.0.0')).toBe(false);
    expect(belowMin(null, '2.0.0')).toBe(false);
  });
});

describe('CORS', () => {
  it('allows the web app origin and nothing else', async () => {
    const ok = await call('/v1/config', { method: 'OPTIONS', headers: { Origin: env.WEB_ORIGIN } });
    expect(ok.status).toBe(204);
    expect(ok.headers.get('Access-Control-Allow-Origin')).toBe(env.WEB_ORIGIN);
    expect(ok.headers.get('Access-Control-Allow-Headers')).toContain('X-Idempotency-Key');
    const bad = await call('/v1/config', { method: 'OPTIONS', headers: { Origin: 'https://evil.example' } });
    expect(bad.status).toBe(403);
    expect(bad.headers.get('Access-Control-Allow-Origin')).toBeNull();
  });

  it('adds CORS headers and a request id to answers', async () => {
    const res = await call('/v1/session', {
      method: 'POST',
      headers: { Origin: env.WEB_ORIGIN, 'CF-Connecting-IP': '203.0.113.50' },
      body: JSON.stringify({ platform: 'web' }),
    });
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe(env.WEB_ORIGIN);
    expect(res.headers.get('X-Request-Id')).toBeTruthy();
    const foreign = await call('/v1/config', { headers: { Origin: 'https://evil.example' } });
    expect(foreign.headers.get('Access-Control-Allow-Origin')).toBeNull();
  });
});

describe('request reading and errors', () => {
  it('refuses oversized and malformed bodies', async () => {
    const big = new Request('https://api.test/x', { method: 'POST', body: 'x'.repeat(2000) });
    await expect(readJson(big, 100)).rejects.toMatchObject({ status: 413 });
    const bad = new Request('https://api.test/x', { method: 'POST', body: '{nope' });
    await expect(readJson(bad, 100)).rejects.toMatchObject({ status: 400, code: 'invalid_json' });
    const empty = new Request('https://api.test/x', { method: 'POST' });
    await expect(readJson(empty, 100)).rejects.toBeInstanceOf(HttpError);
  });

  it('answers 404 JSON for an unknown route and never leaks details', async () => {
    const { body } = await newSession();
    const res = await call('/v1/nope', { headers: deviceAuth(body) });
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'not_found' });
  });
});

describe('rate limiter', () => {
  it('allows exactly `limit` calls per window', async () => {
    const results: boolean[] = [];
    for (let i = 0; i < 7; i++) results.push((await hit(env.DB, 'rl:a', 5, 3600)).allowed);
    expect(results).toEqual([true, true, true, true, true, false, false]);
  });

  it('keeps keys independent', async () => {
    for (let i = 0; i < 6; i++) await hit(env.DB, 'rl:b', 5, 3600);
    expect((await hit(env.DB, 'rl:c', 5, 3600)).allowed).toBe(true);
  });

  it('starts a new window when the old one ends', async () => {
    await hit(env.DB, 'rl:d', 1, 1);
    expect((await hit(env.DB, 'rl:d', 1, 1)).allowed).toBe(false);
    await new Promise((r) => setTimeout(r, 2100));
    expect((await hit(env.DB, 'rl:d', 1, 1)).allowed).toBe(true);
  });

  it('is exact under 30 simultaneous calls', async () => {
    const all = await Promise.all(Array.from({ length: 30 }, () => hit(env.DB, 'rl:e', 10, 3600)));
    expect(all.filter((r) => r.allowed).length).toBe(10);
  });
});
