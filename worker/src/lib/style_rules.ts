/** The eight style ids (wire names, shared with the app) and the rules that depend on them (blueprint 5.2, 5.3, 23.5). */
export const STYLE_IDS = ['storybook', 'comic', 'flat_vector', 'watercolor', 'ink_noir', 'cinematic', 'photoreal_story', 'realistic_scenes'] as const;
export type StyleId = (typeof STYLE_IDS)[number];

export const AGE_BANDS = ['child', 'teen', 'adult', 'mid', 'elder'] as const;
export type AgeBand = (typeof AGE_BANDS)[number];

/** Children and teenagers may appear only in these four styles. */
const CARTOON: ReadonlySet<string> = new Set(['storybook', 'comic', 'flat_vector', 'watercolor']);

export function isStyleId(v: unknown): v is StyleId {
  return typeof v === 'string' && (STYLE_IDS as readonly string[]).includes(v);
}

export function isAgeBand(v: unknown): v is AgeBand {
  return typeof v === 'string' && (AGE_BANDS as readonly string[]).includes(v);
}

export function isCartoon(style: string): boolean {
  return CARTOON.has(style);
}

export type StyleVerdict = 'ok' | 'needs_style_change' | 'invalid';

/**
 * Realistic Scenes shows no people, so any character at all is invalid. Elsewhere a child or a
 * teenager needs a cartoon style; otherwise the app offers a switch (or hiding those characters).
 */
export function styleVerdict(style: string, ages: readonly string[]): StyleVerdict {
  if (style === 'realistic_scenes') return ages.length === 0 ? 'ok' : 'invalid';
  const minors = ages.some((a) => a === 'child' || a === 'teen');
  return minors && !CARTOON.has(style) ? 'needs_style_change' : 'ok';
}

/** The styles that fit a cast, offered with `needs_style_change`. */
export function allowedStyles(ages: readonly string[]): StyleId[] {
  return STYLE_IDS.filter((s) => styleVerdict(s, ages) === 'ok');
}

/**
 * Spoken characters per second, by language. Provisional planning rates (not measured): they size
 * shots before audio exists, and are tuned per language at gate G7.
 */
const CHARS_PER_SECOND: Record<string, number> = { ja: 5, zh_Hant: 5, ko: 8, th: 10 };
const DEFAULT_CHARS_PER_SECOND = 14;

function charsPerSecond(language: string): number {
  return CHARS_PER_SECOND[language] ?? DEFAULT_CHARS_PER_SECOND;
}

/** The most narration characters that fit a shot of [seconds] (default: the longest shot, 10 s). */
export function maxCharsPerShot(language: string, seconds = 10): number {
  return Math.floor(charsPerSecond(language) * seconds);
}

/** Whole seconds a text takes to speak, counting characters (spaces do not separate words in every script). */
export function estimateSpeechSeconds(text: string, language: string): number {
  return Math.ceil([...text.trim()].length / charsPerSecond(language));
}
