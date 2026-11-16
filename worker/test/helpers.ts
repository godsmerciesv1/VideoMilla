import { env } from 'cloudflare:workers';
import { randomBase64Url, randomCode } from '../src/lib/crypto';
import { creditPurchase } from '../src/lib/ledger';

export const uid = (): string => randomBase64Url(9);

/** A wallet, optionally pre-loaded by a real (ledgered) purchase. */
export async function newWallet(credits = 0): Promise<string> {
  const id = 'w' + uid();
  await env.DB.prepare('INSERT INTO wallets(id, support_id) VALUES(?, ?)').bind(id, randomCode(8)).run();
  if (credits > 0) {
    const r = await creditPurchase(env.DB, { refHash: 'seed:' + id, walletId: id, channel: 'play', credits });
    if (r !== 'ok') throw new Error('seed purchase failed: ' + r);
  }
  return id;
}

export interface WalletRow {
  balance: number;
  owed: number;
  guard: number | null;
  ever_purchased: number;
  deleted: number;
}

export async function walletRow(id: string): Promise<WalletRow> {
  const r = await env.DB.prepare('SELECT balance, owed, guard, ever_purchased, deleted FROM wallets WHERE id = ?').bind(id).first<WalletRow>();
  if (!r) throw new Error('no wallet ' + id);
  return r;
}

export async function ledgerSum(id: string): Promise<number> {
  const r = await env.DB.prepare('SELECT COALESCE(SUM(delta), 0) AS s FROM ledger WHERE wallet_id = ?').bind(id).first<{ s: number }>();
  return r?.s ?? 0;
}

export async function requestStatus(key: string): Promise<{ status: string; settled: number } | null> {
  return env.DB.prepare('SELECT status, settled FROM requests WHERE key = ?').bind(key).first<{ status: string; settled: number }>();
}

export async function counter(key: string): Promise<number> {
  const r = await env.DB.prepare('SELECT count FROM counters WHERE key = ?').bind(key).first<{ count: number }>();
  return r?.count ?? 0;
}

/** The invariant that must always hold: balance equals the sum of the wallet's ledger, and nothing is negative. */
export async function expectConsistent(id: string): Promise<void> {
  const w = await walletRow(id);
  const sum = await ledgerSum(id);
  if (w.balance < 0 || w.owed < 0) throw new Error(`negative balance or debt on ${id}`);
  if (w.balance !== sum) throw new Error(`wallet ${id}: balance ${w.balance} but ledger sums to ${sum}`);
}
