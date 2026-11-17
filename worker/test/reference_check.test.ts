import { env } from 'cloudflare:workers';
import { describe, expect, it } from 'vitest';
import type { Env } from '../src/env';
import { aiText, firstJsonObject } from '../src/lib/ai_text';
import worker from '../src/index';

type Json = Record<string, any>;
type Run = (model: string, input: any) => Promise<unknown>;

function app(run: Run): { call: (path: string, init?: RequestInit) => Promise<Response>; models: string[]; inputs: any[] } {
  const models: string[] = [];
  const inputs: any[] = [];
  const AI = { run: async (m: string, i: any) => { models.push(m); inputs.push(i); return run(m, i); } };
  const e = { ...(env as unknown as Env), AI: AI as unknown as Ai };
  return { call: (path, init = {}) => worker.fetch(new Request('https://api.test' + path, init), e), models, inputs };
}

const jpeg = (): string => btoa(String.fromCharCode(0xff, 0xd8, 0xff, 0xe0, ...Array.from({ length: 64 }, (_, i) => i)));
const verdict = (face: boolean, explicit = false) => ({ choices: [{ message: { content: JSON.stringify({ face, explicit }) } }] });

async function login(a: ReturnType<typeof app>, ip: string): Promise<HeadersInit> {
  const s = (await (await a.call('/v1/session', { method: 'POST', headers: { 'CF-Connecting-IP': ip }, body: JSON.stringify({ platform: 'android' }) })).json()) as Json;
  return { Authorization: `Device ${s.deviceId}.${s.secret}`, 'Content-Type': 'application/json' };
}
const check = (a: ReturnType<typeof app>, h: HeadersInit, body: unknown) => a.call('/v1/reference/check', { method: 'POST', headers: h, body: JSON.stringify(body) });

describe('POST /v1/reference/check', () => {
  it('accepts a picture with no photographic face', async () => {
    const a = app(async () => verdict(false));
    const r = await check(a, await login(a, '198.51.100.1'), { image: jpeg() });
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ ok: true, face: false, reason: null });
  });

  it('rejects a face, and explicit content', async () => {
    const a = app(async () => verdict(true));
    expect(await (await check(a, await login(a, '198.51.100.2'), { image: jpeg() })).json()).toEqual({ ok: false, face: true, reason: 'face' });
    const b = app(async () => verdict(false, true));
    expect(await (await check(b, await login(b, '198.51.100.3'), { image: jpeg() })).json()).toEqual({ ok: false, face: false, reason: 'explicit' });
  });

  it('asks Gemma 4 first with reasoning off, and tells it that cartoons are not faces', async () => {
    const a = app(async () => verdict(false));
    await check(a, await login(a, '198.51.100.4'), { image: jpeg() });
    expect(a.models).toEqual(['@cf/google/gemma-4-26b-a4b-it']);
    expect(a.inputs[0].chat_template_kwargs).toEqual({ enable_thinking: false });
    expect(a.inputs[0].messages[0].content[0].text).toContain('Cartoons, drawings');
    expect(a.inputs[0].messages[0].content[1].image_url.url).toMatch(/^data:image\/jpeg;base64,/);
  });

  it('falls back to Scout (without the Gemma-only setting) when Gemma errors or answers unreadably', async () => {
    const a = app(async (m) => { if (m.includes('gemma')) throw new Error('capacity'); return verdict(false); });
    const h = await login(a, '198.51.100.5');
    expect(await (await check(a, h, { image: jpeg() })).json()).toMatchObject({ ok: true });
    expect(a.models).toEqual(['@cf/google/gemma-4-26b-a4b-it', '@cf/meta/llama-4-scout-17b-16e-instruct']);
    expect(a.inputs[1].chat_template_kwargs).toBeUndefined();

    const b = app(async (m) => (m.includes('gemma') ? { choices: [{ message: { content: 'I cannot tell' } }] } : verdict(true)));
    expect(await (await check(b, await login(b, '198.51.100.6'), { image: jpeg() })).json()).toMatchObject({ ok: false, reason: 'face' });
  });

  it('fails closed: no model gives a readable answer, so the picture is not accepted', async () => {
    const a = app(async () => { throw new Error('down'); });
    const r = await check(a, await login(a, '198.51.100.7'), { image: jpeg() });
    expect(r.status).toBe(503);
    const b = app(async () => ({ choices: [{ message: { content: '' } }] }));
    expect((await check(b, await login(b, '198.51.100.8'), { image: jpeg() })).status).toBe(503);
  });

  it('refuses bad input before any model is called', async () => {
    const a = app(async () => verdict(false));
    const h = await login(a, '198.51.100.9');
    expect((await check(a, h, {})).status).toBe(400);
    expect((await check(a, h, { image: 'short' })).status).toBe(400);
    expect((await check(a, h, { image: btoa('this is plain text, not a picture at all') })).status).toBe(400);
    expect((await check(a, h, { image: jpeg(), mode: 'self' })).status).toBe(400);
    expect((await a.call('/v1/reference/check', { method: 'POST', body: '{}' })).status).toBe(401);
    expect(a.models).toHaveLength(0);
  });

  it('accepts a PNG', async () => {
    const a = app(async () => verdict(false));
    const png = btoa(String.fromCharCode(0x89, 0x50, 0x4e, 0x47, ...Array.from({ length: 64 }, (_, i) => i)));
    const r = await check(a, await login(a, '198.51.100.10'), { image: png });
    expect(r.status).toBe(200);
    expect(a.inputs[0].messages[0].content[1].image_url.url).toMatch(/^data:image\/png;/);
  });

  it('limits a wallet to 120 checks an hour', async () => {
    const a = app(async () => verdict(false));
    const h = await login(a, '198.51.100.11');
    let last = 200;
    for (let i = 0; i < 121; i++) last = (await check(a, h, { image: jpeg() })).status;
    expect(last).toBe(429);
  });
});

describe('reading AI answers', () => {
  it('reads chat and legacy shapes', () => {
    expect(aiText({ choices: [{ message: { content: 'hi' } }] })).toBe('hi');
    expect(aiText({ response: 'legacy' })).toBe('legacy');
    expect(aiText({ response: { safe: true } })).toBe('{"safe":true}');
    expect(aiText(null)).toBe('');
    expect(aiText({ choices: [{ message: { content: '' } }] })).toBe('');
  });
  it('finds the first parseable JSON object inside prose, skipping broken ones', () => {
    expect(firstJsonObject('Sure! {"face": false, "explicit": false} done')).toEqual({ face: false, explicit: false });
    expect(firstJsonObject('{not json} then {"a":{"b":1}}')).toEqual({ a: { b: 1 } });
    expect(firstJsonObject('no json here')).toBeNull();
    expect(firstJsonObject('[1,2,3]')).toBeNull();
  });
});
