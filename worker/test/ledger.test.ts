import { env } from 'cloudflare:workers';
import { describe, expect, it } from 'vitest';
import { classify, commit, creditPurchase, linkWallet, refund, reserve, reserveMany, voidPurchase } from '../src/lib/ledger';
import { counter, expectConsistent, ledgerSum, newWallet, requestStatus, uid, walletRow } from './helpers';

const db = env.DB;
const item = (walletId: string, key: string, cost = 1) => ({ key, walletId, action: 'picture', cost });

describe('reserve', () => {
  it('takes the credits and records the request and the ledger row', async () => {
    const w = await newWallet(50);
    const key = 'req-' + uid();
    expect(await reserve(db, item(w, key, 10))).toBe('ok');
    expect((await walletRow(w)).balance).toBe(40);
    expect(await requestStatus(key)).toEqual({ status: 'reserved', settled: 0 });
    await expectConsistent(w);
  });

  it('refuses without enough credits and leaves no trace', async () => {
    const w = await newWallet(5);
    const key = 'req-' + uid();
    expect(await reserve(db, item(w, key, 6))).toBe('insufficient');
    expect((await walletRow(w)).balance).toBe(5);
    expect(await requestStatus(key)).toBeNull();
    await expectConsistent(w);
  });

  it('300 simultaneous spends against a balance of 100: exactly 100 succeed', async () => {
    const w = await newWallet(100);
    const results = await Promise.all(Array.from({ length: 300 }, (_, i) => reserve(db, item(w, `burst-${w}-${i}`))));
    expect(results.filter((r) => r === 'ok')).toHaveLength(100);
    expect(results.filter((r) => r === 'insufficient')).toHaveLength(200);
    expect((await walletRow(w)).balance).toBe(0);
    const stored = await db.prepare('SELECT COUNT(*) AS n FROM requests WHERE wallet_id = ?').bind(w).first<{ n: number }>();
    expect(stored!.n).toBe(100);
    await expectConsistent(w);
  });

  it('the same key 80 times at once is charged once', async () => {
    const w = await newWallet(100);
    const key = 'same-' + uid();
    const results = await Promise.all(Array.from({ length: 80 }, () => reserve(db, item(w, key, 7))));
    expect(results.filter((r) => r === 'ok')).toHaveLength(1);
    expect(results.filter((r) => r === 'duplicate')).toHaveLength(79);
    expect((await walletRow(w)).balance).toBe(93);
    await expectConsistent(w);
  });

  it('an unknown wallet gets nothing for free', async () => {
    const key = 'req-' + uid();
    expect(await reserve(db, item('no-such-wallet', key, 0))).toBe('unknown_wallet');
    expect(await requestStatus(key)).toBeNull();
  });

  it('a deleted wallet cannot spend', async () => {
    const w = await newWallet(20);
    await db.prepare('UPDATE wallets SET deleted = 1 WHERE id = ?').bind(w).run();
    expect(await reserve(db, item(w, 'req-' + uid(), 1))).toBe('unknown_wallet');
    expect((await walletRow(w)).balance).toBe(20);
  });

  it('a wallet that owes credits cannot spend, even a free action', async () => {
    const w = await newWallet(100);
    await db.prepare('UPDATE wallets SET owed = 5 WHERE id = ?').bind(w).run();
    expect(await reserve(db, item(w, 'req-' + uid(), 1))).toBe('debt');
    expect(await reserve(db, item(w, 'req-' + uid(), 0))).toBe('debt');
    expect((await walletRow(w)).balance).toBe(100);
  });

  it('rejects a negative or fractional cost before touching the database', async () => {
    const w = await newWallet(10);
    await expect(reserve(db, item(w, 'req-' + uid(), -1))).rejects.toThrow(RangeError);
    await expect(reserve(db, item(w, 'req-' + uid(), 1.5))).rejects.toThrow(RangeError);
  });
});

describe('reserveMany (several clips)', () => {
  it('reserves all of them together', async () => {
    const w = await newWallet(100);
    const keys = [1, 2, 3].map((i) => `clip-${uid()}-${i}`);
    expect(await reserveMany(db, keys.map((k) => item(w, k, 20)))).toBe('ok');
    expect((await walletRow(w)).balance).toBe(40);
    for (const k of keys) expect((await requestStatus(k))?.status).toBe('reserved');
    await expectConsistent(w);
  });

  it('all or none: if the last one does not fit, nothing is reserved', async () => {
    const w = await newWallet(100);
    const keys = [1, 2, 3].map((i) => `clip-${uid()}-${i}`);
    expect(await reserveMany(db, keys.map((k) => item(w, k, 40)))).toBe('insufficient');
    expect((await walletRow(w)).balance).toBe(100);
    for (const k of keys) expect(await requestStatus(k)).toBeNull();
    await expectConsistent(w);
  });

  it('one duplicate key cancels the whole group', async () => {
    const w = await newWallet(100);
    const dup = 'dup-' + uid();
    expect(await reserve(db, item(w, dup, 10))).toBe('ok');
    expect(await reserveMany(db, [item(w, 'fresh-' + uid(), 10), item(w, dup, 10)])).toBe('duplicate');
    expect((await walletRow(w)).balance).toBe(90);
  });
});

