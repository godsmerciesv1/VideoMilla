import { env } from 'cloudflare:workers';
import type { Env } from '../src/env';
import { creditPurchase } from '../src/lib/ledger';
import { clearConfigCache } from '../src/routes/config';
import worker from '../src/index';
import { uid } from './helpers';

export type Json = Record<string, any>;
export interface Call { model: string; task: string; input: any }
export type Answer = (n: number, input: any) => unknown;

export interface FakeAi {
  /** Answers per task. A function gets the 1-based call number for that task. Default is a good answer. */
  answers: Partial<Record<'structure' | 'ideas' | 'script' | 'character' | 'summary' | 'vision' | 'image' | 'tts', Answer>>;
  /** Make the guard / classifier say "unsafe" when the text contains this marker. */
  unsafeMarker: string;
  calls: Call[];
}

const content = (o: unknown): unknown => ({ choices: [{ message: { content: typeof o === 'string' ? o : JSON.stringify(o) } }] });

export const PNG_B64 = btoa(String.fromCharCode(0x89, 0x50, 0x4e, 0x47, ...Array.from({ length: 40 }, (_, i) => i)));
export const MP3 = new Uint8Array([0x49, 0x44, 0x33, ...Array.from({ length: 200 }, (_, i) => i % 200)]);

export function goodStructure(over: { characters?: any[]; style?: string; shots?: number; narration?: string } = {}): any {
  const mara = { id: 'mara', name: 'Mara', age_band: 'child', build: 'small', hair: 'black braids', skin_tone: 'brown', outfit: 'red coat', signature: 'lantern', expressions: ['smile'] };
  const tom = { id: 'tom', name: 'Tom', age_band: 'adult' };
  const n = over.shots ?? 6;
  const shots = Array.from({ length: n }, (_, i) => ({ id: `s${i}`, duration_s: 30 / n, visual: 'A lantern glows in a forest', narration: over.narration ?? 'The night was quiet.', narration_en: over.narration ?? 'The night was quiet.', lines: [], camera: 'slow push in', motion: 'zoom_in', character_ids: [] }));
  return { title: 'Lantern', characters: over.characters ?? [mara, tom], scenes: [{ id: 'sc1', heading: 'Forest', shots }] };
}

export function fakeAi(): FakeAi & { run: (model: string, input: any) => Promise<unknown> } {
  const f: FakeAi & { run: (model: string, input: any) => Promise<unknown> } = {
    answers: {},
    unsafeMarker: 'UNSAFE',
    calls: [],
    async run(model: string, input: any): Promise<unknown> {
      const text = JSON.stringify(input.messages ?? input.prompt ?? '');
      const system = String(input.messages?.[0]?.content ?? '');
      let task = 'other';
      let form: Json | undefined;
      if (input.multipart) {
        task = 'image';
        const fd = await new Response(input.multipart.body, { headers: { 'content-type': input.multipart.contentType } }).formData();
        form = { prompt: fd.get('prompt'), width: Number(fd.get('width')), height: Number(fd.get('height')), refs: [...fd.keys()].filter((k) => k.startsWith('input_image_')).length };
      } else if (model.includes('aura')) task = 'tts';
      else if (model.includes('guard')) task = 'guard';
      else if (system.includes('safety classifier')) task = 'classifier';
      else if (system.includes('short narrated video plan')) task = 'structure';
      else if (system.includes('5 short video ideas')) task = 'ideas';
      else if (system.includes('Rewrite the script as asked')) task = 'script';
      else if (system.includes('Turn the sentence into')) task = 'character';
      else if (system.includes('Update the series summary')) task = 'summary';
      else if (JSON.stringify(input).includes('reference picture')) task = 'vision';
      f.calls.push({ model, task, input: form ? { ...input, form } : input });
      const n = f.calls.filter((c) => c.task === task).length;
      const unsafe = text.includes(f.unsafeMarker);
      if (task === 'guard') return { response: { safe: !unsafe } };
      if (task === 'classifier') return content({ verdict: unsafe ? 'block' : 'allow' });
      const custom = (f.answers as Record<string, Answer | undefined>)[task];
      if (custom) return custom(n, input);
      switch (task) {
        case 'structure': return content(goodStructure());
        case 'ideas': return content({ ideas: [1, 2, 3, 4, 5].map((i) => ({ title: `Idea ${i}`, line: `Line ${i}` })) });
        case 'script': return content({ script: 'A better script that is long enough to pass the checks.' });
        case 'character': return content({ name: 'Mara', age_band: 'child', build: 'small', hair: 'braids', skin_tone: 'brown', outfit: 'coat', signature: 'lantern', expressions: ['smile'] });
        case 'summary': return content({ summary: 'Mara found the lantern and met Tom.' });
        case 'vision': return content({ face: false, explicit: false });
        case 'image': return { image: PNG_B64 };
        case 'tts': return MP3;
        default: throw new Error('unexpected AI call: ' + model);
      }
    },
  };
  return f;
}

