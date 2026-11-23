import { env } from 'cloudflare:workers';
import { beforeEach, describe, expect, it } from 'vitest';
import { creditPurchase, reserve, voidPurchase } from '../src/lib/ledger';
import { grantReferral, referralBonus, referralRules, settleReferrals, voidReferral } from '../src/lib/referrals';
import { makeAccountFor, setConfig } from './harness';
import { expectConsistent, newWallet, uid, walletRow } from './helpers';

const db = env.DB;
const DAY = 86400;
const now = () => Math.floor(Date.now() / 1000);

beforeEach(async () => {
  // Referrals from earlier tests would also fall due on the same day, so every test starts from an empty table.
  await db.prepare('DELETE FROM referrals').run();
  await setConfig('referral', { min_pack_credits: 90, percent: 10, hold_days: 14, max_referrals_30d: 20, max_bonus_30d: 500 });
});

interface Pair { referrer: { wallet: string; account: string }; buyer: { wallet: string; account: string } }

async function pair(referrer?: { wallet: string; account: string }): Promise<Pair> {
  let r = referrer;
  if (!r) {
    const wallet = await newWallet();
    r = { wallet, account: await makeAccountFor(wallet) };
  }
  const wallet = await newWallet();
  return { referrer: r, buyer: { wallet, account: await makeAccountFor(wallet, { referredBy: r.account }) } };
}

/** The buyer buys a pack and the referral is granted, as the webhook does. */
async function buy(p: Pair, credits: number, at = now()): Promise<{ ref: string; result: string }> {
  const ref = 'p-' + uid();
  expect(await creditPurchase(db, { refHash: ref, walletId: p.buyer.wallet, channel: 'play', credits })).toBe('ok');
  return { ref, result: await grantReferral(db, { walletId: p.buyer.wallet, purchaseRef: ref, packCredits: credits }, at) };
}

const state = async (buyerAccount: string) => (await db.prepare('SELECT state FROM referrals WHERE referred_account = ?').bind(buyerAccount).first<{ state: string }>())?.state ?? null;

describe('the bonus', () => {
  it('is 10% rounded down: 90, 160, 350, 750 credits give 9, 16, 35, 75', async () => {
    expect([90, 160, 350, 750].map((c) => referralBonus(c))).toEqual([9, 16, 35, 75]);
    expect(referralBonus(99)).toBe(9);
    expect(await referralRules(db)).toEqual({ minPackCredits: 90, percent: 10, holdDays: 14, maxReferrals30d: 20, maxBonus30d: 500 });
  });

  it('goes to the buyer at once as real credits, in the ledger, and the referrer waits', async () => {
    for (const [pack, bonus] of [[90, 9], [160, 16], [350, 35], [750, 75]] as const) {
      const p = await pair();
      expect((await buy(p, pack)).result).toBe('granted');
      expect((await walletRow(p.buyer.wallet)).balance).toBe(pack + bonus);
      expect((await walletRow(p.referrer.wallet)).balance).toBe(0);
      expect(await state(p.buyer.account)).toBe('pending');
      await expectConsistent(p.buyer.wallet);
    }
  });

  it('a pack under 90 credits earns nothing; the first qualifying pack after it does', async () => {
    const p = await pair();
    expect((await buy(p, 25)).result).toBe('not_eligible');
    expect(await state(p.buyer.account)).toBeNull();
    expect((await buy(p, 160)).result).toBe('granted');
  });

  it('is paid once per buyer: a second qualifying purchase adds nothing', async () => {
    const p = await pair();
    await buy(p, 160);
    expect((await buy(p, 350)).result).toBe('duplicate');
    expect((await walletRow(p.buyer.wallet)).balance).toBe(160 + 16 + 350);
    await expectConsistent(p.buyer.wallet);
  });

  it('is refused for self-referral, a missing referrer and a deleted referrer', async () => {
    const w = await newWallet();
    const own = await makeAccountFor(w);
    await db.prepare('UPDATE accounts SET referred_by = ? WHERE id = ?').bind(own, own).run();
    const ref = 'p-' + uid();
    await creditPurchase(db, { refHash: ref, walletId: w, channel: 'play', credits: 160 });
    expect(await grantReferral(db, { walletId: w, purchaseRef: ref, packCredits: 160 })).toBe('not_eligible');

    const noReferrer = await newWallet();
    await makeAccountFor(noReferrer);
    const r2 = 'p-' + uid();
    await creditPurchase(db, { refHash: r2, walletId: noReferrer, channel: 'play', credits: 160 });
    expect(await grantReferral(db, { walletId: noReferrer, purchaseRef: r2, packCredits: 160 })).toBe('not_eligible');

    const gone = await newWallet();
    const goneAccount = await makeAccountFor(gone, { deleted: true });
    const p = await pair({ wallet: gone, account: goneAccount });
    expect((await buy(p, 160)).result).toBe('not_eligible');
    expect((await walletRow(p.buyer.wallet)).balance).toBe(160);
  });

  it('a buyer whose account sits on the referrer\'s own wallet is refused', async () => {
    const wallet = await newWallet();
    const referrer = await makeAccountFor(wallet);
    // A second account that somehow shares the referrer's wallet cannot be created (wallet_id is unique), so the
    // wallet check is a second line of defence: the buyer's account IS the referrer's account.
    const ref = 'p-' + uid();
    await creditPurchase(db, { refHash: ref, walletId: wallet, channel: 'play', credits: 160 });
    await db.prepare('UPDATE accounts SET referred_by = ? WHERE id = ?').bind(referrer, referrer).run();
    expect(await grantReferral(db, { walletId: wallet, purchaseRef: ref, packCredits: 160 })).toBe('not_eligible');
    expect((await walletRow(wallet)).balance).toBe(160);
  });
});

