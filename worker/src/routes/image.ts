import type { Env } from '../env';
import type { Auth } from '../lib/auth';
import { releaseDaily, takeDaily } from '../lib/free_counter';
import { HttpError, json } from '../lib/http';
import { isValidKey } from '../lib/idempotency';
import { runPaid } from '../lib/job';
import { moderateAll } from '../lib/moderation';
import { composeImagePrompt, type PromptCharacter } from '../lib/prompts';
import { b64ToBytes, pickImageModels, spendCaps } from '../lib/provider_router';
import { releaseSpend, reserveSpend } from '../lib/spend_cap';
import { allowedStyles, isAgeBand, isStyleId, styleVerdict, type StyleId } from '../lib/style_rules';
import { creditCosts, fairUseFor } from '../lib/wallet_info';

/** Expected spend for a 720p klein 4B picture (about 150 neurons), in millionths of a dollar. Generous. */
export const IMAGE_EST_MICRO = 2500;
/** Expected spend for the larger fallback model. */
export const IMAGE_FALLBACK_EST_MICRO = 25_000;

const PROJECT_ID = /^[A-Za-z0-9_-]{1,64}$/;
const MAX_BODY = 3_500_000;
const MAX_REF_BYTES = 600_000;
const MAX_REFS = 4;
const short = (v: unknown, max: number): string => (typeof v === 'string' ? v.trim().slice(0, max) : '');

type Runner = { run(model: string, input: unknown): Promise<unknown> };

interface Meta {
  style?: unknown;
  visual?: unknown;
  kind?: unknown;
  aspect?: unknown;
  language?: unknown;
  characters?: unknown;
  project_id?: unknown;
  self_mode?: unknown;
  references?: unknown;
}

function imageMime(b: Uint8Array): string | null {
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg';
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return 'image/png';
  return null;
}

/** The request as JSON, or as multipart with a `meta` JSON field and files `ref0` to `ref3`. */
async function readRequest(req: Request): Promise<{ meta: Meta; refs: Uint8Array[] }> {
  if (Number(req.headers.get('content-length') ?? 0) > MAX_BODY) throw new HttpError(413, 'too_large');
  const type = req.headers.get('content-type') ?? '';
  try {
    if (type.includes('multipart/form-data')) {
      const form = await req.formData();
      const metaText = form.get('meta');
      if (typeof metaText !== 'string') throw new HttpError(400, 'invalid_body');
      const refs: Uint8Array[] = [];
      for (let i = 0; i < MAX_REFS + 1; i++) {
        const f = form.get(`ref${i}`);
        if (f && typeof f !== 'string') refs.push(new Uint8Array(await f.arrayBuffer()));
      }
      return { meta: JSON.parse(metaText) as Meta, refs };
    }
    const text = await req.text();
    if (text.length > MAX_BODY) throw new HttpError(413, 'too_large');
    const meta = JSON.parse(text) as Meta;
    const refs = Array.isArray(meta.references) ? meta.references.filter((r): r is string => typeof r === 'string').map((r) => b64ToBytes(r)) : [];
    return { meta, refs };
  } catch (e) {
    if (e instanceof HttpError) throw e;
    throw new HttpError(400, 'invalid_body');
  }
}

function parseCharacters(raw: unknown, max: number): PromptCharacter[] {
  if (raw === undefined) return [];
  if (!Array.isArray(raw) || raw.length > max) throw new HttpError(400, 'invalid_characters');
  return raw.map((c) => {
    if (!c || typeof c !== 'object') throw new HttpError(400, 'invalid_characters');
    const o = c as Record<string, unknown>;
    const name = short(o.name, 60);
    if (!name || !isAgeBand(o.age_band)) throw new HttpError(400, 'invalid_characters');
    return { name, age_band: o.age_band, build: short(o.build, 120), hair: short(o.hair, 120), skin_tone: short(o.skin_tone, 60), outfit: short(o.outfit, 160), signature: short(o.signature, 120) };
  });
}

/** Providers phrase their own safety refusals in many ways; none of them is a retry-worthy outage. */
const FLAGGED = /flagged|safety|filter|nsfw|policy|prohibited|moderat/i;

async function renderOnce(env: Env, model: string, prompt: string, w: number, h: number, refs: Uint8Array[]): Promise<{ b64: string; mime: string }> {
  const form = new FormData();
  form.append('prompt', prompt);
  form.append('width', String(w));
  form.append('height', String(h));
  refs.slice(0, MAX_REFS).forEach((b, i) => form.append(`input_image_${i}`, new Blob([b], { type: imageMime(b) ?? 'image/jpeg' })));
  const fr = new Response(form);
  const out = (await (env.AI as unknown as Runner).run(model, { multipart: { body: fr.body, contentType: fr.headers.get('content-type') } })) as { image?: unknown } | string | null;
  const b64 = typeof out === 'string' ? out : typeof out?.image === 'string' ? out.image : '';
  const mime = b64 ? imageMime(b64ToBytes(b64.slice(0, 16))) : null;
  if (!b64 || !mime) throw new Error('bad_output');
  return { b64, mime };
}

