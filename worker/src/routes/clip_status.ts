import type { Env } from '../env';
import type { Auth } from '../lib/auth';
import { HttpError, json, readJson } from '../lib/http';
import { isValidKey, markDelivered } from '../lib/idempotency';
import { clipRows, view } from './clip_submit';

/** `GET /v1/clip/status?keys=a,b`: where each of the wallet's clips stands. The app polls this every few seconds. */
export async function handleClipStatus(req: Request, env: Env, auth: Auth): Promise<Response> {
  const raw = new URL(req.url).searchParams.get('keys') ?? '';
  const keys = [...new Set(raw.split(',').filter((k) => isValidKey(k)))].slice(0, 15);
  if (keys.length === 0) throw new HttpError(400, 'invalid_keys');
  const rows = await clipRows(env.DB, auth.walletId, keys);
  return json({ clips: rows.map(view) });
}

/**
 * `POST /v1/ack` (blueprint 23.1): the app confirms it saved a result, which moves the request from
 * committed to delivered. Works for clips and pictures alike. Only the owning wallet can acknowledge.
 */
export async function handleAck(req: Request, env: Env, auth: Auth): Promise<Response> {
  const body = await readJson<{ key?: unknown }>(req, 1024);
  if (!isValidKey(body.key)) throw new HttpError(400, 'invalid_key');
  return json({ ok: true, delivered: await markDelivered(env.DB, body.key, auth.walletId) });
}
