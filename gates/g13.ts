// G13: reference-image face check (blueprint Section 26). 50 face images and 50 plain art images,
// all generated here with FLUX.2 klein 4B (synthetic adults only; no real person is depicted).
// Pass: at least 98% of faces flagged and at least 90% of plain art accepted. Three candidate vision models.
import { QuotaError, TransientError, runForm, runJson, save, schema } from './cf.ts';

const log: string[] = [];
const say = (s: string) => { console.log(s); log.push(s); };
const KLEIN = '@cf/black-forest-labs/flux-2-klein-4b';
const SCOUT = '@cf/meta/llama-4-scout-17b-16e-instruct';
const GEMMA = '@cf/google/gemma-4-26b-a4b-it';
const MOON = '@cf/moondream/moondream3.1-9B-A2B';

// ---------- the test set ----------
const who = ['a Nigerian woman in her 30s', 'an Indian man in his 40s', 'an East Asian woman in her 20s', 'a Latino man in his 50s', 'a white European woman in her 60s',
  'a Middle Eastern man in his 30s', 'a Black man in his 70s', 'a Southeast Asian woman in her 40s', 'an elderly white man', 'a young adult woman wearing a hijab'];
const how = ['a close-up front-facing portrait', 'a side-profile portrait', 'wearing sunglasses and a baseball cap', 'a small figure far away in a busy street crowd',
  'one hand covering half of the face', 'in dim evening light'];
const faces: string[] = [];
for (let i = 0; faces.length < 50; i++) faces.push(`Realistic photograph, ${how[i % how.length]}, ${who[(i * 7) % who.length]}. No text.`);

const subjects = ['a lighthouse on a cliff', 'a teapot on a table', 'a mountain valley with a river', 'a red fox in the snow', 'a bicycle leaning on a wall',
  'an old stone house', 'a bowl of fruit', 'a sailboat at sea', 'a forest path in autumn', 'a tabby cat sleeping'];
const media = ['pencil sketch', 'watercolor painting', 'flat vector illustration', 'ink drawing', 'oil painting'];
const art: string[] = [];
for (const m of media) for (const s of subjects) art.push(`A ${m} of ${s}. No people, no text.`);

const cartoon = ['A cartoon drawing of a smiling child with a red hat', 'A comic book hero with a mask, bold outlines', 'A flat vector avatar of a woman with curly hair',
  'A watercolor storybook girl holding a lantern', 'A simple stick-figure family drawing', 'A cartoon robot with two round eyes and a mouth'];

// ---------- helpers ----------
async function pool<T>(items: T[], n: number, fn: (x: T, i: number) => Promise<void>): Promise<void> {
  let next = 0;
  await Promise.all(Array.from({ length: n }, async () => { for (;;) { const i = next++; if (i >= items.length) return; await fn(items[i]!, i); } }));
}
let quotaHit = false;
async function retry<T>(f: () => Promise<T>): Promise<T> {
  for (let a = 0; ; a++) {
    try { return await f(); } catch (e) {
      if (e instanceof QuotaError) { quotaHit = true; throw e; }
      if (a >= (e instanceof TransientError ? 6 : 2)) throw e;
      await new Promise((r) => setTimeout(r, (e instanceof TransientError ? 4000 : 1500) * (a + 1)));
    }
  }
}
const q = 'Does this image contain a human face, whether photographed, drawn or painted? Answer only with JSON {"face": true} or {"face": false}.';
const dataUrl = (b64: string) => `data:image/png;base64,${b64}`;
const chat = (url: string, extra: Record<string, unknown> = {}) => ({ messages: [{ role: 'user', content: [{ type: 'text', text: q }, { type: 'image_url', image_url: { url } }] }], ...extra });

