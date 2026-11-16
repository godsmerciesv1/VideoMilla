import { nowSeconds } from './crypto';

/**
 * The wallet ledger (blueprint Section 23.3).
 *
 * D1 has no interactive transactions, so every critical operation is ONE `db.batch([...])` of fixed
 * statements, which D1 runs atomically. A batch aborts when a statement throws, not when an UPDATE
 * changes zero rows, so the schema is built to make unwanted cases throw:
 *   CHECK (balance >= 0)             -> not enough credits
 *   PRIMARY KEY on requests.key      -> the same request again
 *   PRIMARY KEY on purchases.ref_hash-> the same purchase again
 *   NOT NULL wallets.guard           -> the wallet owes credits (set to NULL when owed > 0)
 *   NOT NULL requests.status / purchases.wallet_id -> unknown or deleted wallet
 * `classify()` maps the error text to an outcome. If D1 words an error differently, only it changes.
 */
export type Outcome = 'ok' | 'duplicate' | 'insufficient' | 'debt' | 'unknown_wallet';

export function classify(e: unknown): Outcome {
  const m = e instanceof Error ? e.message : String(e);
  if (m.includes('UNIQUE constraint failed: requests.key') || m.includes('UNIQUE constraint failed: purchases.ref_hash')) {
    return 'duplicate';
  }
  if (m.includes('NOT NULL constraint failed: wallets.guard')) return 'debt';
  if (m.includes('NOT NULL constraint failed: requests.status') || m.includes('NOT NULL constraint failed: purchases.wallet_id')) {
    return 'unknown_wallet';
  }
  if (m.includes('CHECK constraint failed')) return 'insufficient';
  throw e;
}

export interface ReserveItem {
  key: string;
  walletId: string;
  deviceId?: string;
  action: string;
  cost: number;
  projectId?: string;
  provider?: string;
  /** Expected provider cost in millionths of a dollar, recorded for margin tracking. */
  estMicro?: number;
}

function reserveStatements(db: D1Database, items: ReserveItem[], now: number): D1PreparedStatement[] {
  return items.flatMap((p) => {
    if (!Number.isInteger(p.cost) || p.cost < 0) throw new RangeError('cost must be a whole number of credits, 0 or more');
    return [
      db
        .prepare(
          `INSERT INTO requests(key,wallet_id,device_id,action,status,credits,project_id,provider,est_cost_micro,updated_at)
           VALUES(?,?,?,?,'reserved',?,?,?,?,?)`,
        )
        .bind(p.key, p.walletId, p.deviceId ?? null, p.action, p.cost, p.projectId ?? null, p.provider ?? null, p.estMicro ?? 0, now),
      // Unknown or deleted wallet: status becomes NULL, which violates NOT NULL and aborts the batch.
      db
        .prepare(
          `UPDATE requests SET status = CASE WHEN EXISTS(SELECT 1 FROM wallets WHERE id=? AND deleted=0) THEN 'reserved' END WHERE key=?`,
        )
        .bind(p.walletId, p.key),
      // Debt: guard becomes NULL. Too little credit: balance < 0 violates the CHECK.
      db.prepare('UPDATE wallets SET balance = balance - ?, guard = CASE WHEN owed = 0 THEN 1 END WHERE id=?').bind(p.cost, p.walletId),
      db.prepare("INSERT INTO ledger(wallet_id,delta,kind,ref) VALUES(?,?,'reserve',?)").bind(p.walletId, -p.cost, p.key),
    ];
  });
}

/** Reserves several requests together: all of them or none (a multi-clip submit). */
export async function reserveMany(db: D1Database, items: ReserveItem[]): Promise<Outcome> {
  if (items.length === 0) return 'ok';
  try {
    await db.batch(reserveStatements(db, items, nowSeconds()));
    return 'ok';
  } catch (e) {
    return classify(e);
  }
}

export function reserve(db: D1Database, item: ReserveItem): Promise<Outcome> {
  return reserveMany(db, [item]);
}