/**
 * `POST /v1/image` (blueprint F092): one portrait or keyframe. The app sends the parts and the Worker writes the
 * final prompt (no text in the picture; Realistic Scenes never shows people). Order: validate, children-and-styles
 * rule, moderate, then the paid job. A picture costs 1 credit and is refunded if it fails; the picture provider's
 * own safety filter refusing a request is a plain "output flagged" with nothing charged (decision D-106).
 * Reference pictures are held only in memory; nothing is stored. Cartoon Me's own-face mode arrives with accounts.
 */
export async function handleImage(req: Request, env: Env, auth: Auth): Promise<Response> {
  const key = req.headers.get('X-Idempotency-Key') ?? '';
  if (!isValidKey(key)) throw new HttpError(400, 'invalid_key');
  const { meta, refs } = await readRequest(req);

  if (!isStyleId(meta.style)) throw new HttpError(400, 'invalid_style');
  const style: StyleId = meta.style;
  const kind = meta.kind === undefined ? 'keyframe' : meta.kind;
  if (kind !== 'keyframe' && kind !== 'portrait') throw new HttpError(400, 'invalid_kind');
  const aspect = meta.aspect === undefined ? '9:16' : meta.aspect;
  if (aspect !== '9:16' && aspect !== '16:9') throw new HttpError(400, 'invalid_aspect');
  const visual = short(meta.visual, 600);
  if (!visual) throw new HttpError(400, 'invalid_visual');
  if (meta.self_mode) throw new HttpError(400, 'self_mode_unavailable');
  if (typeof meta.project_id !== 'string' || !PROJECT_ID.test(meta.project_id)) throw new HttpError(400, 'invalid_project');
  const projectId = meta.project_id;
  const language = typeof meta.language === 'string' && /^[a-z]{2,3}(_[A-Za-z]{2,4})?$/.test(meta.language) ? meta.language : 'en';

  const characters = parseCharacters(meta.characters, kind === 'portrait' ? 1 : 2);
  if (kind === 'portrait' && characters.length !== 1) throw new HttpError(400, 'invalid_characters');
  const ages = characters.map((c) => c.age_band);
  // Minors only in the four cartoon styles, and no people at all in Realistic Scenes: enforced here as well as at structuring.
  if (styleVerdict(style, ages) !== 'ok') throw new HttpError(400, 'style_not_allowed');

  if (refs.length > MAX_REFS) throw new HttpError(400, 'too_many_references');
  for (const r of refs) if (r.length > MAX_REF_BYTES || !imageMime(r)) throw new HttpError(400, 'invalid_reference');

  const moderated = [visual, ...characters.map((c) => [c.name, c.outfit, c.signature, c.hair].filter(Boolean).join(' '))].join('\n');
  if (!(await moderateAll(env, { script: moderated, language })).allowed) throw new HttpError(422, 'moderation_blocked');

  const costs = await creditCosts(env.DB);
  const cost = kind === 'portrait' ? (costs.portrait ?? 1) : (costs.picture ?? 1);
  const [w, h] = kind === 'portrait' ? [448, 448] : aspect === '9:16' ? [720, 1280] : [1280, 720];
  let dailyTaken = false;

  return runPaid(
    env,
    {
      key,
      walletId: auth.walletId,
      deviceId: auth.deviceId,
      action: kind === 'portrait' ? 'portrait' : 'picture',
      projectId,
      estMicro: IMAGE_EST_MICRO,
      price: async () => {
        const fu = await fairUseFor(env.DB, auth.walletId);
        if (fu.picturesPerDay > 0) {
          const n = await takeDaily(env.DB, 'pic', auth.walletId);
          if (n > fu.picturesPerDay) {
            await releaseDaily(env.DB, 'pic', auth.walletId);
            throw new HttpError(429, 'daily_limit');
          }
          dailyTaken = true;
        }
        return cost;
      },
      undo: async () => {
        if (dailyTaken) await releaseDaily(env.DB, 'pic', auth.walletId);
      },
    },
    async (charged) => {
      const prompt = composeImagePrompt({ style, visual, characters, kind });
      const { primary, fallback } = await pickImageModels(env.DB);
      let result: { b64: string; mime: string };
      try {
        result = await renderOnce(env, primary, prompt, w, h, refs);
      } catch (e) {
        if (FLAGGED.test(e instanceof Error ? e.message : '')) throw new HttpError(422, 'output_flagged');
        // The larger model is a fallback and spends from the fallback budget; past it the answer is "busy".
        const caps = await spendCaps(env.DB);
        if (!(await reserveSpend(env.DB, 'fallback', IMAGE_FALLBACK_EST_MICRO, caps.fallbackMicro))) throw new HttpError(503, 'busy');
        try {
          result = await renderOnce(env, fallback, prompt, w, h, refs);
        } catch (e2) {
          await releaseSpend(env.DB, 'fallback', IMAGE_FALLBACK_EST_MICRO);
          throw FLAGGED.test(e2 instanceof Error ? e2.message : '') ? new HttpError(422, 'output_flagged') : new HttpError(503, 'busy');
        }
      }
      return json({ image: result.b64, mime: result.mime, width: w, height: h, charged });
    },
  );
}