function parseFace(text: string): boolean | null {
  const m = text.match(/"face"\s*:\s*(true|false)/i);
  if (m) return m[1]!.toLowerCase() === 'true';
  return null;
}
function textOf(r: any): string {
  if (typeof r === 'string') return r;
  const c = r?.choices?.[0]?.message?.content;
  if (typeof c === 'string' && c) return c;
  if (r?.response && typeof r.response === 'object') return JSON.stringify(r.response);
  if (typeof r?.response === 'string') return r.response;
  return JSON.stringify(r ?? {});
}
const neuronsOf = (r: any): number => Number(r?.usage?.neurons ?? 0) || 0;

// ---------- stage 0: how to talk to Gemma 4 without its hidden reasoning eating the answer ----------
let gemmaExtra: Record<string, unknown> | null = null;
try {
  const s = await schema(GEMMA);
  const props = Object.keys(s?.input?.properties ?? s?.properties ?? {});
  const one = JSON.stringify(s).match(/"(?:enable_thinking|thinking|reasoning[a-z_]*|chat_template_kwargs)"/gi) ?? [];
  say(`GEMMA schema top-level keys: ${props.join(', ') || '(oneOf)'}; reasoning-like names: ${[...new Set(one)].join(', ') || 'none'}`);
} catch (e) { say('GEMMA schema failed: ' + (e as Error).message); }

const probeImg = Buffer.from((await runForm(KLEIN, { prompt: 'A pencil sketch of a teapot. No text.', width: '512', height: '512' })).image, 'base64');
const probeUrl = dataUrl(probeImg.toString('base64'));
const variants: Array<[string, Record<string, unknown>]> = [
  ['chat_template_kwargs.enable_thinking=false', { max_tokens: 300, chat_template_kwargs: { enable_thinking: false } }],
  ['plain max_tokens 1500', { max_tokens: 1500 }],
  ['reasoning_effort=none', { max_tokens: 300, reasoning_effort: 'none' }],
  ['reasoning.effort=none', { max_tokens: 300, reasoning: { effort: 'none' } }],
];
for (const [name, extra] of variants) {
  try {
    const r = await runJson(GEMMA, chat(probeUrl, extra));
    const c = r?.choices?.[0]?.message?.content ?? '';
    say(`GEMMA variant [${name}] -> content=${JSON.stringify(String(c).slice(0, 80))} finish=${r?.choices?.[0]?.finish_reason} completion_tokens=${r?.usage?.completion_tokens} neurons=${neuronsOf(r).toFixed(2)}`);
    if (!gemmaExtra && c && parseFace(String(c)) !== null) gemmaExtra = extra;
  } catch (e) { say(`GEMMA variant [${name}] FAILED ${(e as Error).message.slice(0, 160)}`); }
}
say(`GEMMA chosen settings: ${gemmaExtra ? JSON.stringify(gemmaExtra) : 'none worked'}`);

// ---------- stage 1: generate ----------
type Item = { id: string; kind: 'face' | 'art' | 'cartoon'; prompt: string; b64?: string };
const items: Item[] = [
  ...faces.map((p, i) => ({ id: `face${String(i + 1).padStart(2, '0')}`, kind: 'face' as const, prompt: p })),
  ...art.map((p, i) => ({ id: `art${String(i + 1).padStart(2, '0')}`, kind: 'art' as const, prompt: p })),
  ...cartoon.map((p, i) => ({ id: `cartoon${i + 1}`, kind: 'cartoon' as const, prompt: p })),
];
let genFail = 0;
try {
  await pool(items, 4, async (it) => {
    try { const r = await retry(() => runForm(KLEIN, { prompt: it.prompt, width: '512', height: '512' })); it.b64 = r.image; }
    catch (e) { genFail++; say(`generate ${it.id} failed: ${(e as Error).message.slice(0, 140)}`); }
  });
} catch { /* quota: reported below */ }
const ready = items.filter((i) => i.b64);
say(`generated ${ready.length}/${items.length} images (${genFail} failures)${quotaHit ? '; DAILY QUOTA HIT' : ''}`);

