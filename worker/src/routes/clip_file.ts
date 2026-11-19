import type { Env } from '../env';
import type { Auth } from '../lib/auth';
import { CLIP_MIME, getSlice, objectSize } from '../lib/clip_store';
import { HttpError } from '../lib/http';
import { isValidKey } from '../lib/idempotency';

/** One byte range as `bytes=start-end`, `bytes=start-` or `bytes=-suffix`. Returns null for anything else. */
export function parseRange(header: string, size: number): { start: number; end: number } | 'invalid' | null {
  const m = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!m || (m[1] === '' && m[2] === '')) return header ? 'invalid' : null;
  let start: number;
  let end: number;
  if (m[1] === '') {
    const suffix = Number(m[2]);
    if (suffix === 0) return 'invalid';
    start = Math.max(0, size - suffix);
    end = size - 1;
  } else {
    start = Number(m[1]);
    end = m[2] === '' ? size - 1 : Math.min(Number(m[2]), size - 1);
  }
  return start >= size || end < start ? 'invalid' : { start, end };
}

/**
 * `GET /v1/clip/file?key=`: the finished clip, with Range support so a lost connection resumes (blueprint F102).
 * Never cached. Only the owning wallet can download, and only while the file is held (48 hours, D-099).
 */
export async function handleClipFile(req: Request, env: Env, auth: Auth): Promise<Response> {
  const key = new URL(req.url).searchParams.get('key') ?? '';
  if (!isValidKey(key)) throw new HttpError(400, 'invalid_key');
  const row = await env.DB.prepare('SELECT state FROM clips WHERE key = ? AND wallet_id = ?').bind(key, auth.walletId).first<{ state: string }>();
  if (!row) throw new HttpError(404, 'not_found');
  if (row.state !== 'ready') throw new HttpError(409, 'not_ready');

  const size = await objectSize(env, `out/${key}`);
  if (size === null) throw new HttpError(404, 'expired');

  const base = { 'Content-Type': CLIP_MIME, 'Accept-Ranges': 'bytes', 'Cache-Control': 'no-store' };
  const header = req.headers.get('Range');
  const range = header ? parseRange(header, size) : null;
  if (range === 'invalid') return new Response(null, { status: 416, headers: { ...base, 'Content-Range': `bytes */${size}` } });

  const slice = range ? await getSlice(env, `out/${key}`, { offset: range.start, length: range.end - range.start + 1 }) : await getSlice(env, `out/${key}`);
  if (!slice) throw new HttpError(404, 'expired');
  if (!range) return new Response(slice.body as BodyInit, { status: 200, headers: { ...base, 'Content-Length': String(size) } });
  return new Response(slice.body as BodyInit, {
    status: 206,
    headers: { ...base, 'Content-Length': String(range.end - range.start + 1), 'Content-Range': `bytes ${range.start}-${range.end}/${size}` },
  });
}
