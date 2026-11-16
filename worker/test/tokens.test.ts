import { describe, expect, it } from 'vitest';
import { hashValue, newLinkToken, newLoginCode, newReferralCode, normalizeCode } from '../src/lib/tokens';

describe('tokens and codes', () => {
  it('link tokens are 43 URL-safe characters and never repeat', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 200; i++) {
      const t = newLinkToken();
      expect(t).toMatch(/^[A-Za-z0-9_-]{43}$/);
      seen.add(t);
    }
    expect(seen.size).toBe(200);
  });

  it('login codes are six digits, including leading zeros', () => {
    for (let i = 0; i < 300; i++) expect(newLoginCode()).toMatch(/^\d{6}$/);
  });

  it('referral codes are eight symbols without look-alikes', () => {
    for (let i = 0; i < 100; i++) expect(newReferralCode()).toMatch(/^[A-HJ-NP-Z2-9]{8}$/);
  });

  it('normalizes what people type', () => {
    expect(normalizeCode(' ab3d-ef 7g ')).toBe('AB3DEF7G');
  });

  it('hashes are keyed: stable for one pepper, different for another', async () => {
    const a = await hashValue('123456', 'pepper-one');
    expect(a).toMatch(/^[0-9a-f]{64}$/);
    expect(await hashValue('123456', 'pepper-one')).toBe(a);
    expect(await hashValue('123456', 'pepper-two')).not.toBe(a);
    expect(await hashValue('123457', 'pepper-one')).not.toBe(a);
  });
});
