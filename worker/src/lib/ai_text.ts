/** Reading Workers AI answers. Chat models answer in `choices[0].message.content`; older ones in `response`. */
export function aiText(result: unknown): string {
  const r = result as { choices?: Array<{ message?: { content?: unknown } }>; response?: unknown } | null | undefined;
  const c = r?.choices?.[0]?.message?.content;
  if (typeof c === 'string' && c) return c;
  if (typeof r?.response === 'string') return r.response;
  if (r?.response && typeof r.response === 'object') return JSON.stringify(r.response);
  return '';
}

/** The first `{...}` object in a text that parses as JSON, or null. Models sometimes wrap JSON in prose. */
export function firstJsonObject(text: string): Record<string, unknown> | null {
  for (let start = text.indexOf('{'); start !== -1; start = text.indexOf('{', start + 1)) {
    let depth = 0;
    for (let i = start; i < text.length; i++) {
      const ch = text[i];
      if (ch === '{') depth++;
      else if (ch === '}' && --depth === 0) {
        try {
          const v = JSON.parse(text.slice(start, i + 1));
          if (v && typeof v === 'object' && !Array.isArray(v)) return v as Record<string, unknown>;
        } catch {
          /* try the next opening brace */
        }
        break;
      }
    }
  }
  return null;
}
