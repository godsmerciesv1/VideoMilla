import { env } from 'cloudflare:workers';
import { describe, expect, it } from 'vitest';
import { LEASE_SECONDS, getRequest, isValidKey, markDelivered, resolveRetry } from '../src/lib/idempotency';
import { commit, refund, reserve } from '../src/lib/ledger';
import { newWallet, uid } from './helpers';

const db = env.DB;
const make = async (credits = 50) => {
  const w = await newWallet(credits);
  const key = 'idem-' + uid();
  await reserve(db, { key, walletId: w, action: 'picture', cost: 1 });
  return { w, key };
};

describe('isValidKey', () => {
  it('accepts 8 to 96 letters, digits, colon, underscore and hyphen', () => {
    expect(isValidKey('proj-1:shot_2:clip:0')).toBe(true);
    expect(isValidKey('abcdefgh')).toBe(true);
    expect(isValidKey('a'.repeat(96))).toBe(true);
  });
  it('rejects everything else', () => {
    expect(isValidKey('short')).toBe(false);
    expect(isValidKey('a'.repeat(97))).toBe(false);
    expect(isValidKey('has space here')).toBe(false);
    expect(isValidKey("quote'quote")).toBe(false);
    expect(isValidKey('slash/slash1')).toBe(false);
    expect(isValidKey(12345678)).toBe(false);
    expect(isValidKey(undefined)).toBe(false);
  });
});

describe('resolveRetry (blueprint Section 23.4)', () => {
  it('an unknown key is new', async () => {
    const w = await newWallet(5);
    expect(await resolveRetry(db, 'idem-' + uid(), w)).toEqual({ kind: 'new' });
  });

  it('a fresh reservation is in progress', async () => {
    const { w, key } = await make();
    expect((await resolveRetry(db, key, w)).kind).toBe('in_progress');
  });

  it('after 120 seconds exactly one caller takes it over', async () => {
    const { w, key } = await make();
    const row = (await getRequest(db, key))!;
    const later = row.updated_at + LEASE_SECONDS + 5;
    const results = await Promise.all(Array.from({ length: 8 }, () => resolveRetry(db, key, w, later)));
    expect(results.filter((r) => r.kind === 'takeover')).toHaveLength(1);
    expect(results.filter((r) => r.kind === 'in_progress')).toHaveLength(7);
  });

  it('exactly at the lease limit it is still in progress', async () => {
    const { w, key } = await make();
    const row = (await getRequest(db, key))!;
    expect((await resolveRetry(db, key, w, row.updated_at + LEASE_SECONDS)).kind).toBe('in_progress');
  });

  it('a committed request is served again, without a second charge', async () => {
    const { w, key } = await make();
    await commit(db, key);
    const d = await resolveRetry(db, key, w);
    expect(d.kind).toBe('serve_committed');
    expect(await reserve(db, { key, walletId: w, action: 'picture', cost: 1 })).toBe('duplicate');
  });

  it('delivered and refunded are reported as such', async () => {
    const a = await make();
    await commit(db, a.key);
    expect(await markDelivered(db, a.key, a.w)).toBe(true);
    expect(await markDelivered(db, a.key, a.w)).toBe(false);
    expect((await resolveRetry(db, a.key, a.w)).kind).toBe('delivered');

    const b = await make();
    await refund(db, b.key);
    expect((await resolveRetry(db, b.key, b.w)).kind).toBe('refunded');
  });

  it('a key that belongs to another wallet is refused', async () => {
    const { key } = await make();
    const other = await newWallet(5);
    await expect(resolveRetry(db, key, other)).rejects.toMatchObject({ status: 409 });
  });

  it('only the owner can mark a result delivered', async () => {
    const { w, key } = await make();
    await commit(db, key);
    const other = await newWallet(1);
    expect(await markDelivered(db, key, other)).toBe(false);
    expect(await markDelivered(db, key, w)).toBe(true);
  });
});
