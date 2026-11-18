import type { Env } from '../env';
import type { Auth } from '../lib/auth';
import { generateJson } from '../lib/ai_json';
import { releaseFree, takeFree } from '../lib/free_counter';
import { HttpError, json, readJson } from '../lib/http';
import { isValidKey } from '../lib/idempotency';
import { runPaid } from '../lib/job';
import { moderate, moderateAll } from '../lib/moderation';
import { type AssistKind, assistSystemPrompt } from '../lib/prompts';
import { pickTextModels } from '../lib/provider_router';
import { randomBase64Url } from '../lib/crypto';
import { validateCharacter, validateIdeas, validateScriptText, validateSummary } from '../lib/schemas';
import { isStyleId } from '../lib/style_rules';
import { creditCosts, recordGateHit, walletInfo } from '../lib/wallet_info';
import { cfg } from './config';

export const ASSIST_EST_MICRO = 1500;
const KINDS: readonly AssistKind[] = ['ideas', 'script', 'character', 'summary'];
const MODES: Record<string, string> = {
  expand: 'Expand the script with more detail and scenes while keeping its voice.',
  fit_length: 'Rewrite the script so it fits the target length.',
  change_tone: 'Rewrite the script in the requested tone.',
  simplify: 'Simplify the script: shorter sentences and plainer words.',
};
const PROJECT_ID = /^[A-Za-z0-9_-]{1,64}$/;
const short = (v: unknown, max: number): string => (typeof v === 'string' ? v.trim().slice(0, max) : '');

interface AssistBody {
  kind?: unknown;
  language?: unknown;
  project_id?: unknown;
  brief?: unknown;
  script?: unknown;
  mode?: unknown;
  tone?: unknown;
  target_length_s?: unknown;
  sentence?: unknown;
  style?: unknown;
  previous_summary?: unknown;
  episode_script?: unknown;
}

/** Builds the user message for a helper from its own inputs, as labelled data. Returns the text to moderate too. */
function buildInput(kind: AssistKind, b: AssistBody): string {
  switch (kind) {
    case 'ideas': {
      const o = (b.brief && typeof b.brief === 'object' ? b.brief : {}) as Record<string, unknown>;
      const parts = [['Genre', 'genre'], ['Tone', 'tone'], ['Setting', 'setting'], ['Notes', 'characters']].map(([label, k]) => (short(o[k!], 300) ? `${label}: ${short(o[k!], 300)}` : ''));
      return parts.filter(Boolean).join('\n') || 'Any family-friendly video idea.';
    }
    case 'script': {
      const mode = typeof b.mode === 'string' && MODES[b.mode] ? b.mode : '';
      if (!mode) throw new HttpError(400, 'invalid_mode');
      const script = short(b.script, 8000);
      if (script.length < 20) throw new HttpError(400, 'invalid_script');
      const extra = [typeof b.target_length_s === 'number' ? `Target length: about ${Math.round(b.target_length_s)} seconds.` : '', short(b.tone, 80) ? `Tone: ${short(b.tone, 80)}.` : ''].filter(Boolean).join(' ');
      return `Task: ${MODES[mode]} ${extra}\n${script}`;
    }
    case 'character': {
      const s = short(b.sentence, 300);
      if (s.length < 3) throw new HttpError(400, 'invalid_sentence');
      return s;
    }
    case 'summary': {
      const prev = short(b.previous_summary, 1500);
      const ep = short(b.episode_script, 8000);
      if (ep.length < 20) throw new HttpError(400, 'invalid_script');
      return `Previous summary: ${prev || '(none)'}\nNew episode script:\n${ep}`;
    }
  }
}

/**
 * `POST /v1/assist` (blueprint F094): idea brainstorm, script improver, character builder, series summary.
 * The first three share the per-project free counter with `/structure`; the series summary is always free
 * (blueprint 5.9: "the AI updates the summary (free)"). Every kind needs a purchase on the wallet first.
 */
