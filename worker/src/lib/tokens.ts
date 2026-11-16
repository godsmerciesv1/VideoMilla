import { CODE_ALPHABET, randomBase64Url } from './crypto';

const encoder = new TextEncoder();

/** 32 random bytes as URL-safe text: the link in a login email. Only its keyed hash is stored. */
export function newLinkToken(): string {
  return randomBase64Url(32);
}

/** Six digits. The small bias (under 0.03%) does not matter: a code dies after five wrong tries. */
export function newLoginCode(): string {
  const n = crypto.getRandomValues(new Uint32Array(1))[0]! % 1_000_000;
  return String(n).padStart(6, '0');
}

/** Eight symbols from the look-alike-free alphabet. `256 % 32 === 0`, so there is no bias. */
export function newReferralCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  return Array.from(bytes, (b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join('');
}

/** Normalizes what a person typed: trimmed, upper-case, spaces and dashes removed. */
export function normalizeCode(input: string): string {
  return input.replace(/[\s-]+/g, '').toUpperCase();
}

/** HMAC-SHA-256(value, PEPPER) as hex. Tokens and codes are stored only in this form. */
export async function hashValue(value: string, pepper: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', encoder.encode(pepper), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(value)));
  let out = '';
  for (const b of sig) out += b.toString(16).padStart(2, '0');
  return out;
}
