import type { Env } from '../env';
import { timingSafeEqual } from './crypto';
import { ProviderError, providerFetch } from './provider_router';
import { cfg } from '../routes/config';

/**
 * Polar is the seller of record on the web (blueprint 23.8, F105). This is the only file that talks to it.
 * The request and the webhook scheme follow the blueprint's description; both are confirmed at gate G12 with a
 * test-mode event, and the API base is config (`polar_api_base`) so test mode (sandbox) needs no code change.
 */
export interface PolarPack {
  productId: string;
  credits: number;
}

/** The web packs from config. Credits always come from here, never from anything in a webhook payload. */
export async function polarPacks(db: D1Database): Promise<PolarPack[]> {
  const raw = await cfg<unknown>(db, 'packs_polar');
  if (!Array.isArray(raw)) return [];
  const out: PolarPack[] = [];
  for (const p of raw) {
    const o = p as Record<string, unknown> | null;
    if (o && typeof o.product_id === 'string' && typeof o.credits === 'number' && Number.isInteger(o.credits) && o.credits > 0) out.push({ productId: o.product_id, credits: o.credits });
  }
  return out;
}

export interface CheckoutInput {
  productId: string;
  walletId: string;
  customerEmail: string;
  credits: number;
  successUrl: string;
}

export async function createCheckout(env: Env, i: CheckoutInput): Promise<{ url: string; id: string }> {
  const base = (await cfg<string>(env.DB, 'polar_api_base')) ?? 'https://api.polar.sh/v1';
  const res = await providerFetch('polar', `${base}/checkouts/`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.POLAR_ACCESS_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      products: [i.productId],
      external_customer_id: i.walletId,
      customer_email: i.customerEmail,
      metadata: { wallet_id: i.walletId, credits: String(i.credits) },
      success_url: i.successUrl,
    }),
  });
  if (!res.ok) throw new ProviderError('polar', res.status, 'checkout_failed');
  const j = (await res.json().catch(() => null)) as { url?: unknown; id?: unknown } | null;
  if (typeof j?.url !== 'string' || typeof j?.id !== 'string') throw new ProviderError('polar', 502, 'bad_checkout_answer');
  return { url: j.url, id: j.id };
}

const enc = new TextEncoder();
const TOLERANCE_S = 300;

async function hmacB64(keyBytes: Uint8Array, data: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', keyBytes, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', key, enc.encode(data)));
  let s = '';
  for (const b of sig) s += String.fromCharCode(b);
  return btoa(s);
}

/**
 * Standard Webhooks: the signed text is `id.timestamp.body`, signed with HMAC-SHA-256 and sent as `v1,<base64>` (one
 * or several, space separated). Polar uses the secret's own bytes as the key; the other common convention
 * (the secret is base64) is accepted too. Both need the secret, so accepting two forms weakens nothing.
 * Which form Polar really uses is confirmed at G12. Timestamps more than 5 minutes off are refused (replay).
 */
export async function verifySignature(env: Env, headers: Headers, body: string, nowS: number = Math.floor(Date.now() / 1000)): Promise<boolean> {
  const id = headers.get('webhook-id');
  const ts = headers.get('webhook-timestamp');
  const header = headers.get('webhook-signature');
  if (!id || !ts || !header || !env.POLAR_WEBHOOK_SECRET) return false;
  const t = Number(ts);
  if (!Number.isFinite(t) || Math.abs(nowS - t) > TOLERANCE_S) return false;

  const keys: Uint8Array[] = [enc.encode(env.POLAR_WEBHOOK_SECRET)];
  try {
    const raw = env.POLAR_WEBHOOK_SECRET.replace(/^whsec_/, '');
    keys.push(Uint8Array.from(atob(raw), (c) => c.charCodeAt(0)));
  } catch {
    /* not base64: only the first form applies */
  }
  const signed = `${id}.${ts}.${body}`;
  const expected = await Promise.all(keys.map((k) => hmacB64(k, signed)));
  let ok = false;
  for (const part of header.split(' ')) {
    const [version, sig] = part.split(',');
    if (version !== 'v1' || !sig) continue;
    for (const e of expected) if (timingSafeEqual(e, sig)) ok = true; // no early exit: every candidate is compared
  }
  return ok;
}
