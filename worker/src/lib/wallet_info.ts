import { cfg } from '../routes/config';

export interface WalletInfo {
  everPurchased: boolean;
  owed: number;
  balance: number;
}

export async function walletInfo(db: D1Database, walletId: string): Promise<WalletInfo | null> {
  const r = await db.prepare('SELECT ever_purchased AS p, owed, balance FROM wallets WHERE id = ? AND deleted = 0').bind(walletId).first<{ p: number; owed: number; balance: number }>();
  return r ? { everPurchased: r.p === 1, owed: r.owed, balance: r.balance } : null;
}

/**
 * Counts the wallet the first time analysis or a helper answers "purchase required", once per wallet
 * (blueprint 23.11). The marker row makes it once only; a refund never changes it.
 */
export async function recordGateHit(db: D1Database, walletId: string): Promise<void> {
  await db.batch([
    db.prepare("INSERT OR IGNORE INTO counters(key, window, count) VALUES(?, 'all', 1)").bind(`r7:seen:${walletId}`),
    db.prepare("INSERT INTO counters(key, window, count) SELECT 'r7:gate_wallets', 'all', 1 WHERE changes() = 1 ON CONFLICT(key) DO UPDATE SET count = count + 1"),
  ]);
}

export interface FairUse {
  /** The wallet is past the trust period (decision D-113). */
  established: boolean;
  /** 0 means no daily limit. */
  picturesPerDay: number;
  animatedSecondsPerDay: number;
  clipsInFlight: number;
}

const DEFAULTS: Record<string, number> = {
  established_after_days: 7,
  pictures_per_day_new: 400,
  pictures_per_day_established: 0,
  animated_seconds_per_day_new: 600,
  animated_seconds_per_day_established: 0,
  clips_in_flight_new: 2,
  clips_in_flight_established: 6,
};

/**
 * Fair use is about fraud exposure, not rationing (D-113). A wallet is established once its first purchase
 * is at least `established_after_days` old and none of its purchases has been refunded or charged back.
 * Established wallets have no daily limit; new ones have limits above what the largest pack can fund.
 */
export async function fairUseFor(db: D1Database, walletId: string, now: number = Math.floor(Date.now() / 1000)): Promise<FairUse> {
  const raw = (await cfg<Record<string, unknown>>(db, 'fair_use')) ?? {};
  const v = (k: string): number => (typeof raw[k] === 'number' && (raw[k] as number) >= 0 ? (raw[k] as number) : DEFAULTS[k]!);
  const p = await db
    .prepare("SELECT MIN(created_at) AS first, SUM(CASE WHEN state IN ('voiding','voided') THEN 1 ELSE 0 END) AS bad FROM purchases WHERE wallet_id = ?")
    .bind(walletId)
    .first<{ first: number | null; bad: number | null }>();
  const established = p?.first != null && (p.bad ?? 0) === 0 && now - p.first >= v('established_after_days') * 86400;
  const t = established ? 'established' : 'new';
  return {
    established,
    picturesPerDay: v(`pictures_per_day_${t}`),
    animatedSecondsPerDay: v(`animated_seconds_per_day_${t}`),
    clipsInFlight: v(`clips_in_flight_${t}`),
  };
}

export async function creditCosts(db: D1Database): Promise<Record<string, number>> {
  const raw = (await cfg<Record<string, unknown>>(db, 'credit_costs')) ?? {};
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(raw)) if (typeof v === 'number') out[k] = v;
  return out;
}
