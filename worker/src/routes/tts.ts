import type { Env } from '../env';
import type { Auth } from '../lib/auth';
import { HttpError, json, readJson } from '../lib/http';
import { isValidKey } from '../lib/idempotency';
import { runPaid } from '../lib/job';
import { moderateAll } from '../lib/moderation';
import { b64ToBytes, bytesToB64, spendCaps } from '../lib/provider_router';
import { synthesizeGoogle } from '../lib/google_tts';
import { hit } from '../lib/rate_limit';
import { releaseSpend, reserveSpend } from '../lib/spend_cap';
import { creditCosts, walletInfo } from '../lib/wallet_info';
import { cfg } from './config';

const MAX_CHARS = 600;
const MAX_PREVIEW_CHARS = 80;
/** Google Text-to-Speech cost estimate per character, in millionths of a dollar (the dearest standard tier, rounded up). */
const GOOGLE_MICRO_PER_CHAR = 30;
const WORKERS_AI_TTS_EST_MICRO = 500;
const VOICE = /^[A-Za-z0-9._:-]{1,80}$/;

/** App language codes to the codes Google Text-to-Speech expects. Confirmed per language at gate G7. */
const GOOGLE_LANG: Record<string, string> = {
  en: 'en-US', pt_BR: 'pt-BR', es: 'es-US', hi: 'hi-IN', id: 'id-ID', ar: 'ar-XA', tr: 'tr-TR', ru: 'ru-RU', ja: 'ja-JP', ko: 'ko-KR', de: 'de-DE',
  he: 'he-IL', fr: 'fr-FR', it: 'it-IT', vi: 'vi-VN', th: 'th-TH', fil: 'fil-PH', bn: 'bn-IN', ur: 'ur-IN', zh_Hant: 'cmn-TW',
};

interface VoiceEntry {
  provider?: string;
  model?: string;
  /** Allowed voice names per tier. A client may only choose from these (it cannot pick an arbitrary dearer voice). */
  voices?: { standard?: string[]; studio?: string[] };
}
type VoiceRoutes = Record<string, VoiceEntry>;

interface TtsBody {
  text?: unknown;
  language?: unknown;
  voice?: unknown;
  studio?: unknown;
  preview?: unknown;
  charge_seconds?: unknown;
  project_id?: unknown;
}

type Runner = { run(model: string, input: unknown): Promise<unknown> };

async function toBytes(out: unknown): Promise<Uint8Array | null> {
  try {
    if (out instanceof Response) return new Uint8Array(await out.arrayBuffer());
    if (out instanceof ReadableStream) return new Uint8Array(await new Response(out).arrayBuffer());
    if (out instanceof ArrayBuffer) return new Uint8Array(out);
    if (out instanceof Uint8Array) return out;
    const a = (out as { audio?: unknown } | null)?.audio;
    if (typeof a === 'string') return b64ToBytes(a);
    if (typeof out === 'string') return b64ToBytes(out);
  } catch {
    /* unrecognized */
  }
  return null;
}

function audioMime(b: Uint8Array): string | null {
  if (b.length < 64) return null;
  if (b[0] === 0x49 && b[1] === 0x44 && b[2] === 0x33) return 'audio/mpeg'; // ID3
  if (b[0] === 0xff && (b[1]! & 0xe0) === 0xe0) return 'audio/mpeg'; // MP3 frame
  if (b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46) return 'audio/wav';
  return null;
}

/**
 * `POST /v1/tts` (blueprint F093): narration or a character line.
 *  - A preview (short fixed text) works before any purchase, rate limited.
 *  - Everything else needs a purchase on the wallet: no valid flow reaches narration without analysing first,
 *    and an open endpoint would be a free cost vector (decision D-119).
 *  - The standard voice costs no credits. A studio voice costs 1 credit per 9 s of video, minimum 2, charged once per
 *    video: the first line carries `charge_seconds` and an idempotency key; later lines carry neither.
 *  - Voice names come from `voice_routes` in config; the route tries Workers AI first where configured and falls
 *    back to Google, within the daily Google budget.
 */