describe('the referrer\'s share after the 14-day hold', () => {
  it('is not paid before the hold ends, and is paid exactly once on the day', async () => {
    const p = await pair();
    const t0 = now();
    await buy(p, 160, t0);
    expect(await settleReferrals(db, t0 + 13 * DAY)).toMatchObject({ settled: 0 });
    expect((await walletRow(p.referrer.wallet)).balance).toBe(0);
    expect(await settleReferrals(db, t0 + 14 * DAY + 5)).toMatchObject({ settled: 1 });
    expect((await walletRow(p.referrer.wallet)).balance).toBe(16);
    expect(await state(p.buyer.account)).toBe('settled');
    expect(await settleReferrals(db, t0 + 15 * DAY)).toMatchObject({ settled: 0 });
    expect((await walletRow(p.referrer.wallet)).balance).toBe(16);
    await expectConsistent(p.referrer.wallet);
    await expectConsistent(p.buyer.wallet);
  });

  it('two cron runs at once pay once', async () => {
    const p = await pair();
    const t0 = now();
    await buy(p, 350, t0);
    await Promise.all([settleReferrals(db, t0 + 15 * DAY), settleReferrals(db, t0 + 15 * DAY), settleReferrals(db, t0 + 15 * DAY)]);
    expect((await walletRow(p.referrer.wallet)).balance).toBe(35);
    await expectConsistent(p.referrer.wallet);
  });

  it('waits while the referrer owes credits, then pays once the debt is cleared', async () => {
    const p = await pair();
    const t0 = now();
    await buy(p, 160, t0);
    await db.prepare('UPDATE wallets SET owed = 5 WHERE id = ?').bind(p.referrer.wallet).run();
    expect(await settleReferrals(db, t0 + 15 * DAY)).toMatchObject({ settled: 0, waiting: 1 });
    expect(await state(p.buyer.account)).toBe('pending');
    await db.prepare('UPDATE wallets SET owed = 0 WHERE id = ?').bind(p.referrer.wallet).run();
    expect(await settleReferrals(db, t0 + 16 * DAY)).toMatchObject({ settled: 1 });
    expect((await walletRow(p.referrer.wallet)).balance).toBe(16);
  });

  it('stops at 20 referrals in 30 days: the 21st is capped, not paid', async () => {
    const referrer = { wallet: await newWallet(), account: '' };
    referrer.account = await makeAccountFor(referrer.wallet);
    const t0 = now();
    for (let i = 0; i < 21; i++) await buy(await pair(referrer), 90, t0);
    const r = await settleReferrals(db, t0 + 15 * DAY);
    expect(r).toMatchObject({ settled: 20, capped: 1 });
    expect((await walletRow(referrer.wallet)).balance).toBe(20 * 9);
  });

  it('stops at 500 bonus credits in 30 days', async () => {
    const referrer = { wallet: await newWallet(), account: '' };
    referrer.account = await makeAccountFor(referrer.wallet);
    const t0 = now();
    for (let i = 0; i < 8; i++) await buy(await pair(referrer), 750, t0); // 75 each
    const r = await settleReferrals(db, t0 + 15 * DAY);
    expect(r).toMatchObject({ settled: 6, capped: 2 }); // 6 x 75 = 450; the 7th would make 525
    expect((await walletRow(referrer.wallet)).balance).toBe(450);
  });

  it('a purchase that was voided before settlement never pays the referrer', async () => {
    const p = await pair();
    const t0 = now();
    const { ref } = await buy(p, 160, t0);
    await voidPurchase(db, ref); // the purchase is voided, but no one called voidReferral
    expect(await settleReferrals(db, t0 + 15 * DAY)).toMatchObject({ settled: 0, voided: 1 });
    expect((await walletRow(p.referrer.wallet)).balance).toBe(0);
    expect(await state(p.buyer.account)).toBe('void');
  });

  it('a referrer whose account was deleted is not paid', async () => {
    const p = await pair();
    const t0 = now();
    await buy(p, 160, t0);
    await db.prepare('UPDATE accounts SET deleted = 1 WHERE id = ?').bind(p.referrer.account).run();
    expect(await settleReferrals(db, t0 + 15 * DAY)).toMatchObject({ settled: 0, voided: 1 });
  });
});

