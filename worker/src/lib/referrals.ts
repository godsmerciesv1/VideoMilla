import { cfg } from '../routes/config';
import { randomBase64Url, nowSeconds } from './crypto';

/**
 * The referral programme (blueprint Section 53, F289). Rules live in config `referral`.
 *  - The referred account's first purchase of a pack with at least `min_pack_credits` earns the referred user
 *    10% at once, and the referrer 10% after a 14-day hold. One referral per referred account (a unique key).
 *  - A refund or chargeback inside the hold voids both; after it, the referrer keeps the bonus.
 *  - A referrer is paid within caps (20 referrals and 500 credits in 30 days) and not while in debt.
 * Every money change is one atomic batch that is safe to repeat.
 */
export interface ReferralRules {
  minPackCredits: number;
  percent: number;
  holdDays: number;
  maxReferrals30d: number;
  maxBonus30d: number;
}

export async function referralRules(db: D1Database): Promise<ReferralRules> {
  const c = (await cfg<Record<string, unknown>>(db, 'referral')) ?? {};
  const n = (k: string, d: number): number => (typeof c[k] === 'number' && (c[k] as number) >= 0 ? (c[k] as number) : d);
  return { minPackCredits: n('min_pack_credits', 90), percent: n('percent', 10), holdDays: n('hold_days', 14), maxReferrals30d: n('max_referrals_30d', 20), maxBonus30d: n('max_bonus_30d', 500) };
}

/** 10% of the pack, rounded down: 90 gives 9, 160 gives 16, 350 gives 35, 750 gives 75. */
export const referralBonus = (packCredits: number, percent = 10): number => Math.floor((packCredits * percent) / 100);

export type GrantResult = 'granted' | 'not_eligible' | 'duplicate';

export async function grantReferral(db: D1Database, i: { walletId: string; purchaseRef: string; packCredits: number }, now: number = nowSeconds()): Promise<GrantResult> {
  const rules = await referralRules(db);
  if (i.packCredits < rules.minPackCredits) return 'not_eligible';
  const referred = await db.prepare('SELECT id, referred_by FROM accounts WHERE wallet_id = ? AND deleted = 0').bind(i.walletId).first<{ id: string; referred_by: string | null }>();
  if (!referred?.referred_by) return 'not_eligible';
  const referrer = await db.prepare('SELECT id, wallet_id FROM accounts WHERE id = ? AND deleted = 0').bind(referred.referred_by).first<{ id: string; wallet_id: string }>();
  // No self-referral: the referrer's account and wallet must differ from the buyer's.
  if (!referrer || referrer.id === referred.id || referrer.wallet_id === i.walletId) return 'not_eligible';
  const bonus = referralBonus(i.packCredits, rules.percent);
  if (bonus <= 0) return 'not_eligible';

  const id = randomBase64Url(12);
  try {
    await db.batch([
      // The unique key on `referred_account` throws on a second referral for the same buyer, aborting the whole batch.
      db
        .prepare(
          `INSERT INTO referrals(id, referrer_account, referred_account, purchase_ref, pack_credits, referred_bonus, referrer_bonus, state, settles_at)
           VALUES(?, ?, ?, ?, ?, ?, ?, 'pending', ?)`,
        )
        .bind(id, referrer.id, referred.id, i.purchaseRef, i.packCredits, bonus, bonus, now + rules.holdDays * 86400),
      db.prepare("INSERT INTO ledger(wallet_id, delta, kind, ref) VALUES(?, ?, 'referral_bonus', ?)").bind(i.walletId, bonus, id),
      db.prepare('UPDATE wallets SET balance = balance + ? WHERE id = ? AND deleted = 0').bind(bonus, i.walletId),
    ]);
    return 'granted';
  } catch (e) {
    if (String(e).includes('UNIQUE constraint failed: referrals.referred_account')) return 'duplicate';
    throw e;
  }
}

export interface SettleReport {
  settled: number;
  capped: number;
  voided: number;
  waiting: number;
}

interface Pending {
  id: string;
  referrer_account: string;
  purchase_ref: string | null;
  referrer_bonus: number;
}

/**
 * Pays the referrer's share for referrals whose hold is over (called by the daily cron). Rows stay pending while the
 * referrer owes credits; rows over the 30-day caps become `capped`; a voided purchase makes the row void.
 */
