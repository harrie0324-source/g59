import type { ActivityLog, ISODate, Intensity } from '../types';
import { FALLBACK_MET, getActivityType } from './compendium';

/**
 * Net kcal = (MET − 1) × kg × hours.
 * Subtracting 1 MET (resting) keeps BMR from being counted twice, because TDEE already includes it.
 */
export function netMetKcal(met: number, weightKg: number, durationMin: number): number {
  if (durationMin <= 0 || weightKg <= 0) return 0;
  return Math.max(0, met - 1) * weightKg * (durationMin / 60);
}

export function metFor(activityCode: string, intensity: Intensity): number {
  return getActivityType(activityCode)?.met[intensity] ?? FALLBACK_MET[intensity];
}

export function activityKcal(log: Pick<ActivityLog, 'activityCode' | 'intensity' | 'durationMin'>, weightKg: number): number {
  return netMetKcal(metFor(log.activityCode, log.intensity), weightKg, log.durationMin);
}

/** Strength sessions: the user's session RPE (1–10) picks the intensity. */
export function intensityFromRpe(rpe: number): Intensity {
  if (rpe >= 8) return 'vigorous';
  if (rpe >= 6) return 'moderate';
  return 'light';
}

/** Total estimated exercise kcal per day. Pass logs that have already been deduped. */
export function exerciseKcalByDate(logs: ActivityLog[], weightKg: number): Map<ISODate, number> {
  const out = new Map<ISODate, number>();
  for (const log of logs) {
    out.set(log.localDate, (out.get(log.localDate) ?? 0) + activityKcal(log, weightKg));
  }
  return out;
}

/**
 * Burn numbers are rough estimates. Always show them rounded with "~".
 * Rounds to the nearest 10 kcal (nearest 5 under 50).
 */
export function formatApproxKcal(kcal: number): string {
  const step = kcal < 50 ? 5 : 10;
  const rounded = Math.max(0, Math.round(kcal / step) * step);
  return `~${rounded.toLocaleString('en-US')} kcal`;
}
