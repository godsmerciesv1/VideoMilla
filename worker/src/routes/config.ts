import type { Env } from '../env';
import { json } from '../lib/http';

type ConfigMap = Record<string, unknown>;

/** Only these keys reach the apps. Models and provider routes stay on the server. */
const CLIENT_KEYS = [
  'flags',
  'credit_costs',
  'packs_play',
  'packs_polar',
  'languages_enabled',
  'voice_routes',
  'min_app_version',
  'caps',
  'fair_use',
  'referral',
  'auth',
] as const;

const CACHE_MS = 60_000;
let cache: { at: number; value: ConfigMap } | null = null;

export function clearConfigCache(): void {
  cache = null;
}

/** All config rows, parsed from JSON, cached for 60 seconds in memory. */
export async function loadConfig(db: D1Database): Promise<ConfigMap> {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.value;
  const rows = await db.prepare('SELECT key, value FROM config').all<{ key: string; value: string }>();
  const value: ConfigMap = {};
  for (const r of rows.results) {
    try {
      value[r.key] = JSON.parse(r.value);
    } catch {
      value[r.key] = r.value;
    }
  }
  cache = { at: Date.now(), value };
  return value;
}

export async function cfg<T = unknown>(db: D1Database, key: string): Promise<T | undefined> {
  return (await loadConfig(db))[key] as T | undefined;
}

/** `GET /v1/config`: prices, packs, caps, flags and languages. The apps never hard-code these. */
export async function handleConfig(env: Env): Promise<Response> {
  const all = await loadConfig(env.DB);
  const out: ConfigMap = { version: all.config_version ?? 0 };
  for (const k of CLIENT_KEYS) if (k in all) out[k] = all[k];
  return json(out);
}
