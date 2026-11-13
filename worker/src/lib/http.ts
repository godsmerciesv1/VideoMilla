import type { Env } from '../env';

/** An error that becomes an HTTP response with a short machine-readable code. */
export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    readonly detail?: string,
  ) {
    super(code);
  }
}

export function requestId(): string {
  return crypto.randomUUID();
}

export function json(body: unknown, status = 200, headers: HeadersInit = {}): Response {
  const h = new Headers(headers);
  h.set('Content-Type', 'application/json; charset=utf-8');
  h.set('Cache-Control', 'no-store');
  return new Response(JSON.stringify(body), { status, headers: h });
}

/** The caller's network address as Cloudflare reports it. */
export function clientIp(req: Request): string {
  return req.headers.get('CF-Connecting-IP') ?? 'unknown';
}

async function readLimited(req: Request, maxBytes: number): Promise<Uint8Array> {
  const declared = Number(req.headers.get('Content-Length'));
  if (Number.isFinite(declared) && declared > maxBytes) throw new HttpError(413, 'too_large');
  if (!req.body) return new Uint8Array();
  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      throw new HttpError(413, 'too_large');
    }
    chunks.push(value);
  }
  const out = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    out.set(c, offset);
    offset += c.byteLength;
  }
  return out;
}

/** Raw request bytes, refusing anything over [maxBytes]. Pictures and audio travel as bytes, not base64. */
export async function readBytes(req: Request, maxBytes: number): Promise<Uint8Array> {
  return readLimited(req, maxBytes);
}

/** A JSON body of at most [maxBytes]. An empty body is an error unless [allowEmpty] is set (then it is `{}`). */
export async function readJson<T = unknown>(req: Request, maxBytes: number, allowEmpty = false): Promise<T> {
  const bytes = await readLimited(req, maxBytes);
  if (bytes.byteLength === 0) {
    if (allowEmpty) return {} as T;
    throw new HttpError(400, 'empty_body');
  }
  try {
    return JSON.parse(new TextDecoder().decode(bytes)) as T;
  } catch {
    throw new HttpError(400, 'invalid_json');
  }
}

const ALLOWED_HEADERS = 'Authorization, Content-Type, X-App-Version, X-Idempotency-Key';

/** The origin to echo back, or null when the caller's origin is not allowed. */
export function allowedOrigin(req: Request, env: Env): string | null {
  const origin = req.headers.get('Origin');
  if (!origin) return null;
  if (origin === env.WEB_ORIGIN || origin === env.APP_ORIGIN) return origin;
  if (env.ALLOW_LOCALHOST === '1' && /^http:\/\/localhost:\d+$/.test(origin)) return origin;
  return null;
}

/** Answers a CORS preflight. A disallowed origin gets 403 and no CORS headers. */
export function preflight(req: Request, env: Env): Response {
  const origin = allowedOrigin(req, env);
  if (!origin) return new Response(null, { status: 403 });
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': ALLOWED_HEADERS,
      'Access-Control-Max-Age': '86400',
      Vary: 'Origin',
    },
  });
}

/** Adds CORS headers (for an allowed origin) and a request id. The Android app sends no Origin and needs none. */
export function withCors(req: Request, env: Env, res: Response): Response {
  const h = new Headers(res.headers);
  const origin = allowedOrigin(req, env);
  if (origin) {
    h.set('Access-Control-Allow-Origin', origin);
    h.set('Access-Control-Expose-Headers', 'X-Request-Id');
    h.append('Vary', 'Origin');
  }
  if (!h.has('X-Request-Id')) h.set('X-Request-Id', requestId());
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers: h });
}

/** Turns anything thrown into a JSON error response. Unknown errors never leak details. */
export function errorResponse(e: unknown): Response {
  if (e instanceof HttpError) return json({ error: e.code }, e.status);
  console.error('unhandled', e instanceof Error ? e.message : 'unknown');
  return json({ error: 'internal' }, 500);
}

function parseVersion(v: string): [number, number, number] {
  const parts = v.split('.').map((p) => Number.parseInt(p, 10));
  return [parts[0] || 0, parts[1] || 0, parts[2] || 0];
}

/** True when [version] is older than the server's minimum. A missing header is let through. */
export function belowMin(version: string | null, min: unknown): boolean {
  if (!version || typeof min !== 'string') return false;
  const a = parseVersion(version);
  const b = parseVersion(min);
  for (let i = 0; i < 3; i++) {
    if (a[i]! !== b[i]!) return a[i]! < b[i]!;
  }
  return false;
}