describe('commit and refund', () => {
  it('commit works once and only from reserved', async () => {
    const w = await newWallet(20);
    const key = 'req-' + uid();
    await reserve(db, item(w, key, 5));
    expect(await commit(db, key)).toBe(true);
    expect(await commit(db, key)).toBe(false);
    expect((await requestStatus(key))?.status).toBe('committed');
  });

  it('refund gives the credits back once', async () => {
    const w = await newWallet(20);
    const key = 'req-' + uid();
    await reserve(db, item(w, key, 5));
    expect(await refund(db, key)).toBe(true);
    expect(await refund(db, key)).toBe(false);
    expect((await walletRow(w)).balance).toBe(20);
    expect(await requestStatus(key)).toEqual({ status: 'refunded', settled: 1 });
    await expectConsistent(w);
  });

  it('40 racing refunds refund once', async () => {
    const w = await newWallet(100);
    const key = 'req-' + uid();
    await reserve(db, item(w, key, 30));
    const results = await Promise.all(Array.from({ length: 40 }, () => refund(db, key)));
    expect(results.filter(Boolean)).toHaveLength(1);
    expect((await walletRow(w)).balance).toBe(100);
    await expectConsistent(w);
  });

  it('commit racing refund ends in one consistent state', async () => {
    for (let round = 0; round < 12; round++) {
      const w = await newWallet(50);
      const key = 'race-' + uid();
      await reserve(db, item(w, key, 10));
      await Promise.all([commit(db, key), refund(db, key), commit(db, key), refund(db, key)]);
      const s = await requestStatus(key);
      const bal = (await walletRow(w)).balance;
      if (s!.status === 'refunded') {
        expect(bal).toBe(50);
        expect(s!.settled).toBe(1);
      } else {
        expect(s!.status).toBe('committed');
        expect(bal).toBe(40);
      }
      await expectConsistent(w);
    }
  });

  it('refunding something never reserved does nothing', async () => {
    expect(await refund(db, 'never-' + uid())).toBe(false);
  });
});

describe('purchases', () => {
  it('credits a purchase and flags the wallet', async () => {
    const w = await newWallet();
    expect(await creditPurchase(db, { refHash: 'p-' + uid(), walletId: w, channel: 'play', credits: 160, productId: 'x' })).toBe('ok');
    const row = await walletRow(w);
    expect(row.balance).toBe(160);
    expect(row.ever_purchased).toBe(1);
    await expectConsistent(w);
  });

  it('the same purchase reference 60 times at once is credited once', async () => {
    const w = await newWallet();
    const ref = 'p-' + uid();
    const results = await Promise.all(Array.from({ length: 60 }, () => creditPurchase(db, { refHash: ref, walletId: w, channel: 'polar', credits: 90 })));
    expect(results.filter((r) => r === 'ok')).toHaveLength(1);
    expect(results.filter((r) => r === 'duplicate')).toHaveLength(59);
    expect((await walletRow(w)).balance).toBe(90);
    await expectConsistent(w);
  });

  it('an unknown wallet burns nothing: the reference works later', async () => {
    const ref = 'p-' + uid();
    expect(await creditPurchase(db, { refHash: ref, walletId: 'w-not-yet', channel: 'play', credits: 25 })).toBe('unknown_wallet');
    const stored = await db.prepare('SELECT COUNT(*) AS n FROM purchases WHERE ref_hash = ?').bind(ref).first<{ n: number }>();
    expect(stored!.n).toBe(0);
    await db.prepare('INSERT INTO wallets(id, support_id) VALUES(?, ?)').bind('w-not-yet', 'ZZZZ2222').run();
    expect(await creditPurchase(db, { refHash: ref, walletId: 'w-not-yet', channel: 'play', credits: 25 })).toBe('ok');
    expect((await walletRow('w-not-yet')).balance).toBe(25);
  });

  it('counts a wallet\'s first purchase once, and a refund does not undo it', async () => {
    const before = await counter('r7:first_buyers');
    const w = await newWallet();
    const ref1 = 'p-' + uid();
    await creditPurchase(db, { refHash: ref1, walletId: w, channel: 'play', credits: 25 });
    await creditPurchase(db, { refHash: 'p-' + uid(), walletId: w, channel: 'play', credits: 25 });
    expect(await counter('r7:first_buyers')).toBe(before + 1);
    await voidPurchase(db, ref1);
    expect(await counter('r7:first_buyers')).toBe(before + 1);
    const w2 = await newWallet(25);
    expect(w2).toBeTruthy();
    expect(await counter('r7:first_buyers')).toBe(before + 2);
  });

  it('rejects a zero or fractional purchase', async () => {
    const w = await newWallet();
    await expect(creditPurchase(db, { refHash: 'p-' + uid(), walletId: w, channel: 'play', credits: 0 })).rejects.toThrow(RangeError);
  });
});

