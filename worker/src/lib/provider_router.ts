import type { Env } from '../env';
import { cfg } from '../routes/config';
import { reserveSpend, spentToday, type SpendKind } from './spend_cap';

/**
 * The only place provider order lives (blueprint F086). Routes, caps and model ids all come from
 * D1 config, never from the apps. Prices are per action, so users see one price whichever provider runs.
 */
export class ProviderError extends Error {
  constructor(
    readonly provider: string,
    /** HTTP status, or 0 for a network failure. */
    readonly status: number,
    readonly code: string = 'provider_error',
  ) {
    super(`${provider}: ${code} (${status})`);
  }
  /** Worth trying again later (network, timeout, rate limit, server error). */
  get retriable(): boolean {
    return this.status === 0 || this.status === 408 || this.status === 429 || this.status >= 500;
  }
}

export interface ClipInput {
  prompt: string;
  /** The approved keyframe, JPEG bytes. */
  firstFrame: Uint8Array;
  /** Optional line audio for a talking shot. */
  audio?: Uint8Array;
  seconds: number;
  aspect?: '9:16' | '16:9';
  seed?: number;
}

export type ClipProvider = 'segmind' | 'pruna' | 'gemini';

export interface ClipRoute {
  provider: ClipProvider;
  model: string;
  costPerSecondMicro: number;
  role: 'primary' | 'fallback';
  acceptsAudio: boolean;
}

const PROVIDERS: ReadonlySet<string> = new Set(['segmind', 'pruna', 'gemini']);

/** The ordered `clip_routes` list. Malformed entries are ignored rather than trusted. */
export async function clipRoutes(db: D1Database): Promise<ClipRoute[]> {
  const raw = await cfg<unknown>(db, 'clip_routes');
  if (!Array.isArray(raw)) return [];
  const out: ClipRoute[] = [];
  for (const r of raw) {
    if (typeof r !== 'object' || r === null) continue;
    const o = r as Record<string, unknown>;
    if (typeof o.provider !== 'string' || !PROVIDERS.has(o.provider)) continue;
    if (typeof o.model !== 'string' || typeof o.cost_per_second_micro !== 'number' || o.cost_per_second_micro < 0) continue;
    out.push({
      provider: o.provider as ClipProvider,
      model: o.model,
      costPerSecondMicro: o.cost_per_second_micro,
      role: o.role === 'fallback' ? 'fallback' : 'primary',
      acceptsAudio: o.accepts_audio === true,
    });
  }
  return out;
}

export interface Caps {
  videoMicro: number;
  workersAiMicro: number;
  fallbackMicro: number;
  googleCharsMicro: number;
}

const usdToMicro = (usd: unknown, fallback: number): number =>
  typeof usd === 'number' && usd >= 0 ? Math.round(usd * 1_000_000) : fallback;

/**
 * Daily spend caps in millionths of a dollar. The configured floors ($10 video, $3.30 Workers AI, $3 fallback) are
 * raised by `caps_effective`, which the daily cron writes from recent sales (decision D-111); a cap never falls below its floor.
 */
export async function spendCaps(db: D1Database): Promise<Caps> {
  const c = (await cfg<Record<string, unknown>>(db, 'caps')) ?? {};
  const e = (await cfg<Record<string, unknown>>(db, 'caps_effective')) ?? {};
  const best = (k: string, d: number): number => Math.max(usdToMicro(c[k], d), usdToMicro(e[k], 0));
  return {
    videoMicro: best('video_usd', 10_000_000),
    workersAiMicro: best('workers_ai_usd', 3_300_000),
    fallbackMicro: usdToMicro(c.fallback_usd, 3_000_000),
    googleCharsMicro: usdToMicro(c.google_chars_usd, 2_000_000),
  };
}

export interface PickedRoute {
  route: ClipRoute;
  estMicro: number;
  /** Which daily counter was charged, so a failed job can release it. */
  kind: SpendKind;
  /** The route cannot take supplied audio: the caller makes the shot voice-over on a motion shot. */
  dropAudio: boolean;
}

/**
 * Picks the first route whose daily cap still has room, reserving the expected cost atomically.
 * Returns null when every route is out of budget (the caller answers "busy" and charges nothing).
 */
