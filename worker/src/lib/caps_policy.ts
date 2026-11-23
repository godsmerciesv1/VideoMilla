import { cfg } from '../routes/config';

/**
 * Spend caps that follow revenue (decision D-111). Each cap is the larger of its configured floor and a share of the
 * trailing average daily sales, never above an optional ceiling the operator sets to match the funded provider
 * balance. The cron writes the result to `caps_effective`, which `spendCaps` reads. Revenue is estimated from
 * credits sold at a conservative net value per credit, because a purchase row holds credits, not dollars.
 * The cap can rise by itself; the cash behind it still has to be in the provider account.
 */
export interface CapsPolicy {
  enabled: boolean;
  shareVideo: number;
  shareWorkersAi: number;
  windowDays: number;
  creditNetUsd: number;
  ceilingVideoUsd: number | null;
  ceilingWorkersAiUsd: number | null;
}

export async function capsPolicy(db: D1Database): Promise<CapsPolicy> {
  const c = (await cfg<Record<string, unknown>>(db, 'caps_policy')) ?? {};
  const num = (k: string, d: number): number => (typeof c[k] === 'number' && (c[k] as number) >= 0 ? (c[k] as number) : d);
  const opt = (k: string): number | null => (typeof c[k] === 'number' && (c[k] as number) >= 0 ? (c[k] as number) : null);
  return {
    enabled: c.enabled !== false,
    shareVideo: num('share_video', 0.3),
    shareWorkersAi: num('share_workers_ai', 0.1),
    windowDays: Math.max(1, num('window_days', 7)),
    creditNetUsd: num('credit_net_usd', 0.0225),
    ceilingVideoUsd: opt('ceiling_video_usd'),
    ceilingWorkersAiUsd: opt('ceiling_workers_ai_usd'),
  };
}

export interface EffectiveCaps {
  video_usd: number;
  workers_ai_usd: number;
  daily_sales_usd: number;
}

/** The caps for today. Returns null when the policy is switched off. */
export async function computeEffectiveCaps(db: D1Database, now: number): Promise<EffectiveCaps | null> {
  const p = await capsPolicy(db);
  if (!p.enabled) return null;
  const floors = (await cfg<Record<string, unknown>>(db, 'caps')) ?? {};
  const floor = (k: string, d: number): number => (typeof floors[k] === 'number' ? (floors[k] as number) : d);
  const sold = await db.prepare("SELECT COALESCE(SUM(credits), 0) AS c FROM purchases WHERE created_at >= ? AND state = 'paid'").bind(now - p.windowDays * 86400).first<{ c: number }>();
  const daily = ((sold?.c ?? 0) / p.windowDays) * p.creditNetUsd;
  const scale = (share: number, floorUsd: number, ceiling: number | null): number => {
    const v = Math.max(floorUsd, share * daily);
    return Math.round((ceiling === null ? v : Math.min(v, Math.max(ceiling, floorUsd))) * 100) / 100;
  };
  return {
    video_usd: scale(p.shareVideo, floor('video_usd', 10), p.ceilingVideoUsd),
    workers_ai_usd: scale(p.shareWorkersAi, floor('workers_ai_usd', 3.3), p.ceilingWorkersAiUsd),
    daily_sales_usd: Math.round(daily * 100) / 100,
  };
}
