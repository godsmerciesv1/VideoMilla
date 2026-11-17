// Minimal Cloudflare Workers AI REST helper for the gate scripts. Never prints the token.
import { mkdirSync, writeFileSync } from 'node:fs';

const TOKEN = process.env.CLOUDFLARE_API_TOKEN ?? '';
const ACCOUNT = process.env.CLOUDFLARE_ACCOUNT_ID ?? '';
if (!TOKEN || !ACCOUNT) throw new Error('missing Cloudflare credentials in the environment');

export const OUT = 'gates/out';
mkdirSync(OUT, { recursive: true });
export const save = (name: string, data: string | Uint8Array): void => writeFileSync(`${OUT}/${name}`, data);

const base = `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT}/ai`;

/** The daily neuron allowance is used up. Only this stops a run. */
export class QuotaError extends Error {}
/** A transient 429 / 5xx ("capacity temporarily exceeded"): retry with a pause, never treated as the daily quota. */
export class TransientError extends Error {}

async function call(url: string, init: RequestInit): Promise<any> {
  const res = await fetch(url, { ...init, headers: { Authorization: `Bearer ${TOKEN}`, ...(init.headers ?? {}) } });
  const text = await res.text();
  let body: any;
  try { body = JSON.parse(text); } catch { body = { raw: text.slice(0, 500) }; }
  if (!res.ok) {
    const msg = JSON.stringify(body.errors ?? body).slice(0, 500);
    if (/capacity|temporarily|try again|overloaded/i.test(msg) || res.status >= 500) throw new TransientError(`HTTP ${res.status}: ${msg}`);
    if (/neuron|daily|allocation|quota|free tier/i.test(msg)) throw new QuotaError(`HTTP ${res.status}: ${msg}`);
    if (res.status === 429) throw new TransientError(`HTTP ${res.status}: ${msg}`);
    throw new Error(`HTTP ${res.status}: ${msg}`);
  }
  return body;
}

/** Runs a model with a JSON body. Returns the `result` field. */
export async function runJson(model: string, input: unknown): Promise<any> {
  const b = await call(`${base}/run/${model}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) });
  return b.result;
}

/** Runs a model with a multipart body (the FLUX.2 klein shape). */
export async function runForm(model: string, fields: Record<string, string>): Promise<any> {
  const form = new FormData();
  for (const [k, v] of Object.entries(fields)) form.append(k, v);
  const b = await call(`${base}/run/${model}`, { method: 'POST', body: form });
  return b.result;
}

export async function schema(model: string): Promise<any> {
  const b = await call(`${base}/models/schema?model=${encodeURIComponent(model)}`, { method: 'GET' });
  return b.result;
}