describe('a refund or chargeback of the qualifying purchase', () => {
  it('inside the hold: the buyer\'s bonus is removed and the referrer is never paid', async () => {
    const p = await pair();
    const t0 = now();
    const { ref } = await buy(p, 160, t0);
    await voidPurchase(db, ref);
    expect(await voidReferral(db, ref)).toBe(true);
    expect(await walletRow(p.buyer.wallet)).toMatchObject({ balance: 0, owed: 0 });
    expect(await state(p.buyer.account)).toBe('void');
    expect(await settleReferrals(db, t0 + 15 * DAY)).toMatchObject({ settled: 0 });
    expect((await walletRow(p.referrer.wallet)).balance).toBe(0);
    await expectConsistent(p.buyer.wallet);
  });

  it('a bonus the buyer already spent becomes debt', async () => {
    const p = await pair();
    const { ref } = await buy(p, 160);
    await reserve(db, { key: 'spend-' + uid(), walletId: p.buyer.wallet, action: 'picture', cost: 170 });
    await voidPurchase(db, ref);
    await voidReferral(db, ref);
    expect(await walletRow(p.buyer.wallet)).toMatchObject({ balance: 0, owed: 176 - 6 });
    await expectConsistent(p.buyer.wallet);
  });

  it('repeating it changes nothing', async () => {
    const p = await pair();
    const { ref } = await buy(p, 160);
    await voidPurchase(db, ref);
    const results = await Promise.all(Array.from({ length: 6 }, () => voidReferral(db, ref)));
    expect(results.filter(Boolean)).toHaveLength(1);
    expect((await walletRow(p.buyer.wallet)).balance).toBe(0);
  });

  it('after the hold the referrer keeps the bonus and only the buyer\'s own credits go', async () => {
    const p = await pair();
    const t0 = now();
    const { ref } = await buy(p, 160, t0);
    await settleReferrals(db, t0 + 15 * DAY);
    expect((await walletRow(p.referrer.wallet)).balance).toBe(16);
    await voidPurchase(db, ref);
    expect(await voidReferral(db, ref)).toBe(false);
    expect((await walletRow(p.referrer.wallet)).balance).toBe(16);
    expect(await state(p.buyer.account)).toBe('settled');
    // the buyer keeps the 16-credit bonus but loses the 160 pack
    expect((await walletRow(p.buyer.wallet)).balance).toBe(16);
    await expectConsistent(p.buyer.wallet);
  });
});
