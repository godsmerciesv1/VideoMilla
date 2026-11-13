import type { Env } from '../env';
import type { Auth } from '../lib/auth';
import { registerDevice } from '../lib/auth';
import { HttpError, clientIp, json, readJson } from '../lib/http';
import { hit } from '../lib/rate_limit';
import { cfg } from './config';

/** Sessions per network address per hour. Mobile networks share addresses, so this is generous. */
const SESSIONS_PER_HOUR = 100;

/** `POST /v1/session`: register a device, create its anonymous wallet, return its credential. */
export async function handleSession(req: Request, env: Env): Promise<Response> {
  const limited = await hit(env.DB, `session:${clientIp(req)}`, SESSIONS_PER_HOUR, 3600);
  if (!limited.allowed) throw new HttpError(429, 'rate_limited');

  const body = await readJson<{ platform?: unknown }>(req, 1024, true);
  if (body.platform !== 'android' && body.platform !== 'web') throw new HttpError(400, 'invalid_platform');

  const device = await registerDevice(env, body.platform);
  const configVersion = (await cfg<number>(env.DB, 'config_version')) ?? 0;
  return json({ deviceId: device.deviceId, secret: device.secret, balance: 0, configVersion }, 201);
}

/** `GET /v1/balance`: the wallet behind the calling device. */
export async function handleBalance(env: Env, auth: Auth): Promise<Response> {
  const w = await env.DB.prepare('SELECT balance, owed, ever_purchased, support_id FROM wallets WHERE id = ?')
    .bind(auth.walletId)
    .first<{ balance: number; owed: number; ever_purchased: number; support_id: string | null }>();
  if (!w) throw new HttpError(401, 'unauthorized');
  return json({ balance: w.balance, owed: w.owed, ever_purchased: w.ever_purchased === 1, support_id: w.support_id });
}