export async function pickClipProvider(
  env: Env,
  i: { seconds: number; hasAudio: boolean; skip?: ClipProvider[] },
): Promise<PickedRoute | null> {
  const [routes, caps] = await Promise.all([clipRoutes(env.DB), spendCaps(env.DB)]);
  for (const route of routes) {
    if (i.skip?.includes(route.provider)) continue;
    const estMicro = Math.round(route.costPerSecondMicro * i.seconds);
    const kind: SpendKind = route.role === 'fallback' ? 'fallback' : 'video';
    const cap = kind === 'fallback' ? caps.fallbackMicro : caps.videoMicro;
    if (await reserveSpend(env.DB, kind, estMicro, cap)) {
      return { route, estMicro, kind, dropAudio: i.hasAudio && !route.acceptsAudio };
    }
  }
  return null;
}

/**
 * Whether at least one route still has budget for [seconds] of clip, WITHOUT reserving it. The submit route uses this
 * to answer "busy" before any credits move; the real reservation happens when the job picks its provider.
 */
export async function clipBudgetAvailable(env: Env, seconds: number): Promise<boolean> {
  const [routes, caps] = await Promise.all([clipRoutes(env.DB), spendCaps(env.DB)]);
  for (const route of routes) {
    const est = Math.round(route.costPerSecondMicro * seconds);
    const kind: SpendKind = route.role === 'fallback' ? 'fallback' : 'video';
    const cap = kind === 'fallback' ? caps.fallbackMicro : caps.videoMicro;
    if ((await spentToday(env.DB, kind)) + est <= cap) return true;
  }
  return false;
}

const DEFAULT_MODELS = {
  text_default: '@cf/google/gemma-4-26b-a4b-it',
  text_fallback: '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
  image: '@cf/black-forest-labs/flux-2-klein-4b',
  image_fallback: '@cf/black-forest-labs/flux-2-klein-9b',
  vision: '@cf/google/gemma-4-26b-a4b-it',
  vision_fallback: '@cf/meta/llama-4-scout-17b-16e-instruct',
} as const;

async function modelMap(db: D1Database): Promise<Record<string, unknown>> {
  return (await cfg<Record<string, unknown>>(db, 'models')) ?? {};
}
const pick = (m: Record<string, unknown>, key: keyof typeof DEFAULT_MODELS): string =>
  typeof m[key] === 'string' && m[key] ? (m[key] as string) : DEFAULT_MODELS[key];

export async function pickImageModels(db: D1Database): Promise<{ primary: string; fallback: string }> {
  const m = await modelMap(db);
  return { primary: pick(m, 'image'), fallback: pick(m, 'image_fallback') };
}

/** Text models in the order to try: the language's own model (or the default), then the fallback. */
export async function pickTextModels(db: D1Database, language: string): Promise<string[]> {
  const m = await modelMap(db);
  const perLanguage = (await cfg<Record<string, unknown>>(db, 'language_models')) ?? {};
  const own = typeof perLanguage[language] === 'string' ? (perLanguage[language] as string) : pick(m, 'text_default');
  return [...new Set([own, pick(m, 'text_fallback')])];
}

/** Vision models in the order to try (D-102: Gemma 4 first, Scout as the fallback). */
export async function pickVisionModels(db: D1Database): Promise<string[]> {
  const m = await modelMap(db);
  return [...new Set([pick(m, 'vision'), pick(m, 'vision_fallback')])];
}

// ---- shared byte helpers for the provider adapters ----

export function bytesToB64(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

export function b64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** An MP4 starts with a box whose type `ftyp` sits at bytes 4 to 8. Anything else is a bad provider answer. */
export function looksLikeMp4(bytes: Uint8Array): boolean {
  return bytes.length > 1024 && bytes[4] === 0x66 && bytes[5] === 0x74 && bytes[6] === 0x79 && bytes[7] === 0x70;
}

export function requireMp4(provider: string, bytes: Uint8Array): Uint8Array {
  if (!looksLikeMp4(bytes)) throw new ProviderError(provider, 502, 'bad_output');
  return bytes;
}

/** fetch that turns a network failure into a retriable ProviderError. */
export async function providerFetch(provider: string, url: string, init: RequestInit): Promise<Response> {
  try {
    return await fetch(url, init);
  } catch {
    throw new ProviderError(provider, 0, 'network');
  }
}

export const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));
