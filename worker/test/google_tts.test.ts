import { env } from 'cloudflare:workers';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Env } from '../src/env';
import { clearTokenCache, serviceAccountToken, synthesizeGoogle } from '../src/lib/google_tts';

const b64 = (b: ArrayBuffer | Uint8Array): string => {
  let s = '';
  for (const x of new Uint8Array(b as ArrayBuffer)) s += String.fromCharCode(x);
  return btoa(s);
};
const unb64url = (s: string): Uint8Array => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));

let e: Env;
let publicKey: CryptoKey;

beforeEach(async () => {
  clearTokenCache();
  const pair = (await crypto.subtle.generateKey({ name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }, true, ['sign', 'verify'])) as CryptoKeyPair;
  publicKey = pair.publicKey;
  const pem = `-----BEGIN PRIVATE KEY-----\n${b64((await crypto.subtle.exportKey('pkcs8', pair.privateKey)) as ArrayBuffer).replace(/(.{64})/g, '$1\n')}\n-----END PRIVATE KEY-----\n`;
  e = { ...(env as unknown as Env), GOOGLE_SA_JSON: JSON.stringify({ client_email: 'svc@videomilla.iam.example', private_key: pem }) } as Env;
});
afterEach(() => vi.unstubAllGlobals());

type Call = { url: string; init: RequestInit };
function stub(handler: (c: Call) => Response): Call[] {
  const calls: Call[] = [];
  vi.stubGlobal('fetch', async (url: string, init: RequestInit = {}) => {
    const c = { url: String(url), init };
    calls.push(c);
    return handler(c);
  });
  return calls;
}

describe('service account token', () => {
  it('signs a valid RS256 JWT with the right claims and returns the access token', async () => {
    const calls = stub(() => Response.json({ access_token: 'tok-1', expires_in: 3600 }));
    expect(await serviceAccountToken(e, 'scope-a')).toBe('tok-1');

    const form = new URLSearchParams(String(calls[0]!.init.body));
    expect(form.get('grant_type')).toBe('urn:ietf:params:oauth:grant-type:jwt-bearer');
    const [h, c, s] = form.get('assertion')!.split('.') as [string, string, string];
    expect(JSON.parse(new TextDecoder().decode(unb64url(h)))).toEqual({ alg: 'RS256', typ: 'JWT' });
    const claims = JSON.parse(new TextDecoder().decode(unb64url(c)));
    expect(claims).toMatchObject({ iss: 'svc@videomilla.iam.example', scope: 'scope-a', aud: 'https://oauth2.googleapis.com/token' });
    expect(claims.exp - claims.iat).toBe(3600);
    // The signature must verify with the matching public key: this proves the signing code, not just that it ran.
    const ok = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', publicKey, unb64url(s), new TextEncoder().encode(`${h}.${c}`));
    expect(ok).toBe(true);
  });

  it('caches a token per scope', async () => {
    const calls = stub(() => Response.json({ access_token: 'tok', expires_in: 3600 }));
    await serviceAccountToken(e, 'scope-a');
    await serviceAccountToken(e, 'scope-a');
    expect(calls).toHaveLength(1);
    await serviceAccountToken(e, 'scope-b');
    expect(calls).toHaveLength(2);
  });

  it('fails cleanly on a broken service account or a refused token request', async () => {
    await expect(serviceAccountToken({ ...e, GOOGLE_SA_JSON: 'not json' } as Env, 's')).rejects.toMatchObject({ code: 'bad_service_account' });
    await expect(serviceAccountToken({ ...e, GOOGLE_SA_JSON: '{}' } as Env, 's')).rejects.toMatchObject({ code: 'bad_service_account' });
    stub(() => new Response('denied', { status: 401 }));
    await expect(serviceAccountToken(e, 's')).rejects.toMatchObject({ code: 'token_failed', status: 401 });
  });
});

describe('Text-to-Speech', () => {
  it('sends the text and voice with the bearer token and decodes the MP3', async () => {
    const calls = stub((c) => (c.url.includes('oauth2') ? Response.json({ access_token: 'tok-9', expires_in: 3600 }) : Response.json({ audioContent: btoa('MP3DATA') })));
    const out = await synthesizeGoogle(e, { text: 'שלום', languageCode: 'he-IL', voice: 'he-IL-Wavenet-A' });
    expect(new TextDecoder().decode(out)).toBe('MP3DATA');
    const tts = calls[1]!;
    expect(tts.url).toBe('https://texttospeech.googleapis.com/v1/text:synthesize');
    expect(new Headers(tts.init.headers).get('Authorization')).toBe('Bearer tok-9');
    expect(JSON.parse(tts.init.body as string)).toEqual({ input: { text: 'שלום' }, voice: { languageCode: 'he-IL', name: 'he-IL-Wavenet-A' }, audioConfig: { audioEncoding: 'MP3' } });
  });

  it('omits the voice name when none is chosen, and errors on an empty answer', async () => {
    const calls = stub((c) => (c.url.includes('oauth2') ? Response.json({ access_token: 't', expires_in: 3600 }) : Response.json({})));
    await expect(synthesizeGoogle(e, { text: 'hi', languageCode: 'hi-IN' })).rejects.toMatchObject({ code: 'no_audio' });
    expect(JSON.parse(calls[1]!.init.body as string).voice).toEqual({ languageCode: 'hi-IN' });
  });
});
