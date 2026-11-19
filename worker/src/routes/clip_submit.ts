import type { Env } from '../env';
import type { Auth } from '../lib/auth';
import { audioSeconds } from '../lib/audio';
import { clipCredits, talkingClipCredits, zoneCheck } from '../lib/animation_rules';
import { deleteObjects, getBytes, CLIP_MIME, putObject } from '../lib/clip_store';
import { releaseDailyAmount, reserveDailyAmount } from '../lib/free_counter';
import { HttpError, json, readJson } from '../lib/http';
import { isValidKey, getRequest } from '../lib/idempotency';
import { reserveError } from '../lib/job';
import { commit, refund, reserveMany, type ReserveItem } from '../lib/ledger';
import { moderateAll } from '../lib/moderation';
import { composeClipPrompt } from '../lib/prompts';
import { b64ToBytes, clipBudgetAvailable, clipRoutes, type ClipInput, type ClipProvider, pickClipProvider, type PickedRoute, ProviderError } from '../lib/provider_router';
import { prunaClip } from '../lib/provider_pruna';
import { veoClip } from '../lib/provider_gemini';
import { segmindClip } from '../lib/provider_segmind';
import { releaseSpend } from '../lib/spend_cap';
import { creditCosts, fairUseFor } from '../lib/wallet_info';
import { cfg } from './config';

const PROJECT_ID = /^[A-Za-z0-9_-]{1,64}$/;
const MAX_FRAME_BYTES = 900_000;
const MAX_AUDIO_BYTES = 1_500_000;
const MAX_BODY_BYTES = 8_000_000;
const MAX_CLIP_ATTEMPTS = 3;
const short = (v: unknown, max: number): string => (typeof v === 'string' ? v.trim().slice(0, max) : '');

const inKeys = (key: string): string[] => [`in/${key}/meta`, `in/${key}/frame`, `in/${key}/audio`];

interface ClipReq {
  key?: unknown;
  shot_id?: unknown;
  visual?: unknown;
  camera?: unknown;
  seconds?: unknown;
  first_frame?: unknown;
  audio?: unknown;
}
interface SubmitBody {
  project_id?: unknown;
  n?: unknown;
  aspect?: unknown;
  language?: unknown;
  confirm_high?: unknown;
  confirm_all?: unknown;
  clips?: unknown;
}

interface Parsed {
  key: string;
  shotId: string;
  visual: string;
  camera: string;
  seconds: number;
  frame: Uint8Array;
  audio: Uint8Array | null;
}

function isJpeg(b: Uint8Array): boolean {
  return b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff;
}

function parseClip(raw: unknown, seen: Set<string>): Parsed {
  if (!raw || typeof raw !== 'object') throw new HttpError(400, 'invalid_clip');
  const c = raw as ClipReq;
  if (!isValidKey(c.key) || seen.has(c.key)) throw new HttpError(400, 'invalid_key');
  seen.add(c.key);
  const shotId = short(c.shot_id, 64);
  const visual = short(c.visual, 600);
  if (!shotId || !visual) throw new HttpError(400, 'invalid_clip');
  if (typeof c.first_frame !== 'string') throw new HttpError(400, 'invalid_frame');
  let frame: Uint8Array;
  try {
    frame = b64ToBytes(c.first_frame);
  } catch {
    throw new HttpError(400, 'invalid_frame');
  }
  if (frame.length > MAX_FRAME_BYTES || !isJpeg(frame)) throw new HttpError(400, 'invalid_frame');

  let audio: Uint8Array | null = null;
  let seconds: number;
  if (c.audio !== undefined && c.audio !== null) {
    if (typeof c.audio !== 'string') throw new HttpError(400, 'invalid_audio');
    try {
      audio = b64ToBytes(c.audio);
    } catch {
      throw new HttpError(400, 'invalid_audio');
    }
    if (audio.length > MAX_AUDIO_BYTES) throw new HttpError(400, 'invalid_audio');
    // Billed by the audio's real length, read from the bytes, never from a figure the client sends.
    const secs = audioSeconds(audio);
    if (secs === null || secs <= 0) throw new HttpError(400, 'invalid_audio');
    seconds = Math.ceil(secs);
    if (seconds > 8) throw new HttpError(400, 'audio_too_long');
  } else {
    seconds = c.seconds === undefined ? 5 : (c.seconds as number);
    if (typeof seconds !== 'number' || !Number.isInteger(seconds) || seconds < 3 || seconds > 8) throw new HttpError(400, 'invalid_seconds');
  }
  return { key: c.key, shotId, visual, camera: short(c.camera, 80), seconds, frame, audio };
}

export interface ClipJobView {
  key: string;
  shot_id: string;
  state: string;
  seconds: number;
  talking: boolean;
  voice_over: boolean;
  error: string | null;
}

