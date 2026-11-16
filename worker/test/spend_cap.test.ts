import { env } from 'cloudflare:workers';
import { describe, expect, it } from 'vitest';
import { fallbackAllowed, recordMilestones, releaseSpend, reserveSpend, spentToday } from '../src/lib/spend_cap';

const db = env.DB;
const reset = () => db.prepare('DELETE FROM spend').run();

describe('daily spend caps', () => {
  it('100 simultaneous reservations against a cap of 50 accept exactly 50', async () => {
    await reset();
    const results = await Promise.all(Array.from({ length: 100 }, () => reserveSpend(db, 'video', 1, 50)));
    expect(results.filter(Boolean)).toHaveLength(50);
    expect(await spentToday(db, 'video')).toBe(50);
  });

  it('refuses an amount larger than the whole cap, and counts kinds separately', async () => {
    await reset();
    expect(await reserveSpend(db, 'workers_ai', 100, 99)).toBe(false);
    expect(await reserveSpend(db, 'workers_ai', 60, 100)).toBe(true);
    expect(await reserveSpend(db, 'workers_ai', 60, 100)).toBe(false);
    expect(await reserveSpend(db, 'video', 60, 100)).toBe(true);
  });

  it('release gives spend back and never goes below zero', async () => {
    await reset();
    await reserveSpend(db, 'video', 30, 100);
    await releaseSpend(db, 'video', 10);
    expect(await spentToday(db, 'video')).toBe(20);
    await releaseSpend(db, 'video', 999);
    expect(await spentToday(db, 'video')).toBe(0);
  });

  it('the fallback budget closes when it is used up', async () => {
    await reset();
    expect(await fallbackAllowed(db, 1000)).toBe(true);
    await reserveSpend(db, 'fallback', 1000, 1000);
    expect(await fallbackAllowed(db, 1000)).toBe(false);
  });

  it('writes the 50% and 80% markers once each', async () => {
    await reset();
    await db.prepare("DELETE FROM counters WHERE key LIKE 'cap:%'").run();
    await reserveSpend(db, 'video', 49, 100);
    expect(await recordMilestones(db, 'video', 100)).toEqual([]);
    await reserveSpend(db, 'video', 1, 100);
    expect(await recordMilestones(db, 'video', 100)).toEqual([50]);
    expect(await recordMilestones(db, 'video', 100)).toEqual([]);
    await reserveSpend(db, 'video', 30, 100);
    expect(await recordMilestones(db, 'video', 100)).toEqual([80]);
  });
});
