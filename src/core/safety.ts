import type { FormulaSex, GoalType } from './types';

export const MIN_AGE_FOR_TARGETS = 18;
export const MAX_LOSS_PCT_PER_WEEK = 0.01;
export const MAX_GAIN_PCT_PER_WEEK = 0.005;

/** Calorie floor. 'average' uses the more conservative male floor. */
export function calorieFloor(sex: FormulaSex): number {
  return sex === 'female' ? 1200 : 1500;
}

export function maxRateKgPerWeek(type: GoalType, weightKg: number): number {
  if (type === 'lose') return weightKg * MAX_LOSS_PCT_PER_WEEK;
  if (type === 'gain') return weightKg * MAX_GAIN_PCT_PER_WEEK;
  return 0;
}

/** Clamp a requested rate into the safe range. */
export function clampRate(
  type: GoalType,
  rateKgPerWeek: number,
  weightKg: number,
): { rate: number; clamped: boolean } {
  const max = maxRateKgPerWeek(type, weightKg);
  const requested = Math.max(0, rateKgPerWeek);
  return requested > max ? { rate: max, clamped: true } : { rate: requested, clamped: false };
}

/** For the UI: is this rate allowed? (The UI should never offer a disallowed one.) */
export function isRateAllowed(type: GoalType, rateKgPerWeek: number, weightKg: number): boolean {
  return rateKgPerWeek >= 0 && rateKgPerWeek <= maxRateKgPerWeek(type, weightKg) + 1e-9;
}

export function canReceiveTargets(age: number): boolean {
  return age >= MIN_AGE_FOR_TARGETS;
}