export async function handleTts(req: Request, env: Env, auth: Auth): Promise<Response> {
  const b = await readJson<TtsBody>(req, 8_000);
  const preview = b.preview === true;
  const text = typeof b.text === 'string' ? b.text.trim() : '';
  if (!text || text.length > (preview ? MAX_PREVIEW_CHARS : MAX_CHARS)) throw new HttpError(400, 'invalid_text');
  if (typeof b.language !== 'string' || !GOOGLE_LANG[b.language]) throw new HttpError(400, 'invalid_language');
  const language = b.language;
  const enabled = (await cfg<string[]>(env.DB, 'languages_enabled')) ?? [];
  if (!enabled.includes(language)) throw new HttpError(400, 'language_not_enabled');
  if (b.voice !== undefined && (typeof b.voice !== 'string' || !VOICE.test(b.voice))) throw new HttpError(400, 'invalid_voice');
  const studio = b.studio === true;
  if (preview && studio) throw new HttpError(400, 'invalid_preview');

  let chargeSeconds = 0;
  if (b.charge_seconds !== undefined) {
    if (!studio || typeof b.charge_seconds !== 'number' || !Number.isInteger(b.charge_seconds) || b.charge_seconds < 1 || b.charge_seconds > 90) throw new HttpError(400, 'invalid_charge');
    chargeSeconds = b.charge_seconds;
  }

  if (preview) {
    if (!(await hit(env.DB, `ttsprev:${auth.walletId}`, 20, 3600)).allowed) throw new HttpError(429, 'rate_limited');
  } else {
    const wallet = await walletInfo(env.DB, auth.walletId);
    if (!wallet) throw new HttpError(401, 'unauthorized');
    if (!wallet.everPurchased) throw new HttpError(402, 'purchase_required');
    if (!(await hit(env.DB, `tts:${auth.walletId}`, 600, 3600)).allowed) throw new HttpError(429, 'rate_limited');
  }
  if (!(await moderateAll(env, { script: text, language })).allowed) throw new HttpError(422, 'moderation_blocked');

  const routes = (await cfg<VoiceRoutes>(env.DB, 'voice_routes')) ?? {};
  const entry = routes[language] ?? routes[language.split('_')[0]!] ?? routes.default ?? { provider: 'google' };
  const tier = studio ? 'studio' : 'standard';
  const allowed = entry.voices?.[tier] ?? [];
  if (studio && allowed.length === 0) throw new HttpError(400, 'studio_unavailable');
  const voice = typeof b.voice === 'string' && allowed.includes(b.voice) ? b.voice : allowed[0];

  const work = async (charged: number): Promise<Response> => {
    const caps = await spendCaps(env.DB);
    let bytes: Uint8Array | null = null;
    // Workers AI first, where this language is configured for it. Its answer shape is confirmed at G7; anything unrecognized falls through.
    if (entry.provider === 'workers_ai' && entry.model && !studio) {
      try {
        bytes = await toBytes(await (env.AI as unknown as Runner).run(entry.model, { text, ...(voice ? { speaker: voice } : {}) }));
        if (bytes && !audioMime(bytes)) bytes = null;
      } catch {
        bytes = null;
      }
    }
    if (!bytes) {
      const est = text.length * GOOGLE_MICRO_PER_CHAR;
      if (!(await reserveSpend(env.DB, 'google_chars', est, caps.googleCharsMicro))) throw new HttpError(503, 'busy');
      try {
        bytes = await synthesizeGoogle(env, { text, languageCode: GOOGLE_LANG[language]!, voice });
      } catch {
        await releaseSpend(env.DB, 'google_chars', est);
        throw new HttpError(503, 'busy');
      }
    }
    return json({ audio: bytesToB64(bytes), mime: audioMime(bytes) ?? 'audio/mpeg', charged });
  };

  if (chargeSeconds > 0) {
    const key = req.headers.get('X-Idempotency-Key') ?? '';
    if (!isValidKey(key)) throw new HttpError(400, 'invalid_key');
    const costs = await creditCosts(env.DB);
    const cost = Math.max(costs.studio_voice_min ?? 2, Math.ceil(chargeSeconds / 9) * (costs.studio_voice_per_9s ?? 1));
    return runPaid(
      env,
      { key, walletId: auth.walletId, deviceId: auth.deviceId, action: 'studio_voice', projectId: typeof b.project_id === 'string' ? b.project_id.slice(0, 64) : undefined, estMicro: WORKERS_AI_TTS_EST_MICRO, price: async () => cost },
      work,
    );
  }
  return work(0);
}
