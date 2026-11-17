import type { Env } from '../env';
import type { Auth } from '../lib/auth';
import { aiText, firstJsonObject } from '../lib/ai_text';
import { b64ToBytes, pickVisionModels } from '../lib/provider_router';
import { HttpError, json, readJson } from '../lib/http';
import { hit } from '../lib/rate_limit';

/** Checks per wallet per hour. The check costs no credits. */
const CHECKS_PER_HOUR = 120;
/** A reference is resized to 512 px on the device first, so even a large base64 JPEG is far below this. */
const MAX_BODY_BYTES = 1_500_000;

const QUESTION =
  'You are checking a reference picture for a drawing-based video app. Answer with JSON only: {"face": true or false, "explicit": true or false}. ' +
  '"face" is true only when the picture shows a photograph or a realistic depiction of a real human face. ' +
  'Cartoons, drawings, clearly stylised or cartoon characters, mascots and robots do NOT count as faces. ' +
  '"explicit" is true when the picture shows nudity, sexual content or graphic violence.';

type Runner = { run(model: string, input: unknown): Promise<unknown> };

function mimeOf(bytes: Uint8Array): string | null {
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg';
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return 'image/png';
  return null;
}

/** Gemma 4 reasons before answering; without this switch a short answer can come back empty (found at G13). */
function visionInput(model: string, url: string): Record<string, unknown> {
  const base = {
    messages: [{ role: 'user', content: [{ type: 'text', text: QUESTION }, { type: 'image_url', image_url: { url } }] }],
    max_tokens: 60,
    temperature: 0,
  };
  return model.includes('gemma-4') ? { ...base, chat_template_kwargs: { enable_thinking: false } } : base;
}

interface Verdict {
  face: boolean;
  explicit: boolean;
}

function readVerdict(result: unknown): Verdict | null {
  const j = firstJsonObject(aiText(result));
  return j && typeof j.face === 'boolean' && typeof j.explicit === 'boolean' ? { face: j.face, explicit: j.explicit } : null;
}

/**
 * `POST /v1/reference/check` (blueprint F095, decision D-114). Rejects a reference that shows a photographic
 * or realistic human face, or explicit content; stylised and cartoon faces are accepted (the app shows its
 * impersonation warning for those). Fails closed: if no vision model gives a readable answer the picture is
 * not accepted. The picture is held only in memory for this request and never stored.
 * Cartoon Me's own-face mode is not accepted here yet; it arrives with the accounts batch.
 */
export async function handleReferenceCheck(req: Request, env: Env, auth: Auth): Promise<Response> {
  const limited = await hit(env.DB, `refcheck:${auth.walletId}`, CHECKS_PER_HOUR, 3600);
  if (!limited.allowed) throw new HttpError(429, 'rate_limited');

  const body = await readJson<{ image?: unknown; mode?: unknown }>(req, MAX_BODY_BYTES);
  if (body.mode !== undefined && body.mode !== 'reference') throw new HttpError(400, 'invalid_mode');
  if (typeof body.image !== 'string' || body.image.length < 16) throw new HttpError(400, 'invalid_image');
  let bytes: Uint8Array;
  try {
    bytes = b64ToBytes(body.image);
  } catch {
    throw new HttpError(400, 'invalid_image');
  }
  const mime = mimeOf(bytes);
  if (!mime) throw new HttpError(400, 'invalid_image');
  const url = `data:${mime};base64,${body.image}`;

  const ai = env.AI as unknown as Runner;
  for (const model of await pickVisionModels(env.DB)) {
    try {
      const verdict = readVerdict(await ai.run(model, visionInput(model, url)));
      if (!verdict) continue;
      const reason = verdict.face ? 'face' : verdict.explicit ? 'explicit' : null;
      return json({ ok: reason === null, face: verdict.face, reason });
    } catch {
      /* try the next model */
    }
  }
  throw new HttpError(503, 'check_unavailable');
}
