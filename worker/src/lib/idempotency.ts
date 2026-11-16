import { HttpError } from './http';
import { nowSeconds } from './crypto';

export interface RequestRow {
  key: string;
  wallet_id: string;
  action: string;
  credits: number;
  status: string;
  settled: number;
  provider: string | null;
  updated_at: number;
}

/** How long a `reserved` request is considered in flight before another call may take it over. */
export const LEASE_SECONDS = 120;

/** `^[A-Za-z0-9:_-]{8,96}$`, checked with simple character tests. */
export function isValidKey(key: unknown): key is string {
  if (typeof key !== 'string' || key.length < 8 || key.length > 96) return false;
  for (let i = 0; i < key.length; i++) {
    const c = key.charCodeAt(i);
    const ok =
      (c >= 48 && c <= 57) || (c >= 65 && c <= 90) || (c >= 97 && c <= 122) || c === 58 /* : */ || c === 95 /* _ */ || c === 45; /* - */
    if (!ok) return false;
  }
  return true;
}

export async function getRequest(db: D1Database, key: string): Promise<RequestRow | null> {
  return db
    .prepare('SELECT key, wallet_id, action, credits, status, settled, provider, updated_at FROM requests WHERE key = ?')
    .bind(key)
    .first<RequestRow>();
}

/** What a repeated call must do (blueprint Section 23.4). A retry never charges twice. */
export type RetryDecision =
  | { kind: 'new' }
  | { kind: 'in_progress' }
  | { kind: 'takeover'; request: RequestRow }
  | { kind: 'serve_committed'; request: RequestRow }
  | { kind: 'delivered' }
  | { kind: 'refunded' };

/**
 * Decides what to do with a request key:
 *  - unknown key: `new` (reserve and work);
 *  - `reserved` and touched within 120 s: `in_progress`;
 *  - `reserved` and older: one caller wins `takeover` (a conditional update on `updated_at`), others see `in_progress`;
 *  - `committed`: serve the stored result again (clips are in storage; a picture is redone free);
 *  - `delivered`, `refunded`: reported as such.
 * A key that belongs to another wallet is refused.
 */
export async function resolveRetry(db: D1Database, key: string, walletId: string, now: number = nowSeconds()): Promise<RetryDecision> {
  const row = await getRequest(db, key);
  if (!row) return { kind: 'new' };
  if (row.wallet_id !== walletId) throw new HttpError(409, 'key_in_use');
  switch (row.status) {
    case 'reserved': {
      if (now - row.updated_at <= LEASE_SECONDS) return { kind: 'in_progress' };
      const r = await db
        .prepare("UPDATE requests SET updated_at=? WHERE key=? AND status='reserved' AND updated_at=?")
        .bind(now, key, row.updated_at)
        .run();
      return (r.meta.changes ?? 0) === 1 ? { kind: 'takeover', request: { ...row, updated_at: now } } : { kind: 'in_progress' };
    }
    case 'committed':
      return { kind: 'serve_committed', request: row };
    case 'delivered':
      return { kind: 'delivered' };
    default:
      return { kind: 'refunded' };
  }
}

/** The app confirmed it saved the result: committed -> delivered. */
export async function markDelivered(db: D1Database, key: string, walletId: string): Promise<boolean> {
  const r = await db
    .prepare("UPDATE requests SET status='delivered', updated_at=? WHERE key=? AND wallet_id=? AND status='committed'")
    .bind(nowSeconds(), key, walletId)
    .run();
  return (r.meta.changes ?? 0) === 1;
}
