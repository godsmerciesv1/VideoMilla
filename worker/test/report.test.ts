import { env } from 'cloudflare:workers';
import { describe, expect, it } from 'vitest';
import worker from '../src/index';

type Json = Record<string, any>;
const call = (path: string, init: RequestInit = {}) => worker.fetch(new Request('https://api.test' + path, init), env);

async function session(ip: string): Promise<Json> {
  const res = await call('/v1/session', { method: 'POST', headers: { 'CF-Connecting-IP': ip }, body: JSON.stringify({ platform: 'android' }) });
  return (await res.json()) as Json;
}
const auth = (s: Json): HeadersInit => ({ Authorization: `Device ${s.deviceId}.${s.secret}`, 'Content-Type': 'application/json' });

describe('POST /v1/report', () => {
  it('stores a report for the wallet', async () => {
    const s = await session('203.0.113.80');
    const res = await call('/v1/report', { method: 'POST', headers: auth(s), body: JSON.stringify({ kind: 'picture', ref: 'shot-42' }) });
    expect(res.status).toBe(201);
    const row = await env.DB.prepare("SELECT kind, ref, handled FROM reports WHERE ref = 'shot-42'").first<{ kind: string; ref: string; handled: number }>();
    expect(row).toEqual({ kind: 'picture', ref: 'shot-42', handled: 0 });
  });

  it('refuses an unknown kind, a missing credential and a missing body', async () => {
    const s = await session('203.0.113.81');
    expect((await call('/v1/report', { method: 'POST', headers: auth(s), body: JSON.stringify({ kind: 'spam' }) })).status).toBe(400);
    expect((await call('/v1/report', { method: 'POST', body: JSON.stringify({ kind: 'clip' }) })).status).toBe(401);
    expect((await call('/v1/report', { method: 'POST', headers: auth(s) })).status).toBe(400);
  });

  it('limits a wallet to 30 reports an hour', async () => {
    const s = await session('203.0.113.82');
    let last = 201;
    for (let i = 0; i < 31; i++) last = (await call('/v1/report', { method: 'POST', headers: auth(s), body: JSON.stringify({ kind: 'video', ref: `r${i}` }) })).status;
    expect(last).toBe(429);
  });
});
