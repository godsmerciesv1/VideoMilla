import type { Env } from '../env';
import { HttpError } from './http';
import { isValidKey, resolveRetry } from './idempotency';
import { commit, refund, reserve, type Outcome } from './ledger';
import { spendCaps } from './provider_router';
import { releaseSpend, reserveSpend } from './spend_cap';

/**
 * The one runner for every paid or free AI call (picture, structure, assist, studio voice). It enforces the
 * protocol of blueprint 23.4 in a fixed order, so no route can get it subtly wrong:
 *   1. a valid idempotency key, and what an earlier call with it left behind;
 *   2. the daily Workers AI spend cap, checked BEFORE any credits move (a cap means "busy", no charge);
 *   3. price, then reserve the credits (a wallet in debt or short of credits stops here);
 *   4. the work; on success commit, on any failure refund, release the spend and give back any counter.
 * A retry with the same key never charges twice. A committed key is served again by redoing the work free.
 */
export interface PaidJob {
  key: string;
  walletId: string;
  deviceId: string;
  action: string;
  projectId?: string;
  /** Workers AI spend to reserve for this call, in millionths of a dollar. */
  estMicro: number;
  /** The price of a NEW request. May take a counter (it must then offer `undo`). */
  price: () => Promise<number>;
  /** Gives back what `price` took, when the call fails. */
  undo?: () => Promise<void>;
}

export function reserveError(o: Exclude<Outcome, 'ok'>): HttpError {
  switch (o) {
    case 'insufficient':
      return new HttpError(402, 'insufficient_credits');
    case 'debt':
      return new HttpError(402, 'debt');
    case 'unknown_wallet':
      return new HttpError(401, 'unauthorized');
    case 'duplicate':
      return new HttpError(409, 'in_progress');
  }
}

export async function runPaid(env: Env, job: PaidJob, work: (charged: number) => Promise<Response>): Promise<Response> {
  if (!isValidKey(job.key)) throw new HttpError(400, 'invalid_key');
  const db = env.DB;

  const d = await resolveRetry(db, job.key, job.walletId);
  if (d.kind === 'in_progress') throw new HttpError(409, 'in_progress');
  if (d.kind === 'delivered') throw new HttpError(409, 'already_delivered');
  if (d.kind === 'refunded') throw new HttpError(409, 'refunded');

  const caps = await spendCaps(db);
  if (!(await reserveSpend(db, 'workers_ai', job.estMicro, caps.workersAiMicro))) throw new HttpError(503, 'busy');

  let charged: number;
  if (d.kind === 'new') {
    try {
      charged = await job.price();
    } catch (e) {
      await releaseSpend(db, 'workers_ai', job.estMicro);
      throw e;
    }
    const r = await reserve(db, { key: job.key, walletId: job.walletId, deviceId: job.deviceId, action: job.action, cost: charged, projectId: job.projectId });
    if (r !== 'ok') {
      await job.undo?.();
      await releaseSpend(db, 'workers_ai', job.estMicro);
      throw reserveError(r);
    }
  } else {
    charged = d.request.credits;
  }

  try {
    const res = await work(charged);
    if (d.kind !== 'serve_committed') await commit(db, job.key);
    return res;
  } catch (e) {
    await releaseSpend(db, 'workers_ai', job.estMicro);
    if (d.kind !== 'serve_committed') {
      await refund(db, job.key);
      await job.undo?.();
    }
    throw e;
  }
}
