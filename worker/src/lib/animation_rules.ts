/** The server side of the animation rules (blueprint 5.7, 23.6). The app mirrors these in `animation_planner.dart`. */
export const recommended = (n: number): number => Math.max(1, Math.round(n / 3));
/** Half of the shots, rounded up. */
export const heavierMax = (n: number): number => Math.ceil(n / 2);

/**
 * A request for [k] animated shots out of [n] needs `confirm_high` above half the shots, and `confirm_all`
 * as well when every shot (three or more) is animated. Below that no confirmation is needed.
 */
export function zoneCheck(n: number, k: number, confirmHigh: boolean, confirmAll: boolean): boolean {
  if (k > heavierMax(n) && k > recommended(n) && !confirmHigh) return false;
  if (k === n && n >= 3 && !confirmAll) return false;
  return true;
}

export const clipCredits = (seconds: number, perSecond = 2): number => perSecond * seconds;
/** A talking shot is billed by its audio's length, at least 6 credits. */
export const talkingClipCredits = (audioSeconds: number, perSecond = 2): number => Math.max(3 * perSecond, perSecond * Math.ceil(audioSeconds));
