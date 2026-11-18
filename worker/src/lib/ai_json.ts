import type { Env } from '../env';
import { aiText, firstJsonObject } from './ai_text';
import { HttpError } from './http';
import type { Validation } from './schemas';

type Runner = { run(model: string, input: unknown): Promise<unknown> };
type Message = { role: 'system' | 'user' | 'assistant'; content: string };

export interface JsonJob<T> {
  /** Models to try in order (the language's own model, then the fallback). */
  models: string[];
  system: string;
  user: string;
  validate: (raw: Record<string, unknown> | null) => Validation<T>;
  maxTokens: number;
  /** Total tries including the first. The blueprint allows two retries, so 3. */
  attempts?: number;
}

/**
 * Asks a model for JSON, validates it, and on a bad answer tells the model what was wrong and asks again
 * (blueprint 23.5: two automatic retries, then the user is told to edit the script). All models failing to
 * answer is "busy" (nothing charged); an answer that never validates is `invalid_output`.
 * Gemma 4 reasons before answering by default; the switch below turns that off (decision D-103).
 */
export async function generateJson<T>(env: Env, job: JsonJob<T>): Promise<T> {
  const ai = env.AI as unknown as Runner;
  const messages: Message[] = [
    { role: 'system', content: job.system },
    { role: 'user', content: job.user },
  ];
  const attempts = job.attempts ?? 3;
  for (let attempt = 0; attempt < attempts; attempt++) {
    let text: string | null = null;
    for (const model of job.models) {
      try {
        const input: Record<string, unknown> = { messages, max_tokens: job.maxTokens, temperature: 0.4 };
        if (model.includes('gemma-4')) input.chat_template_kwargs = { enable_thinking: false };
        const t = aiText(await ai.run(model, input));
        if (t) {
          text = t;
          break;
        }
      } catch {
        /* try the next model */
      }
    }
    if (text === null) throw new HttpError(503, 'busy');
    const verdict = job.validate(firstJsonObject(text));
    if (verdict.ok) return verdict.value;
    messages.push(
      { role: 'assistant', content: text.slice(0, 4000) },
      { role: 'user', content: `That answer was rejected: ${verdict.error}. Return corrected JSON only, no other text.` },
    );
  }
  throw new HttpError(502, 'invalid_output');
}