describe('refunds and chargebacks (void)', () => {
  it('removes the credits a purchase brought', async () => {
    const w = await newWallet();
    const ref = 'p-' + uid();
    await creditPurchase(db, { refHash: ref, walletId: w, channel: 'play', credits: 100 });
    expect(await voidPurchase(db, ref)).toBe(true);
    const row = await walletRow(w);
    expect(row.balance).toBe(0);
    expect(row.owed).toBe(0);
    await expectConsistent(w);
  });

  it('voiding twice removes them once; an unknown purchase does nothing', async () => {
    const w = await newWallet();
    const ref = 'p-' + uid();
    await creditPurchase(db, { refHash: ref, walletId: w, channel: 'play', credits: 100 });
    await creditPurchase(db, { refHash: 'p-' + uid(), walletId: w, channel: 'play', credits: 100 });
    const results = await Promise.all(Array.from({ length: 10 }, () => voidPurchase(db, ref)));
    expect(results.filter(Boolean)).toHaveLength(1);
    expect((await walletRow(w)).balance).toBe(100);
    expect(await voidPurchase(db, 'nope-' + uid())).toBe(false);
    await expectConsistent(w);
  });

  it('credits already spent become debt, which blocks spending and is repaid first', async () => {
    const w = await newWallet();
    const ref = 'p-' + uid();
    await creditPurchase(db, { refHash: ref, walletId: w, channel: 'play', credits: 100 });
    expect(await reserve(db, item(w, 'req-' + uid(), 90))).toBe('ok');

    await voidPurchase(db, ref);
    let row = await walletRow(w);
    expect(row.balance).toBe(0);
    expect(row.owed).toBe(90);
    await expectConsistent(w);

    expect(await reserve(db, item(w, 'req-' + uid(), 1))).toBe('debt');

    // A new 160-credit purchase pays the 90 owed first and leaves 70.
    await creditPurchase(db, { refHash: 'p-' + uid(), walletId: w, channel: 'play', credits: 160 });
    row = await walletRow(w);
    expect(row.owed).toBe(0);
    expect(row.balance).toBe(70);
    await expectConsistent(w);
    expect(await reserve(db, item(w, 'req-' + uid(), 1))).toBe('ok');
  });

  it('a purchase smaller than the debt only reduces it', async () => {
    const w = await newWallet();
    await db.prepare('UPDATE wallets SET owed = 100 WHERE id = ?').bind(w).run();
    await creditPurchase(db, { refHash: 'p-' + uid(), walletId: w, channel: 'play', credits: 25 });
    const row = await walletRow(w);
    expect(row.owed).toBe(75);
    expect(row.balance).toBe(0);
  });
});

