import { calorieFloor, clampRate } from './safety';
import { gPerLbToGPerKg } from './units';
import type { GoalType, Profile } from './types';

export const KCAL_PER_KG = 7700;
/** Default protein: 1 g per lb of bodyweight (≈ 2.2 g/kg). */
export const DEFAULT_PROTEIN_G_PER_KG = gPerLbToGPerKg(1);
/** Adjustable from 1.6 g/kg up to 1 g/lb. */
export const PROTEIN_G_PER_KG_RANGE = [1.6, DEFAULT_PROTEIN_G_PER_KG] as const;
/** Default fat: the larger of the per-kg minimum and 25 % of calories. */
export const DEFAULT_FAT_SHARE = 0.25;

export type TargetReason =
  | 'rate_clamped'
  | 'floor_applied'
  | 'pregnancy_no_deficit'
  | 'macros_reduced';

export interface DailyTargets {
  calories: number;
  proteinG: number;
  fatG: number;
  carbsG: number;
  /** The goal type actually applied (pregnancy can turn 'lose' into 'maintain'). */
  goalType: GoalType;
  /** The rate actually applied after safety limits. */
  rateKgPerWeek: number;
  reasons: TargetReason[];
}

export interface TargetInput {
  tdee: number;
  goal: { type: GoalType; rateKgPerWeek: number };
  weightKg: number;
  profile: Pick<Profile, 'formulaSex' | 'proteinGPerKg' | 'fatMinGPerKg' | 'pregnancyStatus'>;
}

const round10 = (n: number) => Math.round(n / 10) * 10;
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

/** Daily energy change for a weekly rate: kg/week × 7700 ÷ 7. Positive = surplus. */
export function dailyEnergyDelta(type: GoalType, rateKgPerWeek: number): number {
  if (type === 'maintain') return 0;
  const sign = type === 'gain' ? 1 : -1;
  return (sign * rateKgPerWeek * KCAL_PER_KG) / 7;
}

export function computeMacros(
  calories: number,
  weightKg: number,
  proteinGPerKg: number,
  fatMinGPerKg: number,
): { proteinG: number; fatG: number; carbsG: number; reduced: boolean } {
  let protein = clamp(proteinGPerKg, ...PROTEIN_G_PER_KG_RANGE) * weightKg;
  const fatMin = fatMinGPerKg * weightKg;
  let fat = Math.max(fatMin, (DEFAULT_FAT_SHARE * calories) / 9);
  const carbs = () => (calories - 4 * protein - 9 * fat) / 4;
  let reduced = false;

  // At very low calories protein + fat can exceed the target. Step down in a fixed order:
  // fat to its minimum, then protein to 1.6 g/kg, then carbs floor at 0.
  if (carbs() < 0) {
    fat = fatMin;
    reduced = true;
  }
  if (carbs() < 0) protein = PROTEIN_G_PER_KG_RANGE[0] * weightKg;

  return {
    proteinG: Math.round(protein),
    fatG: Math.round(fat),
    carbsG: Math.max(0, Math.round(carbs())),
    reduced,
  };
}

/** Calories + macros for a TDEE and goal, with every safety rule applied. */
export function computeTargets(input: TargetInput): DailyTargets {
  const { profile, weightKg } = input;
  const reasons: TargetReason[] = [];

  let goalType = input.goal.type;
  if (goalType === 'lose' && profile.pregnancyStatus !== 'none') {
    goalType = 'maintain';
    reasons.push('pregnancy_no_deficit');
  }

  let rate = 0;
  if (goalType !== 'maintain') {
    const clamped = clampRate(goalType, input.goal.rateKgPerWeek, weightKg);
    rate = clamped.rate;
    if (clamped.clamped) reasons.push('rate_clamped');
  }

  let calories = input.tdee + dailyEnergyDelta(goalType, rate);
  const floor = calorieFloor(profile.formulaSex);
  if (calories < floor) {
    calories = floor;
    reasons.push('floor_applied');
  }
  calories = round10(calories);

  const macros = computeMacros(calories, weightKg, profile.proteinGPerKg, profile.fatMinGPerKg);
  if (macros.reduced) reasons.push('macros_reduced');

  return {
    calories,
    proteinG: macros.proteinG,
    fatG: macros.fatG,
    carbsG: macros.carbsG,
    goalType,
    rateKgPerWeek: rate,
    reasons,
  };
}

/**
 * Daily-adjust mode only: add back a share of today's estimated exercise burn.
 * The extra calories go to carbs; protein and fat stay the same.
 */
export function withExerciseCredit(base: DailyTargets, exerciseKcal: number, credit: number): DailyTargets {
  const extra = round10(Math.max(0, exerciseKcal) * clamp(credit, 0, 1));
  if (extra === 0) return base;
  return { ...base, calories: base.calories + extra, carbsG: base.carbsG + Math.round(extra / 4) };
}