export async function handleAssist(req: Request, env: Env, auth: Auth): Promise<Response> {
  const b = await readJson<AssistBody>(req, 60_000);
  if (typeof b.kind !== 'string' || !(KINDS as readonly string[]).includes(b.kind)) throw new HttpError(400, 'invalid_kind');
  const kind = b.kind as AssistKind;
  if (typeof b.language !== 'string' || !/^[a-z]{2,3}(_[A-Za-z]{2,4})?$/.test(b.language)) throw new HttpError(400, 'invalid_language');
  const language = b.language;
  const enabled = (await cfg<string[]>(env.DB, 'languages_enabled')) ?? [];
  if (!enabled.includes(language)) throw new HttpError(400, 'language_not_enabled');
  const free = kind !== 'summary';
  const projectId = typeof b.project_id === 'string' && PROJECT_ID.test(b.project_id) ? b.project_id : '';
  if (free && !projectId) throw new HttpError(400, 'invalid_project');
  if (kind === 'character' && b.style !== undefined && !isStyleId(b.style)) throw new HttpError(400, 'invalid_style');
  const key = req.headers.get('X-Idempotency-Key') ?? '';
  if (!isValidKey(key)) throw new HttpError(400, 'invalid_key');

  const userText = buildInput(kind, b);

  const wallet = await walletInfo(env.DB, auth.walletId);
  if (!wallet) throw new HttpError(401, 'unauthorized');
  if (!wallet.everPurchased) {
    await recordGateHit(env.DB, auth.walletId);
    throw new HttpError(402, 'purchase_required');
  }
  if (!(await moderateAll(env, { script: userText, language })).allowed) throw new HttpError(422, 'moderation_blocked');

  const costs = await creditCosts(env.DB);
  const freePer = costs.analysis_free_per_project ?? 3;
  let taken = 0;

  return runPaid(
    env,
    {
      key,
      walletId: auth.walletId,
      deviceId: auth.deviceId,
      action: free ? 'assist' : 'assist_summary',
      projectId: projectId || undefined,
      estMicro: ASSIST_EST_MICRO,
      price: async () => {
        if (!free) return 0;
        taken = await takeFree(env.DB, auth.walletId, projectId);
        return taken > freePer ? (costs.analysis ?? 1) : 0;
      },
      undo: free ? () => releaseFree(env.DB, auth.walletId, projectId) : undefined,
    },
    async (charged) => {
      const validate = {
        ideas: (raw: Record<string, unknown> | null) => (raw ? validateIdeas(raw) : { ok: false as const, error: 'not a JSON object' }),
        script: (raw: Record<string, unknown> | null) => (raw ? validateScriptText(raw) : { ok: false as const, error: 'not a JSON object' }),
        character: (raw: Record<string, unknown> | null) => (raw ? validateCharacter(raw) : { ok: false as const, error: 'not a JSON object' }),
        summary: (raw: Record<string, unknown> | null) => (raw ? validateSummary(raw) : { ok: false as const, error: 'not a JSON object' }),
      }[kind];
      const result = await generateJson<unknown>(env, {
        models: await pickTextModels(env.DB, language),
        system: assistSystemPrompt(kind, language),
        user: `<input>\n${userText.replace(/<\/?input>/gi, '')}\n</input>`,
        validate: validate as (raw: Record<string, unknown> | null) => ReturnType<typeof validateIdeas>,
        maxTokens: kind === 'script' || kind === 'summary' ? 3000 : 1500,
      });

      const out = typeof result === 'string' ? result : JSON.stringify(result);
      if (!(await moderate(env, out)).allowed) throw new HttpError(422, 'moderation_blocked');

      const value = kind === 'character' ? { id: randomBase64Url(9), ...(result as object) } : result;
      return json({ kind, result: value, charged, free_remaining: free ? Math.max(0, freePer - taken) : null });
    },
  );
}
