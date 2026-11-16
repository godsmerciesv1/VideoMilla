import type { AgeBand } from './style_rules';
import { estimateSpeechSeconds, isAgeBand, maxCharsPerShot } from './style_rules';

export type Validation<T> = { ok: true; value: T } | { ok: false; error: string };

export const MOTIONS = ['animate', 'zoom_in', 'zoom_out', 'pan_left', 'pan_right', 'hold'] as const;
export type Motion = (typeof MOTIONS)[number];

/** Caps from blueprint Section 5.2. */
export const MAX_SHOTS = 15;
export const MAX_CHARACTERS = 6;
export const MAX_CHARACTERS_PER_SHOT = 2;
export const MIN_SHOT_SECONDS = 3;
export const MAX_SHOT_SECONDS = 10;
/** An animated talking shot's line must fit 8 seconds of speech. */
export const MAX_TALKING_SECONDS = 8;

export interface StructCharacter {
  id: string;
  name: string;
  age_band: AgeBand;
  build: string;
  hair: string;
  skin_tone: string;
  outfit: string;
  signature: string;
  expressions: string[];
}

export interface StructLine {
  character_id: string;
  text: string;
}

export interface StructShot {
  id: string;
  duration_s: number;
  visual: string;
  narration: string;
  narration_en: string;
  lines: StructLine[];
  camera: string;
  motion: Motion;
  character_ids: string[];
}

export interface StructScene {
  id: string;
  heading: string;
  shots: StructShot[];
}

export interface StructureOutput {
  title: string;
  characters: StructCharacter[];
  scenes: StructScene[];
}

const fail = <T>(error: string): Validation<T> => ({ ok: false, error });

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function str(v: unknown, max: number): string {
  return typeof v === 'string' ? v.trim().slice(0, max) : '';
}

export interface StructureOptions {
  targetLengthS: number;
  style: string;
  language: string;
}

/**
 * Checks and tidies the model's structure answer. Anything off-schema is refused (the route retries
 * twice, then tells the user to edit the script). Caps: 15 shots, 6 characters, 2 per shot; shots of
 * 3 to 10 seconds totalling the target within 10%; enums; an animated talking shot has exactly one
 * short line and no narration; Realistic Scenes has no characters at all.
 */