interface ClipRow {
  key: string;
  wallet_id: string;
  shot_id: string;
  seconds: number;
  talking: number;
  voice_over: number;
  state: string;
  error: string | null;
  attempts: number;
}

export function view(r: ClipRow): ClipJobView {
  return { key: r.key, shot_id: r.shot_id, state: r.state, seconds: r.seconds, talking: r.talking === 1, voice_over: r.voice_over === 1, error: r.error };
}

export async function clipRows(db: D1Database, walletId: string, keys: string[]): Promise<ClipRow[]> {
  if (keys.length === 0) return [];
  const q = keys.map(() => '?').join(',');
  const r = await db
    .prepare(`SELECT key, wallet_id, shot_id, seconds, talking, voice_over, state, error, attempts FROM clips WHERE wallet_id = ? AND key IN (${q})`)
    .bind(walletId, ...keys)
    .all<ClipRow>();
  return r.results;
}

/**
 * `POST /v1/clip/submit` (blueprint F100): reserve and queue one to fifteen animated clips.
 * Order: validate (including the audio's real length), the animation-zone confirmations, moderation, the daily
 * animated-seconds limit for a new wallet (D-113), a budget check that answers "busy" before any credits move, then ONE
 * atomic reservation of every clip (all or none). Inputs are written and the jobs queued only after the credits are
 * safely reserved; if anything after that fails, every clip is refunded.
 */
export async function handleClipSubmit(req: Request, env: Env, auth: Auth): Promise<Response> {
  const body = await readJson<SubmitBody>(req, MAX_BODY_BYTES);
  if (typeof body.project_id !== 'string' || !PROJECT_ID.test(body.project_id)) throw new HttpError(400, 'invalid_project');
  const projectId = body.project_id;
  const n = body.n;
  if (typeof n !== 'number' || !Number.isInteger(n) || n < 1 || n > 15) throw new HttpError(400, 'invalid_shots');
  const aspect = body.aspect === undefined ? '9:16' : body.aspect;
  if (aspect !== '9:16' && aspect !== '16:9') throw new HttpError(400, 'invalid_aspect');
  const language = typeof body.language === 'string' && /^[a-z]{2,3}(_[A-Za-z]{2,4})?$/.test(body.language) ? body.language : 'en';
  if (!Array.isArray(body.clips) || body.clips.length < 1 || body.clips.length > n) throw new HttpError(400, 'invalid_clips');

  const seen = new Set<string>();
  const clips = body.clips.map((c) => parseClip(c, seen));
  const k = clips.length;
  if (!zoneCheck(n, k, body.confirm_high === true, body.confirm_all === true)) throw new HttpError(400, 'confirmation_required');

  if (!(await moderateAll(env, { script: clips.map((c) => c.visual).join('\n'), language })).allowed) throw new HttpError(422, 'moderation_blocked');

  const costs = await creditCosts(env.DB);
  const perSecond = costs.clip_per_second ?? 2;
  const priced = clips.map((c) => ({ ...c, credits: c.audio ? talkingClipCredits(c.seconds, perSecond) : clipCredits(c.seconds, perSecond) }));
  const totalSeconds = clips.reduce((a, c) => a + c.seconds, 0);
  const totalCredits = priced.reduce((a, c) => a + c.credits, 0);

  const routes = await clipRoutes(env.DB);
  const primary = routes[0];
  if (!primary) throw new HttpError(503, 'busy');

  const fu = await fairUseFor(env.DB, auth.walletId);
  let dailyHeld = false;
  if (fu.animatedSecondsPerDay > 0) {
    if (!(await reserveDailyAmount(env.DB, 'anim', auth.walletId, totalSeconds, fu.animatedSecondsPerDay))) throw new HttpError(429, 'daily_limit');
    dailyHeld = true;
  }
  const releaseDaily = async (): Promise<void> => {
    if (dailyHeld) await releaseDailyAmount(env.DB, 'anim', auth.walletId, totalSeconds);
  };

  if (!(await clipBudgetAvailable(env, totalSeconds))) {
    await releaseDaily();
    throw new HttpError(503, 'busy');
  }

  const items: ReserveItem[] = priced.map((c) => ({
    key: c.key,
    walletId: auth.walletId,
    deviceId: auth.deviceId,
    action: 'clip',
    cost: c.credits,
    projectId,
    provider: primary.provider,
    estMicro: Math.round(primary.costPerSecondMicro * c.seconds),
  }));
  const outcome = await reserveMany(env.DB, items);
  if (outcome !== 'ok') {
    await releaseDaily();
    if (outcome === 'duplicate') {
      // A repeat of an earlier submit: report where those clips stand, charge nothing.
      const rows = await clipRows(env.DB, auth.walletId, clips.map((c) => c.key));
      if (rows.length === clips.length) return json({ jobs: rows.map(view), charged: 0, duplicate: true });
      throw new HttpError(409, 'in_progress');
    }
    throw reserveError(outcome);
  }

  const now = Math.floor(Date.now() / 1000);
  try {
    await env.DB.batch(
      priced.map((c) =>
        env.DB.prepare("INSERT INTO clips(key, wallet_id, shot_id, seconds, talking, state, updated_at) VALUES(?, ?, ?, ?, ?, 'queued', ?)").bind(c.key, auth.walletId, c.shotId, c.seconds, c.audio ? 1 : 0, now),
      ),
    );
    for (const c of priced) {
      const [meta, frame, audio] = inKeys(c.key) as [string, string, string];
      await putObject(env, meta, JSON.stringify({ visual: c.visual, camera: c.camera, seconds: c.seconds, aspect, talking: !!c.audio }), 'application/json');
      await putObject(env, frame, c.frame, 'image/jpeg');
      if (c.audio) await putObject(env, audio, c.audio, 'audio/mpeg');
    }
    await env.CLIP_JOBS.sendBatch(priced.map((c) => ({ body: { key: c.key } })));
  } catch {
    for (const c of priced) {
      await refund(env.DB, c.key);
      await env.DB.prepare("UPDATE clips SET state = 'failed_terminal', error = 'submit_failed', updated_at = ? WHERE key = ?").bind(now, c.key).run();
    }
    await deleteObjects(env, priced.flatMap((c) => inKeys(c.key)));
    await releaseDaily();
    throw new HttpError(503, 'busy');
  }

  return json({
    jobs: priced.map((c) => ({ key: c.key, shot_id: c.shotId, state: 'queued', seconds: c.seconds, talking: !!c.audio, voice_over: false, error: null, credits: c.credits })),
    charged: totalCredits,
  });
}

