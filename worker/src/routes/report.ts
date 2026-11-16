import type { Env } from '../env';
import type { Auth } from '../lib/auth';
import { randomBase64Url } from '../lib/crypto';
import { HttpError, json, readJson } from '../lib/http';
import { hit } from '../lib/rate_limit';

export const REPORT_KINDS = ['picture', 'clip', 'video', 'script', 'translation'] as const;

/** Reports per wallet per hour. */
const REPORTS_PER_HOUR = 30;

/** `POST /v1/report`: a report on any output. The control exists on every output in the apps. */
export async function handleReport(req: Request, env: Env, auth: Auth): Promise<Response> {
  const limited = await hit(env.DB, `report:${auth.walletId}`, REPORTS_PER_HOUR, 3600);
  if (!limited.allowed) throw new HttpError(429, 'rate_limited');
  const body = await readJson<{ kind?: unknown; ref?: unknown }>(req, 2048);
  if (typeof body.kind !== 'string' || !(REPORT_KINDS as readonly string[]).includes(body.kind)) throw new HttpError(400, 'invalid_kind');
  const ref = typeof body.ref === 'string' ? body.ref.slice(0, 200) : '';
  await env.DB.prepare('INSERT INTO reports(id, wallet_id, kind, ref) VALUES(?, ?, ?, ?)').bind(randomBase64Url(12), auth.walletId, body.kind, ref).run();
  return json({ ok: true }, 201);
}