export function validateStructure(raw: unknown, opts: StructureOptions): Validation<StructureOutput> {
  if (!isObject(raw)) return fail('not an object');
  const noPeople = opts.style === 'realistic_scenes';

  const rawChars = raw.characters;
  if (!Array.isArray(rawChars)) return fail('characters must be a list');
  if (rawChars.length > MAX_CHARACTERS) return fail(`more than ${MAX_CHARACTERS} characters`);
  if (noPeople && rawChars.length > 0) return fail('this style shows no people');

  const characters: StructCharacter[] = [];
  const ids = new Set<string>();
  for (const c of rawChars) {
    if (!isObject(c)) return fail('character is not an object');
    const id = str(c.id, 40);
    const name = str(c.name, 60);
    if (!id || !name) return fail('character needs an id and a name');
    if (ids.has(id)) return fail(`duplicate character id ${id}`);
    if (!isAgeBand(c.age_band)) return fail(`bad age_band for ${name}`);
    ids.add(id);
    characters.push({
      id,
      name,
      age_band: c.age_band,
      build: str(c.build, 120),
      hair: str(c.hair, 120),
      skin_tone: str(c.skin_tone, 60),
      outfit: str(c.outfit, 160),
      signature: str(c.signature, 120),
      expressions: Array.isArray(c.expressions) ? c.expressions.map((e) => str(e, 40)).filter(Boolean).slice(0, 8) : [],
    });
  }

  if (!Array.isArray(raw.scenes) || raw.scenes.length === 0) return fail('scenes must be a non-empty list');
  const scenes: StructScene[] = [];
  const shotIds = new Set<string>();
  let shotCount = 0;
  let total = 0;

  for (const s of raw.scenes) {
    if (!isObject(s) || !Array.isArray(s.shots)) return fail('scene needs a shots list');
    const sceneId = str(s.id, 40) || `scene${scenes.length + 1}`;
    const shots: StructShot[] = [];
    for (const sh of s.shots) {
      if (!isObject(sh)) return fail('shot is not an object');
      shotCount++;
      if (shotCount > MAX_SHOTS) return fail(`more than ${MAX_SHOTS} shots`);
      const id = str(sh.id, 40) || `shot${shotCount}`;
      if (shotIds.has(id)) return fail(`duplicate shot id ${id}`);
      shotIds.add(id);

      const duration = typeof sh.duration_s === 'number' ? sh.duration_s : Number.NaN;
      if (!(duration >= MIN_SHOT_SECONDS && duration <= MAX_SHOT_SECONDS)) return fail(`shot ${id}: duration must be 3 to 10 seconds`);
      const visual = str(sh.visual, 600);
      if (!visual) return fail(`shot ${id}: visual is empty`);
      if (!(MOTIONS as readonly string[]).includes(String(sh.motion))) return fail(`shot ${id}: bad motion`);
      const motion = sh.motion as Motion;

      const narration = str(sh.narration, maxCharsPerShot(opts.language, MAX_SHOT_SECONDS) * 2);
      const lines: StructLine[] = [];
      for (const l of Array.isArray(sh.lines) ? sh.lines : []) {
        if (!isObject(l)) return fail(`shot ${id}: line is not an object`);
        const cid = str(l.character_id, 40);
        const text = str(l.text, 400);
        if (!text) continue;
        if (!ids.has(cid)) return fail(`shot ${id}: line by unknown character ${cid}`);
        lines.push({ character_id: cid, text });
      }

      const shotChars = new Set<string>();
      for (const cid of Array.isArray(sh.character_ids) ? sh.character_ids : []) {
        const v = str(cid, 40);
        if (!ids.has(v)) return fail(`shot ${id}: unknown character ${v}`);
        shotChars.add(v);
      }
      for (const l of lines) shotChars.add(l.character_id);
      if (noPeople && shotChars.size > 0) return fail(`shot ${id}: this style shows no people`);
      if (shotChars.size > MAX_CHARACTERS_PER_SHOT) return fail(`shot ${id}: more than ${MAX_CHARACTERS_PER_SHOT} characters`);

      if (motion === 'animate' && lines.length > 0) {
        if (lines.length !== 1 || narration) return fail(`shot ${id}: an animated talking shot has exactly one line and no narration`);
        if (estimateSpeechSeconds(lines[0]!.text, opts.language) > MAX_TALKING_SECONDS) return fail(`shot ${id}: the spoken line is longer than 8 seconds`);
      }

      total += duration;
      shots.push({
        id,
        duration_s: duration,
        visual,
        narration,
        narration_en: str(sh.narration_en, 600),
        lines,
        camera: str(sh.camera, 80),
        motion,
        character_ids: [...shotChars],
      });
    }
    if (shots.length === 0) return fail(`scene ${sceneId} has no shots`);
    scenes.push({ id: sceneId, heading: str(s.heading, 120), shots });
  }

  const tolerance = Math.max(opts.targetLengthS * 0.1, 1);
  if (Math.abs(total - opts.targetLengthS) > tolerance) {
    return fail(`total length ${total}s is not within 10% of ${opts.targetLengthS}s`);
  }
  return { ok: true, value: { title: str(raw.title, 120), characters, scenes } };
}

export interface Idea {
  title: string;
  line: string;
}

/** Exactly five ideas, each with a title and one line. */
export function validateIdeas(raw: unknown): Validation<Idea[]> {
  if (!isObject(raw) || !Array.isArray(raw.ideas)) return fail('ideas must be a list');
  const ideas: Idea[] = [];
  for (const i of raw.ideas) {
    if (!isObject(i)) return fail('idea is not an object');
    const title = str(i.title, 120);
    const line = str(i.line, 240);
    if (!title || !line) return fail('idea needs a title and a line');
    ideas.push({ title, line });
  }
  if (ideas.length !== 5) return fail('exactly 5 ideas are needed');
  return { ok: true, value: ideas };
}

export function validateScriptText(raw: unknown): Validation<string> {
  if (!isObject(raw)) return fail('not an object');
  const script = str(raw.script, 4000);
  return script ? { ok: true, value: script } : fail('script is empty');
}

export function validateCharacter(raw: unknown): Validation<Omit<StructCharacter, 'id'>> {
  if (!isObject(raw)) return fail('not an object');
  const name = str(raw.name, 60);
  if (!name) return fail('name is empty');
  if (!isAgeBand(raw.age_band)) return fail('bad age_band');
  return {
    ok: true,
    value: {
      name,
      age_band: raw.age_band,
      build: str(raw.build, 120),
      hair: str(raw.hair, 120),
      skin_tone: str(raw.skin_tone, 60),
      outfit: str(raw.outfit, 160),
      signature: str(raw.signature, 120),
      expressions: Array.isArray(raw.expressions) ? raw.expressions.map((e) => str(e, 40)).filter(Boolean).slice(0, 8) : [],
    },
  };
}

/** The series summary is 150 words or fewer. */
export function validateSummary(raw: unknown): Validation<string> {
  if (!isObject(raw)) return fail('not an object');
  const summary = str(raw.summary, 2000);
  if (!summary) return fail('summary is empty');
  const words = summary.split(/\s+/).length;
  return words <= 150 ? { ok: true, value: summary } : fail('summary is longer than 150 words');
}
