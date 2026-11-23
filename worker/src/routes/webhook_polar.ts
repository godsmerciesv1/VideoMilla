import type { Env } from '../env';
import { randomBase64Url } from '../lib/crypto';
import { HttpError, json } from '../lib/http';
import { creditPurchase, voidPurchase } from '../lib/ledger';
import { polarPacks, verifySignature } from '../lib/polar';
import { grantReferral, voidReferral } from '../lib/referrals';
import { hashValue } from '../lib/tokens';

const MAX_BODY = 200_000;

interface PolarEvent {
  type?: unknown;
  data?: {
    id?: unknown;
    status?: unknown;
    product_id?: unknown;
    product?: { id?: unknown };
    metadata?: Record<string, unknown>;
    customer?: { external_id?: unknown };
  };
}

const text = (v: unknown): string => (typeof v === 'string' ? v : '');

/**
 * `POST /v1/hooks/polar` (blueprint F104). No device credential: the signature IS the authentication, and it is
 * checked on the raw body before anything else runs.
 *  - `order.paid` credits the wallet once per order (the reference is a keyed hash of the order id), then runs the referral.
 *  - `order.updated` with a refund (refunded or partially refunded) voids that purchase and, inside the hold, its referral.
 *  - Credits come from the config pack list by product, never from the payload. Unknown events, products and
 *    deleted wallets are answered 200 so Polar stops retrying; an orphaned payment is recorded for the operator.
 */
export async function handlePolarWebhook(req: Request, env: Env): Promise<Response> {
  if (Number(req.headers.get('content-length') ?? 0) > MAX_BODY) throw new HttpError(413, 'too_large');
  const raw = await req.text();
  if (raw.length > MAX_BODY) throw new HttpError(413, 'too_large');
  if (!(await verifySignature(env, req.headers, raw))) throw new HttpError(401, 'invalid_signature');

  let event: PolarEvent;
  try {
    event = JSON.parse(raw) as PolarEvent;
  } catch {
    throw new HttpError(400, 'invalid_json');
  }
  const d = event.data;
  const orderId = text(d?.id);
  if (!orderId) return json({ ok: true, ignored: 'no_order' });
  const refHash = await hashValue(`polar:${orderId}`, env.PEPPER);

  if (event.type === 'order.paid') {
    const productId = text(d?.product_id) || text(d?.product?.id);
    const pack = (await polarPacks(env.DB)).find((p) => p.productId === productId);
    const walletId = text(d?.metadata?.wallet_id) || text(d?.customer?.external_id);
    if (!pack || !walletId) return json({ ok: true, ignored: 'unknown_product_or_wallet' });

    const outcome = await creditPurchase(env.DB, { refHash, walletId, channel: 'polar', credits: pack.credits, productId, orderId });
    if (outcome === 'duplicate') return json({ ok: true, status: 'already_credited' });
    if (outcome !== 'ok') {
      // The wallet is gone but money was taken: keep a visible record for the operator, and stop Polar retrying.
      await env.DB.prepare("INSERT INTO reports(id, wallet_id, kind, ref) VALUES(?, ?, 'polar_orphan', ?)").bind(randomBase64Url(12), walletId, orderId).run();
      return json({ ok: true, ignored: 'wallet_unavailable' });
    }
    const referral = await grantReferral(env.DB, { walletId, purchaseRef: refHash, packCredits: pack.credits });
    return json({ ok: true, status: 'credited', referral });
  }

  if (event.type === 'order.updated') {
    const status = text(d?.status);
    if (status !== 'refunded' && status !== 'partially_refunded') return json({ ok: true, ignored: 'not_a_refund' });
    const voided = await voidPurchase(env.DB, refHash);
    if (voided) await voidReferral(env.DB, refHash);
    return json({ ok: true, status: voided ? 'voided' : 'nothing_to_void' });
  }

  return json({ ok: true, ignored: 'event' });
}
