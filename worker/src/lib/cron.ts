import type { Env } from '../env';
import { clipRows } from '../routes/clip_submit';
import { cfg } from '../routes/config';
import { computeEffectiveCaps } from './caps_policy';
import { deleteObjects, listOlderThan, retentionHours } from './clip_store';
import { releaseDailyAmount, releaseFree } from './free_counter';
import { refund } from './ledger';
import { spendCaps } from './provider_router';
import { settleReferrals } from './referrals';
import { recordMilestones } from './spend_cap';

/** A request still `reserved` after this long is abandoned (blueprint 23.4): 15 minutes, 30 for clips (they queue). */
const STALE_S = 900;
const STALE_CLIP_S = 1800;
/** A clip `running` this long means its consumer died. */
const STUCK_RUNNING_S = 1200;
const BATCH = 200;
const inKeys = (key: string): string[] => [`in/${key}/meta`, `in/${key}/frame`, `in/${key}/audio`];

export interface DailyReport {
  staleRefunded: number;
  clipsReset: number;
  clipsRefunded: number;
  objectsDeleted: number;
  milestones: string[];
  capsEffective: { video_usd: number; workers_ai_usd: number } | null;
  referrals: { settled: number; capped: number; voided: number; waiting: number } | null;
  tokensCleared: number;
  conversion: { gate_wallets: number; first_buyers: number } | null;
  errors: string[];
}

async function counterValue(db: D1Database, key: string): Promise<number> {
  return (await db.prepare('SELECT count FROM counters WHERE key = ?').bind(key).first<{ count: number }>())?.count ?? 0;
}

/**
 * The daily maintenance run (blueprint 23.9, F106). Every step is capped and idempotent, and one failing step never
 * stops the others; failures are listed in the report. The heartbeat is written last, so a missing heartbeat means
 * the run did not finish. [nowMs] is a parameter so tests can move time.
 * (Applying Play voided purchases is added with the Play verifier in batch `wp`.)
 */
type Step = (name: string, f: () => Promise<void>) => Promise<void>;
type StaleReport = Pick<DailyReport, 'staleRefunded' | 'clipsReset' | 'clipsRefunded'>;

/**
 * Abandoned work: reservations whose call died, clips whose consumer died, clips that waited too long. Run by both
 * the 15-minute pass and the daily run, so a crash never keeps someone's credits for more than about 15 minutes
 * (decision D-134; the blueprint's daily-only cron would have held them up to a day).
 */
async function staleWork(env: Env, now: number, r: StaleReport, step: Step): Promise<void> {
  const db = env.DB;
  await step('stale_requests', async () => {
    const stale = await db
      .prepare("SELECT key, wallet_id, action, project_id FROM requests WHERE status = 'reserved' AND action != 'clip' AND updated_at < ? LIMIT ?")
      .bind(now - STALE_S, BATCH)
      .all<{ key: string; wallet_id: string; action: string; project_id: string | null }>();
    for (const q of stale.results) {
      if (!(await refund(db, q.key))) continue;
      r.staleRefunded++;
      // A refunded analysis or helper gives its free use back (decision D-122).
      if ((q.action === 'structure' || q.action === 'assist') && q.project_id) await releaseFree(db, q.wallet_id, q.project_id);
    }
  });

  await step('stuck_clips', async () => {
    const stuck = await db.prepare("SELECT key FROM clips WHERE state = 'running' AND updated_at < ? LIMIT ?").bind(now - STUCK_RUNNING_S, BATCH).all<{ key: string }>();
    for (const c of stuck.results) {
      const res = await db.prepare("UPDATE clips SET state = 'queued', updated_at = ? WHERE key = ? AND state = 'running'").bind(now, c.key).run();
      if ((res.meta.changes ?? 0) === 1) {
        await env.CLIP_JOBS.send({ key: c.key });
        r.clipsReset++;
      }
    }
  });

  await step('stale_clips', async () => {
    const stale = await db
      .prepare("SELECT key, wallet_id FROM requests WHERE status = 'reserved' AND action = 'clip' AND updated_at < ? LIMIT ?")
      .bind(now - STALE_CLIP_S, BATCH)
      .all<{ key: string; wallet_id: string }>();
    for (const q of stale.results) {
      if (!(await refund(db, q.key))) continue;
      const [row] = await clipRows(db, q.wallet_id, [q.key]);
      await db.prepare("UPDATE clips SET state = 'failed_terminal', error = 'expired', updated_at = ? WHERE key = ? AND state IN ('queued', 'running')").bind(now, q.key).run();
      if (row) await releaseDailyAmount(db, 'anim', q.wallet_id, row.seconds);
      await deleteObjects(env, inKeys(q.key));
      r.clipsRefunded++;
    }
  });

}

