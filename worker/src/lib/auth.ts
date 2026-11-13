import type { Env } from '../env';
import { nowSeconds, randomBase64Url, randomCode, sha256Hex, timingSafeEqual } from './crypto';
import { HttpError } from './http';

export interface Auth {
  deviceId: string;
  walletId: string;
  platform: 'android' | 'web';
}

interface DeviceRow {
  id: string;
  wallet_id: string;
  platform: string;
  h: string;
  revoked: number;
  deleted: number;
}

/**
 * Reads `Authorization: Device <id>.<secret>`. The wallet is always taken from the device record,
 * never from anything the client controls. The secret is stored only as SHA-256(secret + PEPPER).
 */
export async function authenticate(req: Request, env: Env): Promise<Auth> {
  const header = req.headers.get('Authorization') ?? '';
  const space = header.indexOf(' ');
  const scheme = space < 0 ? header : header.slice(0, space);
  const cred = space < 0 ? '' : header.slice(space + 1);
  const dot = cred.indexOf('.');
  const id = dot < 0 ? '' : cred.slice(0, dot);
  const secret = dot < 0 ? '' : cred.slice(dot + 1);
  if (scheme !== 'Device' || id.length < 22 || secret.length < 43) throw new HttpError(401, 'unauthorized');

  const row = await env.DB.prepare(
    `SELECT d.id AS id, d.wallet_id AS wallet_id, d.platform AS platform, d.secret_hash AS h,
            d.revoked AS revoked, w.deleted AS deleted
       FROM devices d JOIN wallets w ON w.id = d.wallet_id WHERE d.id = ?`,
  )
    .bind(id)
    .first<DeviceRow>();
  // Always hash, so a wrong id and a wrong secret cost the same time.
  const supplied = await sha256Hex(secret + env.PEPPER);
  if (!row || row.revoked || row.deleted || !timingSafeEqual(supplied, row.h)) throw new HttpError(401, 'unauthorized');

  const now = nowSeconds();
  await env.DB.prepare('UPDATE devices SET last_seen = ?1 WHERE id = ?2 AND last_seen < ?1 - 3600').bind(now, row.id).run();
  return { deviceId: row.id, walletId: row.wallet_id, platform: row.platform === 'web' ? 'web' : 'android' };
}

export interface NewDevice {
  deviceId: string;
  secret: string;
  walletId: string;
  supportId: string;
}

/** Creates an anonymous wallet and its first device in one atomic batch. */
export async function registerDevice(env: Env, platform: 'android' | 'web'): Promise<NewDevice> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const walletId = randomBase64Url(16);
    const deviceId = randomBase64Url(16);
    const secret = randomBase64Url(32);
    const supportId = randomCode(8);
    const hash = await sha256Hex(secret + env.PEPPER);
    try {
      await env.DB.batch([
        env.DB.prepare('INSERT INTO wallets(id, support_id) VALUES(?, ?)').bind(walletId, supportId),
        env.DB.prepare('INSERT INTO devices(id, wallet_id, secret_hash, platform) VALUES(?, ?, ?, ?)').bind(
          deviceId,
          walletId,
          hash,
          platform,
        ),
      ]);
      return { deviceId, secret, walletId, supportId };
    } catch (e) {
      // A support-id collision is astronomically rare; try again with new values.
      if (!String(e).includes('UNIQUE')) throw e;
    }
  }
  throw new HttpError(503, 'try_again');
}