/** reserved -> committed. True only for the call that made the change. */
export async function commit(db: D1Database, key: string): Promise<boolean> {
  const r = await db
    .prepare("UPDATE requests SET status='committed', updated_at=? WHERE key=? AND status='reserved'")
    .bind(nowSeconds(), key)
    .run();
  return (r.meta.changes ?? 0) === 1;
}

/**
 * Gives the credits of a reserved or committed request back, once. The `settled` flag makes any
 * repeat a no-op. True only for the call that did the refund.
 */
export async function refund(db: D1Database, key: string): Promise<boolean> {
  const res = await db.batch([
    db.prepare("UPDATE requests SET status='refunded' WHERE key=? AND status IN ('reserved','committed')").bind(key),
    db
      .prepare(
        `INSERT INTO ledger(wallet_id,delta,kind,ref)
         SELECT wallet_id, credits, 'refund', key FROM requests WHERE key=? AND status='refunded' AND settled=0`,
      )
      .bind(key),
    db
      .prepare(
        `UPDATE wallets SET balance = balance + (SELECT credits FROM requests WHERE key=? AND status='refunded' AND settled=0)
         WHERE id = (SELECT wallet_id FROM requests WHERE key=? AND status='refunded' AND settled=0)`,
      )
      .bind(key, key),
    db.prepare("UPDATE requests SET settled=1 WHERE key=? AND status='refunded' AND settled=0").bind(key),
  ]);
  return (res[0]?.meta.changes ?? 0) === 1;
}

export interface PurchaseInput {
  /** Hash of the Play purchase token or the Polar order id: the replay guard. */
  refHash: string;
  walletId: string;
  channel: 'play' | 'polar';
  credits: number;
  productId?: string;
  orderId?: string;
}

/**
 * Adds a verified purchase once. The reference is the primary key, so a replay throws and nothing
 * changes. Debt is paid first. The wallet's first purchase is counted for the conversion metric.
 * Returns 'ok', 'duplicate' (already credited) or 'unknown_wallet' (nothing is recorded, so the
 * reference is not burned).
 */
export async function creditPurchase(db: D1Database, p: PurchaseInput): Promise<Outcome> {
  if (!Number.isInteger(p.credits) || p.credits <= 0) throw new RangeError('credits must be a positive whole number');
  try {
    await db.batch([
      db
        .prepare("INSERT INTO purchases(ref_hash,wallet_id,channel,product_id,credits,order_id,state) VALUES(?,?,?,?,?,?,'paid')")
        .bind(p.refHash, p.walletId, p.channel, p.productId ?? null, p.credits, p.orderId ?? null),
      db
        .prepare(
          'UPDATE purchases SET wallet_id = CASE WHEN EXISTS(SELECT 1 FROM wallets WHERE id=? AND deleted=0) THEN ? END WHERE ref_hash=?',
        )
        .bind(p.walletId, p.walletId, p.refHash),
      // Counted before ever_purchased flips, so it counts each wallet once. A refund never decrements it.
      db
        .prepare(
          `INSERT INTO counters(key,window,count) SELECT 'r7:first_buyers','all',1 FROM wallets WHERE id=? AND ever_purchased=0
           ON CONFLICT(key) DO UPDATE SET count = count + 1`,
        )
        .bind(p.walletId),
      db
        .prepare("INSERT INTO ledger(wallet_id,delta,kind,ref) SELECT id, MAX(?1-owed,0), 'purchase', ?2 FROM wallets WHERE id=?3")
        .bind(p.credits, p.refHash, p.walletId),
      db
        .prepare('UPDATE wallets SET balance = balance + MAX(?1-owed,0), owed = MAX(owed-?1,0), ever_purchased = 1 WHERE id=?2')
        .bind(p.credits, p.walletId),
    ]);
    return 'ok';
  } catch (e) {
    return classify(e);
  }
}

/**
 * A refund or chargeback of a purchase: removes the credits it brought; what was already spent
 * becomes debt. Safe to repeat: only a purchase still marked 'paid' is voided. Returns true when
 * this call voided it.
 */