/** The light pass, every 15 minutes: only abandoned work. Writes its own heartbeat. */
export async function runFrequent(env: Env, nowMs: number = Date.now()): Promise<Pick<DailyReport, 'staleRefunded' | 'clipsReset' | 'clipsRefunded' | 'errors'>> {
  const now = Math.floor(nowMs / 1000);
  const r = { staleRefunded: 0, clipsReset: 0, clipsRefunded: 0, errors: [] as string[] };
  const step: Step = async (name, f) => {
    try {
      await f();
    } catch (e) {
      r.errors.push(`${name}: ${e instanceof Error ? e.message : String(e)}`);
    }
  };
  await staleWork(env, now, r, step);
  await step('heartbeat', async () => {
    await env.DB.prepare("INSERT INTO heartbeats(job, last_run) VALUES('frequent', ?1) ON CONFLICT(job) DO UPDATE SET last_run = ?1").bind(now).run();
  });
  return r;
}

export async function runDaily(env: Env, nowMs: number = Date.now()): Promise<DailyReport> {
  const db = env.DB;
  const now = Math.floor(nowMs / 1000);
  const r: DailyReport = { staleRefunded: 0, clipsReset: 0, clipsRefunded: 0, objectsDeleted: 0, milestones: [], capsEffective: null, referrals: null, tokensCleared: 0, conversion: null, errors: [] };
  const step = async (name: string, f: () => Promise<void>): Promise<void> => {
    try {
      await f();
    } catch (e) {
      r.errors.push(`${name}: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  await staleWork(env, now, r, step);

  await step('storage_cleanup', async () => {
    const cutoff = nowMs - (await retentionHours(db)) * 3600 * 1000;
    for (const prefix of ['out/', 'in/']) {
      const old = await listOlderThan(env, prefix, cutoff, 500);
      await deleteObjects(env, old);
      r.objectsDeleted += old.length;
    }
  });

  await step('cap_milestones', async () => {
    const caps = await spendCaps(db);
    for (const [kind, cap] of [['video', caps.videoMicro], ['workers_ai', caps.workersAiMicro], ['fallback', caps.fallbackMicro], ['google_chars', caps.googleCharsMicro]] as const) {
      for (const pct of await recordMilestones(db, kind, cap)) r.milestones.push(`${kind}:${pct}`);
    }
  });

  await step('caps_policy', async () => {
    const eff = await computeEffectiveCaps(db, now);
    if (!eff) return;
    await db.prepare("INSERT INTO config(key, value) VALUES('caps_effective', ?1) ON CONFLICT(key) DO UPDATE SET value = ?1").bind(JSON.stringify(eff)).run();
    r.capsEffective = { video_usd: eff.video_usd, workers_ai_usd: eff.workers_ai_usd };
  });

  await step('referrals', async () => {
    r.referrals = await settleReferrals(db, now);
  });

  await step('expired_tokens', async () => {
    const t = await db.prepare('DELETE FROM auth_tokens WHERE expires_at < ?').bind(now - 86400).run();
    await db.prepare('DELETE FROM email_quota WHERE window < ?').bind(new Date(nowMs - 40 * 86400 * 1000).toISOString().slice(0, 7)).run();
    r.tokensCleared = t.meta.changes ?? 0;
  });

  await step('conversion_summary', async () => {
    const gate = await counterValue(db, 'r7:gate_wallets');
    const buyers = await counterValue(db, 'r7:first_buyers');
    r.conversion = { gate_wallets: gate, first_buyers: buyers };
    const summary = { gate_wallets: gate, first_buyers: buyers, ratio: gate > 0 ? Math.round((buyers / gate) * 1000) / 1000 : null, at: now };
    await db.prepare("INSERT INTO config(key, value) VALUES('r7_summary', ?1) ON CONFLICT(key) DO UPDATE SET value = ?1").bind(JSON.stringify(summary)).run();
    const reviewAt = ((await cfg<Record<string, unknown>>(db, 'r7'))?.review_at as number | undefined) ?? 500;
    if (gate >= reviewAt) await db.prepare("INSERT OR IGNORE INTO counters(key, window, count) VALUES('r7:review_milestone', 'all', ?)").bind(gate).run();
  });

  // Last: a missing or old heartbeat means the run did not finish.
  await step('heartbeat', async () => {
    await db.prepare("INSERT INTO heartbeats(job, last_run) VALUES('daily', ?1) ON CONFLICT(job) DO UPDATE SET last_run = ?1").bind(now).run();
  });
  return r;
}
