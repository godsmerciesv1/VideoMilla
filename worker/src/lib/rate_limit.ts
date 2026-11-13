import { nowSeconds } from './crypto';

export interface RateResult {
  allowed: boolean;
  count: number;
  limit: number;
  retryAfterSec: number;
}

/**
 * Fixed-window counter in the `counters` table: one atomic statement per call.
 * A new window resets the count; the (limit + 1)th call in a window is refused.
 */
export async function hit(db: D1Database, key: string, limit: number, windowSec: number): Promise<RateResult> {
  const now = nowSeconds();
  const window = String(Math.floor(now / windowSec));
  const row = await db
    .prepare(
      `INSERT INTO counters(key, window, count) VALUES(?1, ?2, 1)
       ON CONFLICT(key) DO UPDATE SET
         window = excluded.window,
         count = CASE WHEN counters.window = excluded.window THEN counters.count + 1 ELSE 1 END
       RETURNING count`,
    )
    .bind(key, window)
    .first<{ count: number }>();
  const count = row?.count ?? 1;
  const retryAfterSec = windowSec - (now % windowSec);
  return { allowed: count <= limit, count, limit, retryAfterSec };
}