// ---- the queue consumer ----

/** The part of a queue message the consumer uses (so tests can drive it directly). */
export interface JobMessage {
  attempts: number;
  ack(): void;
  retry(opts?: { delaySeconds?: number }): void;
}

async function callProvider(env: Env, picked: PickedRoute, input: ClipInput): Promise<Uint8Array> {
  const provider: ClipProvider = picked.route.provider;
  const withAudio = picked.dropAudio ? { ...input, audio: undefined } : input;
  // How often a provider job is polled, in ms. Config `provider_poll_ms` overrides the adapters' own defaults.
  const configured = await cfg<number>(env.DB, 'provider_poll_ms');
  const opts = typeof configured === 'number' && configured >= 1 ? { pollMs: configured } : {};
  switch (provider) {
    case 'segmind':
      return segmindClip(env, withAudio, picked.route.model);
    case 'pruna':
      return prunaClip(env, withAudio, opts);
    case 'gemini':
      return veoClip(env, withAudio, picked.route.model, opts);
  }
}

async function failClip(env: Env, row: ClipRow, state: 'failed_retriable' | 'failed_terminal', error: string): Promise<void> {
  await refund(env.DB, row.key);
  await env.DB.prepare('UPDATE clips SET state = ?, error = ?, updated_at = ? WHERE key = ?').bind(state, error, Math.floor(Date.now() / 1000), row.key).run();
  await releaseDailyAmount(env.DB, 'anim', row.wallet_id, row.seconds);
  await deleteObjects(env, inKeys(row.key));
}

/**
 * The queue consumer (blueprint F100, decisions D-110 and D-113). One call per clip:
 *  - does nothing unless the request is still reserved (a retry, a refund or the cron may have got there first);
 *  - waits (re-queues with a delay) while the wallet or the whole service is at its concurrency limit;
 *  - claims the clip in ONE conditional update, so a duplicate delivery runs the provider once;
 *  - tries the provider routes in order, releasing the budget of each that fails;
 *  - on success stores the MP4 and commits; if the cron already refunded it, it throws the result away;
 *  - on failure retries (up to 3 tries) or refunds.
 */