// ---------- stage 2: classify ----------
type Row = { id: string; kind: string; model: string; face: boolean | null; neurons: number; raw?: string };
const rows: Row[] = [];
const models: Array<[string, (u: string) => unknown]> = [
  [SCOUT, (u) => chat(u, { max_tokens: 30 })],
  ...(gemmaExtra ? [[GEMMA, (u: string) => chat(u, gemmaExtra!)] as [string, (u: string) => unknown]] : []),
  [MOON, (u) => ({ task: 'query', image: u, question: q, reasoning: false, max_tokens: 40 })],
];
let sampleRaw = 0;
for (const [model, build] of models) {
  if (quotaHit) break;
  await pool(ready, 4, async (it) => {
    if (quotaHit) return;
    try {
      const r = await retry(() => runJson(model, build(dataUrl(it.b64!))));
      const t = textOf(r);
      if (model === MOON && sampleRaw++ < 2) say('MOONDREAM raw sample: ' + JSON.stringify(r).slice(0, 400));
      rows.push({ id: it.id, kind: it.kind, model, face: parseFace(t), neurons: neuronsOf(r), raw: parseFace(t) === null ? t.slice(0, 120) : undefined });
    } catch (e) { rows.push({ id: it.id, kind: it.kind, model, face: null, neurons: 0, raw: 'ERR ' + (e as Error).message.slice(0, 100) }); }
  });
}

// ---------- stage 3: score ----------
const out: string[] = ['| model | faces flagged | art accepted | cartoon faces flagged | unreadable | neurons per call |', '| --- | --- | --- | --- | --- | --- |'];
const verdicts: Record<string, unknown> = {};
for (const [model] of models) {
  const mr = rows.filter((r) => r.model === model);
  if (mr.length === 0) continue;
  const of = (k: string) => mr.filter((r) => r.kind === k);
  const flagged = of('face').filter((r) => r.face === true).length, nFace = of('face').length;
  const accepted = of('art').filter((r) => r.face === false).length, nArt = of('art').length;
  const cart = of('cartoon').filter((r) => r.face === true).length, nCart = of('cartoon').length;
  const unread = mr.filter((r) => r.face === null).length;
  const avgN = mr.reduce((a, r) => a + r.neurons, 0) / Math.max(1, mr.length);
  const fr = nFace ? flagged / nFace : 0, ar = nArt ? accepted / nArt : 0;
  const pass = fr >= 0.98 && ar >= 0.9;
  out.push(`| ${model} | ${flagged}/${nFace} (${(fr * 100).toFixed(0)}%) | ${accepted}/${nArt} (${(ar * 100).toFixed(0)}%) | ${cart}/${nCart} | ${unread} | ${avgN.toFixed(2)} |`);
  verdicts[model] = { facesFlagged: fr, artAccepted: ar, pass };
  const missedFaces = of('face').filter((r) => r.face !== true).map((r) => r.id);
  const rejectedArt = of('art').filter((r) => r.face !== false).map((r) => r.id);
  say(`${model}: PASS=${pass}; missed faces: ${missedFaces.join(' ') || 'none'}; art wrongly flagged or unreadable: ${rejectedArt.join(' ') || 'none'}`);
}
say('\n' + out.join('\n'));
say(quotaHit ? 'RESULT INCOMPLETE: the daily Workers AI quota stopped the run. Rerun after 00:00 UTC.' : 'RESULT COMPLETE');
save('g13_table.md', out.join('\n'));
save('g13_results.json', JSON.stringify({ verdicts, rows, generated: ready.length, quotaHit }, null, 1));
save('g13.log', log.join('\n'));
// keep a handful of images for human review: the first face and the first art image
for (const id of ['face01', 'face04', 'art01']) { const it = ready.find((x) => x.id === id); if (it) save(`${id}.png`, Buffer.from(it.b64!, 'base64')); }
