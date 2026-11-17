import type { Env } from '../env';
import { b64ToBytes, ProviderError, providerFetch } from './provider_router';

/**
 * Google Cloud access without a library: a service-account JWT signed with Web Crypto (RS256), exchanged
 * for an access token. Used for Text-to-Speech here and for the Play Developer API in F110.
 */
interface ServiceAccount {
  client_email: string;
  private_key: string;
  token_uri?: string;
}

const tokens = new Map<string, { token: string; expiresAt: number }>();

export function clearTokenCache(): void {
  tokens.clear();
}

const enc = new TextEncoder();
function b64url(bytes: Uint8Array | string): string {
  const b = typeof bytes === 'string' ? enc.encode(bytes) : bytes;
  let s = '';
  for (const x of b) s += String.fromCharCode(x);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function importKey(pem: string): Promise<CryptoKey> {
  const body = pem.replace(/-----(BEGIN|END) PRIVATE KEY-----/g, '').replace(/\s+/g, '');
  return crypto.subtle.importKey('pkcs8', b64ToBytes(body), { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
}

export async function serviceAccountToken(env: Env, scope: string): Promise<string> {
  const cached = tokens.get(scope);
  if (cached && cached.expiresAt > Date.now() + 60_000) return cached.token;

  let sa: ServiceAccount;
  try {
    sa = JSON.parse(env.GOOGLE_SA_JSON) as ServiceAccount;
  } catch {
    throw new ProviderError('google', 500, 'bad_service_account');
  }
  if (!sa.client_email || !sa.private_key) throw new ProviderError('google', 500, 'bad_service_account');
  const aud = sa.token_uri ?? 'https://oauth2.googleapis.com/token';
  const iat = Math.floor(Date.now() / 1000);
  const head = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claims = b64url(JSON.stringify({ iss: sa.client_email, scope, aud, iat, exp: iat + 3600 }));
  const sig = new Uint8Array(await crypto.subtle.sign('RSASSA-PKCS1-v1_5', await importKey(sa.private_key), enc.encode(`${head}.${claims}`)));

  const res = await providerFetch('google', aud, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${head}.${claims}.${b64url(sig)}` }),
  });
  if (!res.ok) throw new ProviderError('google', res.status, 'token_failed');
  const j = (await res.json().catch(() => null)) as { access_token?: string; expires_in?: number } | null;
  if (!j?.access_token) throw new ProviderError('google', 502, 'no_token');
  tokens.set(scope, { token: j.access_token, expiresAt: Date.now() + (j.expires_in ?? 3600) * 1000 });
  return j.access_token;
}

export interface GoogleVoice {
  text: string;
  languageCode: string;
  /** A specific voice name such as a Chirp or WaveNet voice; omitted lets Google choose for the language. */
  voice?: string;
}

/** One narration or line as MP3 bytes. */
export async function synthesizeGoogle(env: Env, v: GoogleVoice): Promise<Uint8Array> {
  const token = await serviceAccountToken(env, 'https://www.googleapis.com/auth/cloud-platform');
  const res = await providerFetch('google', 'https://texttospeech.googleapis.com/v1/text:synthesize', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      input: { text: v.text },
      voice: { languageCode: v.languageCode, ...(v.voice ? { name: v.voice } : {}) },
      audioConfig: { audioEncoding: 'MP3' },
    }),
  });
  if (!res.ok) throw new ProviderError('google', res.status, 'tts_failed');
  const j = (await res.json().catch(() => null)) as { audioContent?: string } | null;
  if (!j?.audioContent) throw new ProviderError('google', 502, 'no_audio');
  return b64ToBytes(j.audioContent);
}
