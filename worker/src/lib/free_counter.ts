/**
 * Atomic counters on the `counters` table (blueprint 23.4: `UPDATE ... RETURNING count`).
 * A call takes a count first; if the call then fails, it gives the count back, so a failure never
 * uses up a free analysis (blueprint T-AST-07).
 */
async function take(db: D1Database, key: string, window: string): Promise<number> {
  const row = await db
    .prepare(
      `INSERT INTO counters(key, window, count) VALUES(?1, ?2, 1)
       ON CONFLICT(key) DO UPDATE SET count = count + 1
       RETURNING count`,
    )
    .bind(key, window)
    .first<{ count: number }>();
  return row?.count ?? 0;
}

async function release(db: D1Database, key: string): Promise<void> {
  await db.prepare('UPDATE counters SET count = MAX(count - 1, 0) WHERE key = ?').bind(key).run();
}

const freeKey = (walletId: string, projectId: string): string => `free:${walletId}:${projectId}`;

/** Uses one analysis or helper in a project; returns how many have now been taken, including this one. */
export const takeFree = (db: D1Database, walletId: string, projectId: string): Promise<number> => take(db, freeKey(walletId, projectId), 'all');
export const releaseFree = (db: D1Database, walletId: string, projectId: string): Promise<void> => release(db, freeKey(walletId, projectId));

const day = (): string => new Date().toISOString().slice(0, 10);
const dailyKey = (kind: string, walletId: string): string => `daily:${kind}:${walletId}:${day()}`;

/** A per-wallet, per-day counter (for example pictures). */
export const takeDaily = (db: D1Database, kind: string, walletId: string): Promise<number> => take(db, dailyKey(kind, walletId), day());
export const releaseDaily = (db: D1Database, kind: string, walletId: string): Promise<void> => release(db, dailyKey(kind, walletId));