export async function voidPurchase(db: D1Database, refHash: string): Promise<boolean> {
  const res = await db.batch([
    db.prepare("UPDATE purchases SET state='voiding' WHERE ref_hash=? AND state='paid'").bind(refHash),
    db
      .prepare(
        `INSERT INTO ledger(wallet_id,delta,kind,ref)
         SELECT w.id, -MIN(w.balance, p.credits), 'void', p.ref_hash
           FROM purchases p JOIN wallets w ON w.id = p.wallet_id WHERE p.ref_hash=? AND p.state='voiding'`,
      )
      .bind(refHash),
    db
      .prepare(
        `UPDATE wallets
            SET balance = MAX(balance - (SELECT credits FROM purchases WHERE ref_hash=?1 AND state='voiding'), 0),
                owed = owed + MAX((SELECT credits FROM purchases WHERE ref_hash=?1 AND state='voiding') - balance, 0)
          WHERE id = (SELECT wallet_id FROM purchases WHERE ref_hash=?1 AND state='voiding')`,
      )
      .bind(refHash),
    db.prepare("UPDATE purchases SET state='voided', voided_at=? WHERE ref_hash=? AND state='voiding'").bind(nowSeconds(), refHash),
  ]);
  return (res[0]?.meta.changes ?? 0) === 1;
}

export type LinkResult = 'ok' | 'same' | 'unknown_wallet';

/**
 * Moves everything from [oldWalletId] into [targetWalletId] and retires the old wallet (sign-in
 * merges the device's anonymous wallet into the account's). One atomic batch; the total is
 * conserved. Credits already in the target first pay off debt brought from the old wallet.
 */
export async function linkWallet(db: D1Database, oldWalletId: string, targetWalletId: string): Promise<LinkResult> {
  if (oldWalletId === targetWalletId) return 'same';
  const live = await db
    .prepare('SELECT id FROM wallets WHERE id IN (?1, ?2) AND deleted=0')
    .bind(oldWalletId, targetWalletId)
    .all<{ id: string }>();
  if (live.results.length !== 2) return 'unknown_wallet';

  await db.batch([
    db
      .prepare("INSERT INTO ledger(wallet_id,delta,kind,ref) SELECT id, -balance, 'merge_out', ?2 FROM wallets WHERE id=?1 AND deleted=0")
      .bind(oldWalletId, targetWalletId),
    db
      .prepare("INSERT INTO ledger(wallet_id,delta,kind,ref) SELECT ?2, balance, 'merge_in', ?1 FROM wallets WHERE id=?1 AND deleted=0")
      .bind(oldWalletId, targetWalletId),
    db
      .prepare(
        `UPDATE wallets
            SET balance = balance + (SELECT balance FROM wallets WHERE id=?1),
                owed = owed + (SELECT owed FROM wallets WHERE id=?1),
                ever_purchased = MAX(ever_purchased, (SELECT ever_purchased FROM wallets WHERE id=?1))
          WHERE id=?2 AND deleted=0`,
      )
      .bind(oldWalletId, targetWalletId),
    db.prepare('UPDATE devices SET wallet_id=?2 WHERE wallet_id=?1').bind(oldWalletId, targetWalletId),
    db.prepare('UPDATE requests SET wallet_id=?2 WHERE wallet_id=?1').bind(oldWalletId, targetWalletId),
    db.prepare('UPDATE purchases SET wallet_id=?2 WHERE wallet_id=?1').bind(oldWalletId, targetWalletId),
    db.prepare('UPDATE wallets SET balance=0, owed=0, deleted=1 WHERE id=?1').bind(oldWalletId),
    // Credits and debt in one wallet cancel out, and the ledger records it so it still adds up.
    db
      .prepare("INSERT INTO ledger(wallet_id,delta,kind,ref) SELECT id, -MIN(balance,owed), 'debt_net', ?2 FROM wallets WHERE id=?1 AND MIN(balance,owed) > 0")
      .bind(targetWalletId, oldWalletId),
    db.prepare('UPDATE wallets SET balance = balance - MIN(balance,owed), owed = owed - MIN(balance,owed) WHERE id=?1').bind(targetWalletId),
  ]);
  return 'ok';
}