export async function runClipJob(env: Env, key: string, msg: JobMessage): Promise<void> {
  const db = env.DB;
  const request = await getRequest(db, key);
  if (!request || request.status !== 'reserved') return msg.ack();
  const row = await db.prepare('SELECT key, wallet_id, shot_id, seconds, talking, voice_over, state, error, attempts FROM clips WHERE key = ?').bind(key).first<ClipRow>();
  if (!row) return msg.attempts >= 5 ? msg.ack() : msg.retry({ delaySeconds: 15 });
  if (row.state !== 'queued') return msg.ack();

  const fu = await fairUseFor(db, row.wallet_id);
  const globalLimit = (await cfg<number>(db, 'clip_global_concurrency')) ?? 30;
  const claim = await db
    .prepare(
      `UPDATE clips SET state = 'running', updated_at = ?1
        WHERE key = ?2 AND state = 'queued'
          AND (SELECT COUNT(*) FROM clips WHERE wallet_id = ?3 AND state = 'running') < ?4
          AND (SELECT COUNT(*) FROM clips WHERE state = 'running') < ?5`,
    )
    .bind(Math.floor(Date.now() / 1000), key, row.wallet_id, fu.clipsInFlight, globalLimit)
    .run();
  if ((claim.meta.changes ?? 0) !== 1) {
    const now = await db.prepare('SELECT state FROM clips WHERE key = ?').bind(key).first<{ state: string }>();
    // Still queued means the limit stopped it: try again shortly. Anything else means another consumer has it.
    return now?.state === 'queued' ? msg.retry({ delaySeconds: 15 }) : msg.ack();
  }

  const attempt = row.attempts + 1;
  try {
    const metaBytes = await getBytes(env, `in/${key}/meta`);
    const frame = await getBytes(env, `in/${key}/frame`);
    if (!metaBytes || !frame) {
      await failClip(env, row, 'failed_terminal', 'inputs_missing');
      return msg.ack();
    }
    const meta = JSON.parse(new TextDecoder().decode(metaBytes)) as { visual: string; camera: string; seconds: number; aspect: '9:16' | '16:9'; talking: boolean };
    const audio = (await getBytes(env, `in/${key}/audio`)) ?? undefined;
    const input: ClipInput = { prompt: composeClipPrompt(meta.visual, meta.camera), firstFrame: frame, audio, seconds: meta.seconds, aspect: meta.aspect };

    const tried: ClipProvider[] = [];
    let lastError: unknown = null;
    let done: { picked: PickedRoute; bytes: Uint8Array } | null = null;
    for (;;) {
      const picked = await pickClipProvider(env, { seconds: row.seconds, hasAudio: !!audio, skip: tried });
      if (!picked) break;
      try {
        done = { picked, bytes: await callProvider(env, picked, input) };
        break;
      } catch (e) {
        await releaseSpend(db, picked.kind, picked.estMicro);
        tried.push(picked.route.provider);
        lastError = e;
      }
    }

    if (!done) {
      if (tried.length === 0) {
        // No route had budget left today: refund and say busy.
        await failClip(env, row, 'failed_retriable', 'busy');
        return msg.ack();
      }
      const retriable = lastError instanceof ProviderError ? lastError.retriable : true;
      if (retriable && attempt < MAX_CLIP_ATTEMPTS) {
        await db.prepare("UPDATE clips SET state = 'queued', attempts = ?, updated_at = ? WHERE key = ?").bind(attempt, Math.floor(Date.now() / 1000), key).run();
        return msg.retry({ delaySeconds: 15 * attempt });
      }
      await failClip(env, row, retriable ? 'failed_retriable' : 'failed_terminal', lastError instanceof ProviderError ? lastError.code : 'provider_error');
      return msg.ack();
    }

    await putObject(env, `out/${key}`, done.bytes, CLIP_MIME);
    if (!(await commit(db, key))) {
      // The cron refunded this clip while it was being made: no charge, so the result is discarded.
      await deleteObjects(env, [`out/${key}`, ...inKeys(key)]);
      await db.prepare("UPDATE clips SET state = 'failed_terminal', error = 'expired', updated_at = ? WHERE key = ? AND state = 'running'").bind(Math.floor(Date.now() / 1000), key).run();
      return msg.ack();
    }
    const dropped = done.picked.dropAudio;
    await db.batch([
      db.prepare("UPDATE clips SET state = 'ready', provider = ?, talking = ?, voice_over = ?, attempts = ?, updated_at = ? WHERE key = ?").bind(done.picked.route.provider, dropped ? 0 : row.talking, dropped ? 1 : 0, attempt, Math.floor(Date.now() / 1000), key),
      db.prepare('UPDATE requests SET provider = ?, est_cost_micro = ? WHERE key = ?').bind(done.picked.route.provider, done.picked.estMicro, key),
    ]);
    await deleteObjects(env, inKeys(key));
    return msg.ack();
  } catch {
    // Something unexpected (storage down, bad stored input): count a try, then give up and refund.
    if (attempt < MAX_CLIP_ATTEMPTS) {
      await db.prepare("UPDATE clips SET state = 'queued', attempts = ?, updated_at = ? WHERE key = ?").bind(attempt, Math.floor(Date.now() / 1000), key).run();
      return msg.retry({ delaySeconds: 15 * attempt });
    }
    await failClip(env, row, 'failed_retriable', 'internal_error');
    return msg.ack();
  }
}