export interface App {
  ai: ReturnType<typeof fakeAi>;
  call: (path: string, init?: RequestInit) => Promise<Response>;
  env: Env;
}

export function makeApp(extraEnv: Partial<Env> = {}): App {
  const ai = fakeAi();
  const e = { ...(env as unknown as Env), AI: ai as unknown as Ai, ...extraEnv } as Env;
  return { ai, env: e, call: (path, init = {}) => worker.fetch(new Request('https://api.test' + path, init), e) };
}

let ipCounter = 0;
export interface Account { headers: Record<string, string>; walletId: string; deviceId: string }

/** A real device and wallet through POST /session, optionally with credits from a real (ledgered) purchase. */
export async function account(app: App, credits = 0): Promise<Account> {
  const ip = `10.${(ipCounter >> 8) & 255}.${ipCounter++ & 255}.7`;
  const s = (await (await app.call('/v1/session', { method: 'POST', headers: { 'CF-Connecting-IP': ip }, body: JSON.stringify({ platform: 'android' }) })).json()) as Json;
  const row = await env.DB.prepare('SELECT wallet_id FROM devices WHERE id = ?').bind(s.deviceId).first<{ wallet_id: string }>();
  const walletId = row!.wallet_id;
  if (credits > 0) {
    const r = await creditPurchase(env.DB, { refHash: 'pur-' + uid(), walletId, channel: 'play', credits });
    if (r !== 'ok') throw new Error('purchase failed ' + r);
  }
  return { headers: { Authorization: `Device ${s.deviceId}.${s.secret}`, 'Content-Type': 'application/json' }, walletId, deviceId: s.deviceId };
}

export async function setConfig(key: string, value: unknown): Promise<void> {
  await env.DB.prepare('INSERT INTO config(key, value) VALUES(?1, ?2) ON CONFLICT(key) DO UPDATE SET value = ?2').bind(key, JSON.stringify(value)).run();
  clearConfigCache();
}

export const post = (app: App, path: string, acc: Account, body: unknown, key: string | null = 'k-' + uid()): Promise<Response> =>
  app.call(path, { method: 'POST', headers: { ...acc.headers, ...(key ? { 'X-Idempotency-Key': key } : {}) }, body: JSON.stringify(body) });

export const balanceOf = async (walletId: string): Promise<number> => (await env.DB.prepare('SELECT balance FROM wallets WHERE id = ?').bind(walletId).first<{ balance: number }>())!.balance;

// ---- clips ----
export const jpegBytes = (n = 80): Uint8Array => new Uint8Array([0xff, 0xd8, 0xff, 0xe0, ...Array.from({ length: n }, (_, i) => i % 250)]);
export const toB64 = (b: Uint8Array): string => { let s = ''; for (const x of b) s += String.fromCharCode(x); return btoa(s); };
export const JPEG_B64 = toB64(jpegBytes());

/** An MP3 of about [seconds] seconds: MPEG-1 Layer III, 128 kbps, 44.1 kHz, 417-byte frames of 1152 samples. */
export function mp3Of(seconds: number): Uint8Array {
  const frames = Math.max(2, Math.round((seconds * 44100) / 1152));
  const out = new Uint8Array(frames * 417);
  for (let f = 0; f < frames; f++) out.set([0xff, 0xfb, 0x90, 0x00], f * 417);
  return out;
}

export const mp4Bytes = (n = 4096): Uint8Array => { const b = new Uint8Array(n); b.set([0x66, 0x74, 0x79, 0x70], 4); return b; };

export class FakeQueue {
  sent: string[] = [];
  fail = false;
  async send(m: { key: string }): Promise<void> { if (this.fail) throw new Error('queue down'); this.sent.push(m.key); }
  async sendBatch(ms: Array<{ body: { key: string } }>): Promise<void> { if (this.fail) throw new Error('queue down'); for (const m of ms) this.sent.push(m.body.key); }
}

export class Msg {
  attempts = 1;
  acked = 0;
  retried: Array<number | undefined> = [];
  ack(): void { this.acked++; }
  retry(o?: { delaySeconds?: number }): void { this.retried.push(o?.delaySeconds); }
}
