import type { Env } from '../env';
import { cfg } from '../routes/config';

/**
 * Temporary clip storage (blueprint 19, 23.7). R2 is primary; the free KV namespace is the fallback if R2 fails
 * (decision D-080). Everything here is deleted after `clip_retention_hours` (48, decision D-099): the daily cron
 * deletes old R2 objects, and KV expires its own.
 */
export const CLIP_MIME = 'video/mp4';

export async function retentionHours(db: D1Database): Promise<number> {
  const v = await cfg<unknown>(db, 'clip_retention_hours');
  return typeof v === 'number' && v >= 1 && v <= 24 * 14 ? v : 48;
}

export async function putObject(env: Env, key: string, bytes: Uint8Array | string, contentType?: string): Promise<void> {
  try {
    await env.CLIPS.put(key, bytes, contentType ? { httpMetadata: { contentType } } : undefined);
    return;
  } catch {
    /* fall through to KV */
  }
  const ttl = Math.max(60, (await retentionHours(env.DB)) * 3600);
  await env.CLIPS_KV.put(key, bytes, { expirationTtl: ttl });
}

export async function getBytes(env: Env, key: string): Promise<Uint8Array | null> {
  try {
    const o = await env.CLIPS.get(key);
    if (o) return new Uint8Array(await o.arrayBuffer());
  } catch {
    /* try KV */
  }
  const kv = await env.CLIPS_KV.get(key, 'arrayBuffer');
  return kv ? new Uint8Array(kv) : null;
}

/** Total size in bytes, or null if the object is gone. */
export async function objectSize(env: Env, key: string): Promise<number | null> {
  try {
    const h = await env.CLIPS.head(key);
    if (h) return h.size;
  } catch {
    /* try KV */
  }
  const kv = await env.CLIPS_KV.get(key, 'arrayBuffer');
  return kv ? kv.byteLength : null;
}

export interface Slice {
  body: ReadableStream | Uint8Array;
  size: number;
  offset: number;
  length: number;
}

/** The whole object, or a byte range of it, for downloads that resume. */
export async function getSlice(env: Env, key: string, range?: { offset: number; length: number }): Promise<Slice | null> {
  try {
    const o = await env.CLIPS.get(key, range ? { range } : undefined);
    if (o) return { body: o.body, size: o.size, offset: range ? (o.range && 'offset' in o.range ? (o.range.offset ?? 0) : range.offset) : 0, length: range ? Math.min(range.length, o.size - range.offset) : o.size };
  } catch {
    /* try KV */
  }
  const kv = await env.CLIPS_KV.get(key, 'arrayBuffer');
  if (!kv) return null;
  const all = new Uint8Array(kv);
  const off = range?.offset ?? 0;
  const len = range ? Math.min(range.length, all.length - off) : all.length;
  return { body: all.subarray(off, off + len), size: all.length, offset: off, length: len };
}

export async function deleteObjects(env: Env, keys: string[]): Promise<void> {
  if (keys.length === 0) return;
  try {
    await env.CLIPS.delete(keys);
  } catch {
    /* the cron will retry; an orphan only costs storage for a day */
  }
  await Promise.all(keys.map((k) => env.CLIPS_KV.delete(k).catch(() => undefined)));
}

/** Keys under [prefix] uploaded before [cutoffMs], for the daily cleanup. At most [limit] per call. */
export async function listOlderThan(env: Env, prefix: string, cutoffMs: number, limit: number): Promise<string[]> {
  const out: string[] = [];
  let cursor: string | undefined;
  do {
    const page = await env.CLIPS.list({ prefix, cursor, limit: 1000 });
    for (const o of page.objects) {
      if (o.uploaded.getTime() < cutoffMs) {
        out.push(o.key);
        if (out.length >= limit) return out;
      }
    }
    cursor = page.truncated ? page.cursor : undefined;
  } while (cursor);
  return out;
}