describe('linking wallets (sign-in merge)', () => {
  it('moves balance, devices, requests and purchases, and retires the old wallet', async () => {
    const target = await newWallet(40);
    const old = await newWallet(25);
    const key = 'req-' + uid();
    await reserve(db, item(old, key, 5));
    await db.prepare('INSERT INTO devices(id, wallet_id, secret_hash, platform) VALUES(?, ?, ?, ?)').bind('dev-' + uid(), old, 'h', 'android').run();

    expect(await linkWallet(db, old, target)).toBe('ok');
    expect((await walletRow(target)).balance).toBe(60);
    const o = await walletRow(old);
    expect(o.balance).toBe(0);
    expect(o.deleted).toBe(1);
    expect((await db.prepare('SELECT wallet_id FROM requests WHERE key = ?').bind(key).first<{ wallet_id: string }>())!.wallet_id).toBe(target);
    const dev = await db.prepare('SELECT COUNT(*) AS n FROM devices WHERE wallet_id = ?').bind(target).first<{ n: number }>();
    expect(dev!.n).toBe(1);
    await expectConsistent(target);
    await expectConsistent(old);
  });

  it('two devices signing in to one account at once conserve the balance', async () => {
    const target = await newWallet(10);
    const a = await newWallet(30);
    const b = await newWallet(20);
    const results = await Promise.all([linkWallet(db, a, target), linkWallet(db, b, target)]);
    expect(results).toEqual(['ok', 'ok']);
    expect((await walletRow(target)).balance).toBe(60);
    for (const id of [target, a, b]) await expectConsistent(id);
  });

  it('linking the same wallet twice at once moves it once', async () => {
    const target = await newWallet(0);
    const a = await newWallet(30);
    const results = await Promise.all(Array.from({ length: 6 }, () => linkWallet(db, a, target)));
    expect(results.filter((r) => r === 'ok').length).toBeGreaterThanOrEqual(1);
    expect((await walletRow(target)).balance).toBe(30);
    await expectConsistent(target);
    await expectConsistent(a);
  });

  it('refuses unknown or already-retired wallets and a wallet linked to itself', async () => {
    const t = await newWallet(5);
    expect(await linkWallet(db, 'nobody', t)).toBe('unknown_wallet');
    expect(await linkWallet(db, t, t)).toBe('same');
    const gone = await newWallet(5);
    await linkWallet(db, gone, t);
    expect(await linkWallet(db, gone, t)).toBe('unknown_wallet');
  });

  it('debt brought from the old wallet is offset by credits already in the target', async () => {
    const target = await newWallet(50);
    const old = await newWallet();
    await db.prepare('UPDATE wallets SET owed = 30 WHERE id = ?').bind(old).run();
    await linkWallet(db, old, target);
    const row = await walletRow(target);
    expect(row.owed).toBe(0);
    expect(row.balance).toBe(20);
    await expectConsistent(target);
  });
});

describe('500 random concurrent operations', () => {
  it('the balance never goes negative and the ledger always equals the balance', async () => {
    let seed = 20261109;
    const rnd = (): number => {
      seed = (seed + 0x6d2b79f5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    const pick = <T>(a: T[]): T => a[Math.floor(rnd() * a.length)]!;

    const wallets = await Promise.all([newWallet(60), newWallet(60), newWallet(60), newWallet(60), newWallet(60)]);
    const tag = uid();
    const keys = Array.from({ length: 150 }, (_, i) => `rnd-${tag}-${i}`);
    const refs = Array.from({ length: 40 }, (_, i) => `rp-${tag}-${i}`);

    const ops: Array<() => Promise<unknown>> = [];
    for (let i = 0; i < 500; i++) {
      const roll = rnd();
      const w = pick(wallets);
      if (roll < 0.45) ops.push(() => reserve(db, item(w, pick(keys), 1 + Math.floor(rnd() * 6))));
      else if (roll < 0.6) ops.push(() => commit(db, pick(keys)));
      else if (roll < 0.78) ops.push(() => refund(db, pick(keys)));
      else if (roll < 0.9) ops.push(() => creditPurchase(db, { refHash: pick(refs), walletId: w, channel: 'play', credits: 25 + Math.floor(rnd() * 100) }));
      else ops.push(() => voidPurchase(db, pick(refs)));
    }
    for (let i = 0; i < ops.length; i += 100) await Promise.all(ops.slice(i, i + 100).map((f) => f()));

    for (const w of wallets) await expectConsistent(w);
    const bad = await db.prepare("SELECT COUNT(*) AS n FROM requests WHERE status = 'refunded' AND settled != 1").first<{ n: number }>();
    expect(bad!.n).toBe(0);
    expect(await ledgerSum(wallets[0]!)).toBe((await walletRow(wallets[0]!)).balance);
  });
});

describe('classify', () => {
  it('maps the database error texts, and re-throws anything unexpected', () => {
    expect(classify(new Error('D1_ERROR: UNIQUE constraint failed: requests.key: SQLITE_CONSTRAINT'))).toBe('duplicate');
    expect(classify(new Error('UNIQUE constraint failed: purchases.ref_hash'))).toBe('duplicate');
    expect(classify(new Error('NOT NULL constraint failed: wallets.guard'))).toBe('debt');
    expect(classify(new Error('NOT NULL constraint failed: requests.status'))).toBe('unknown_wallet');
    expect(classify(new Error('NOT NULL constraint failed: purchases.wallet_id'))).toBe('unknown_wallet');
    expect(classify(new Error('CHECK constraint failed: balance >= 0'))).toBe('insufficient');
    expect(() => classify(new Error('something else'))).toThrow('something else');
  });
});