export async function settleReferrals(db: D1Database, now: number = nowSeconds(), limit = 200): Promise<SettleReport> {
  const rules = await referralRules(db);
  const report: SettleReport = { settled: 0, capped: 0, voided: 0, waiting: 0 };
  const due = await db
    .prepare("SELECT id, referrer_account, purchase_ref, referrer_bonus FROM referrals WHERE state = 'pending' AND settles_at <= ? ORDER BY settles_at LIMIT ?")
    .bind(now, limit)
    .all<Pending>();

  for (const r of due.results) {
    const purchase = r.purchase_ref ? await db.prepare('SELECT state FROM purchases WHERE ref_hash = ?').bind(r.purchase_ref).first<{ state: string }>() : null;
    if (purchase && (purchase.state === 'voiding' || purchase.state === 'voided')) {
      await db.prepare("UPDATE referrals SET state = 'void' WHERE id = ? AND state = 'pending'").bind(r.id).run();
      report.voided++;
      continue;
    }
    const wallet = await db
      .prepare('SELECT w.id AS id, w.owed AS owed FROM accounts a JOIN wallets w ON w.id = a.wallet_id WHERE a.id = ? AND a.deleted = 0 AND w.deleted = 0')
      .bind(r.referrer_account)
      .first<{ id: string; owed: number }>();
    if (!wallet) {
      await db.prepare("UPDATE referrals SET state = 'void' WHERE id = ? AND state = 'pending'").bind(r.id).run();
      report.voided++;
      continue;
    }
    if (wallet.owed > 0) {
      report.waiting++;
      continue;
    }
    const recent = await db
      .prepare("SELECT COUNT(*) AS n, COALESCE(SUM(referrer_bonus), 0) AS credits FROM referrals WHERE referrer_account = ? AND state = 'settled' AND created_at >= ?")
      .bind(r.referrer_account, now - 30 * 86400)
      .first<{ n: number; credits: number }>();
    if ((recent?.n ?? 0) >= rules.maxReferrals30d || (recent?.credits ?? 0) + r.referrer_bonus > rules.maxBonus30d) {
      await db.prepare("UPDATE referrals SET state = 'capped' WHERE id = ? AND state = 'pending'").bind(r.id).run();
      report.capped++;
      continue;
    }
    // One atomic batch; the 'settling' step makes a repeat or a race a no-op.
    const res = await db.batch([
      db.prepare("UPDATE referrals SET state = 'settling' WHERE id = ?1 AND state = 'pending'").bind(r.id),
      db
        .prepare("INSERT INTO ledger(wallet_id, delta, kind, ref) SELECT ?2, referrer_bonus, 'referral_settle', id FROM referrals WHERE id = ?1 AND state = 'settling'")
        .bind(r.id, wallet.id),
      db
        .prepare("UPDATE wallets SET balance = balance + (SELECT referrer_bonus FROM referrals WHERE id = ?1 AND state = 'settling') WHERE id = ?2 AND EXISTS(SELECT 1 FROM referrals WHERE id = ?1 AND state = 'settling')")
        .bind(r.id, wallet.id),
      db.prepare("UPDATE referrals SET state = 'settled' WHERE id = ? AND state = 'settling'").bind(r.id),
    ]);
    if ((res[0]?.meta.changes ?? 0) === 1) report.settled++;
  }
  return report;
}

/**
 * A refund or chargeback of the qualifying purchase. Inside the hold it removes the referred user's bonus (what was
 * already spent becomes debt) and cancels the referrer's share. After the hold (state settled) it changes nothing:
 * the referrer keeps the bonus. Safe to repeat. Returns true when this call voided a pending referral.
 */
export async function voidReferral(db: D1Database, purchaseRef: string): Promise<boolean> {
  const referredWallet = '(SELECT a.wallet_id FROM referrals r JOIN accounts a ON a.id = r.referred_account WHERE r.purchase_ref = ?1 AND r.state = \'voiding\')';
  const bonus = "(SELECT referred_bonus FROM referrals WHERE purchase_ref = ?1 AND state = 'voiding')";
  const res = await db.batch([
    db.prepare("UPDATE referrals SET state = 'voiding' WHERE purchase_ref = ?1 AND state = 'pending'").bind(purchaseRef),
    db
      .prepare(
        `INSERT INTO ledger(wallet_id, delta, kind, ref)
         SELECT w.id, -MIN(w.balance, r.referred_bonus), 'referral_void', r.id
           FROM referrals r JOIN accounts a ON a.id = r.referred_account JOIN wallets w ON w.id = a.wallet_id
          WHERE r.purchase_ref = ?1 AND r.state = 'voiding'`,
      )
      .bind(purchaseRef),
    db
      .prepare(`UPDATE wallets SET balance = MAX(balance - ${bonus}, 0), owed = owed + MAX(${bonus} - balance, 0) WHERE id = ${referredWallet}`)
      .bind(purchaseRef),
    db.prepare("UPDATE referrals SET state = 'void' WHERE purchase_ref = ?1 AND state = 'voiding'").bind(purchaseRef),
  ]);
  return (res[0]?.meta.changes ?? 0) === 1;
}
