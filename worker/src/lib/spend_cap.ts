/** The four daily spend counters. Amounts are millionths of a US dollar. */
export type SpendKind = 'video' | 'workers_ai' | 'fallback' | 'google_chars';

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Adds [micro] to today's spend for [kind] only if it stays within [capMicro]. One atomic
 * conditional upsert; the changed-row count says whether it was accepted. A cap is checked
 * BEFORE credits are reserved, so reaching one means "busy" and no charge.
 */
export async function reserveSpend(db: D1Database, kind: SpendKind, micro: number, capMicro: number): Promise<boolean> {
  if (micro < 0 || micro > capMicro) return false;
  const r = await db
    .prepare(
      `INSERT INTO spend(day,kind,micro_usd) VALUES(?1,?2,?3)
       ON CONFLICT(day,kind) DO UPDATE SET micro_usd = micro_usd + excluded.micro_usd
       WHERE micro_usd + excluded.micro_usd <= ?4`,
    )
    .bind(today(), kind, micro, capMicro)
    .run();
  return (r.meta.changes ?? 0) === 1;
}

/** Gives back spend that was reserved but not used (a failed job). */
export async function releaseSpend(db: D1Database, kind: SpendKind, micro: number): Promise<void> {
  await db.prepare('UPDATE spend SET micro_usd = MAX(micro_usd - ?1, 0) WHERE day=?2 AND kind=?3').bind(micro, today(), kind).run();
}

export async function spentToday(db: D1Database, kind: SpendKind): Promise<number> {
  const row = await db.prepare('SELECT micro_usd AS m FROM spend WHERE day=? AND kind=?').bind(today(), kind).first<{ m: number }>();
  return row?.m ?? 0;
}

/** Whether the fallback providers still have budget today. */
export async function fallbackAllowed(db: D1Database, capMicro: number): Promise<boolean> {
  return (await spentToday(db, 'fallback')) < capMicro;
}

/**
 * Writes a marker row the first time today's spend passes 50% and 80% of the cap, for the daily
 * check in the runbook. Returns the markers newly written. Idempotent.
 */
export async function recordMilestones(db: D1Database, kind: SpendKind, capMicro: number): Promise<number[]> {
  if (capMicro <= 0) return [];
  const spent = await spentToday(db, kind);
  const added: number[] = [];
  for (const pct of [50, 80]) {
    if (spent * 100 >= capMicro * pct) {
      const r = await db
        .prepare("INSERT OR IGNORE INTO counters(key,window,count) VALUES(?1,?2,1)")
        .bind(`cap:${today()}:${kind}:${pct}`, today())
        .run();
      if ((r.meta.changes ?? 0) === 1) added.push(pct);
    }
  }
  return added;
}
