// Probe: what do the candidate vision models accept, and does one image generate and classify? Cheap.
import { QuotaError, runForm, runJson, save, schema } from './cf.ts';

const log: string[] = [];
const say = (s: string) => { console.log(s); log.push(s); };

const MODELS = ['@cf/moondream/moondream3.1-9B-A2B', '@cf/meta/llama-4-scout-17b-16e-instruct', '@cf/google/gemma-4-26b-a4b-it', '@cf/black-forest-labs/flux-2-klein-4b'];
for (const m of MODELS) {
  try {
    const s = await schema(m);
    say(`=== SCHEMA ${m}\n${JSON.stringify(s?.input ?? s, null, 1).slice(0, 2500)}`);
  } catch (e) { say(`=== SCHEMA ${m} FAILED ${(e as Error).message}`); }
}

let b64 = '';
try {
  const r = await runForm('@cf/black-forest-labs/flux-2-klein-4b', { prompt: 'A plain pencil sketch of a lighthouse on a cliff, no people, no text', width: '512', height: '512' });
  b64 = typeof r === 'string' ? r : (r?.image ?? '');
  say(`IMAGE result keys: ${typeof r === 'object' ? Object.keys(r).join(',') : typeof r}; base64 length ${b64.length}`);
  if (b64) save('probe.png', Buffer.from(b64, 'base64'));
} catch (e) { say(`IMAGE FAILED ${(e as Error).message}`); }

if (b64) {
  const url = `data:image/png;base64,${b64}`;
  const q = 'Does this image contain a human face? Answer only with JSON {"face": true} or {"face": false}.';
  const tries: Array<[string, unknown]> = [
    ['@cf/meta/llama-4-scout-17b-16e-instruct', { messages: [{ role: 'user', content: [{ type: 'text', text: q }, { type: 'image_url', image_url: { url } }] }], max_tokens: 30 }],
    ['@cf/google/gemma-4-26b-a4b-it', { messages: [{ role: 'user', content: [{ type: 'text', text: q }, { type: 'image_url', image_url: { url } }] }], max_tokens: 30 }],
    ['@cf/moondream/moondream3.1-9B-A2B', { image: url, prompt: q }],
  ];
  for (const [m, input] of tries) {
    try { say(`=== CALL ${m}\n${JSON.stringify(await runJson(m, input)).slice(0, 600)}`); }
    catch (e) { say(`=== CALL ${m} FAILED ${e instanceof QuotaError ? '(QUOTA) ' : ''}${(e as Error).message}`); }
  }
}
save('probe.log', log.join('\n'));
