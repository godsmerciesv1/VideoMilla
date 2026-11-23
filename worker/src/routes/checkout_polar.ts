import type { Env } from '../env';
import type { Auth } from '../lib/auth';
import { HttpError, json, readJson } from '../lib/http';
import { createCheckout, polarPacks } from '../lib/polar';
import { ProviderError } from '../lib/provider_router';
import { hit } from '../lib/rate_limit';
import { cfg } from './config';

/**
 * `POST /v1/checkout/polar` (blueprint F103): start a web purchase. Web only. It needs a signed-in account (the
 * account's email pre-fills the checkout page, and the wallet is the customer id), purchases switched on in
 * config (they stay off until the sign-in gate G16 passes), and a pack from the config list.
 */
export async function handlePolarCheckout(req: Request, env: Env, auth: Auth): Promise<Response> {
  const flags = (await cfg<Record<string, unknown>>(env.DB, 'flags')) ?? {};
  if (flags.purchases_enabled !== true) throw new HttpError(403, 'purchases_disabled');
  if (!(await hit(env.DB, `checkout:${auth.walletId}`, 20, 3600)).allowed) throw new HttpError(429, 'rate_limited');

  const body = await readJson<{ product_id?: unknown }>(req, 1024);
  const pack = (await polarPacks(env.DB)).find((p) => p.productId === body.product_id);
  if (!pack) throw new HttpError(400, 'invalid_pack');

  const account = await env.DB.prepare('SELECT email FROM accounts WHERE wallet_id = ? AND deleted = 0 AND email IS NOT NULL').bind(auth.walletId).first<{ email: string }>();
  if (!account) throw new HttpError(401, 'sign_in_required');

  try {
    const c = await createCheckout(env, {
      productId: pack.productId,
      walletId: auth.walletId,
      customerEmail: account.email,
      credits: pack.credits,
      successUrl: `${env.WEB_ORIGIN}/#/wallet?checkout={CHECKOUT_ID}`,
    });
    return json({ url: c.url, id: c.id });
  } catch (e) {
    if (e instanceof ProviderError) throw new HttpError(503, 'busy');
    throw e;
  }
}
