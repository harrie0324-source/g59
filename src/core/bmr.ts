import type { ActivityLevel, CalorieMode, FormulaSex } from './types';

export const ACTIVITY_MULTIPLIERS: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  very: 1.725,
  extra: 1.9,
};

const LEVELS: ActivityLevel[] = ['sedentary', 'light', 'moderate', 'very', 'extra'];

/** Mifflin-St Jeor. 'average' = mean of the male and female equations (offset −78). */
export function mifflinStJeor(p: {
  sex: FormulaSex;
  weightKg: number;
  heightCm: number;
  age: number;
}): number {
  const base = 10 * p.weightKg + 6.25 * p.heightCm - 5 * p.age;
  const offset = p.sex === 'male' ? 5 : p.sex === 'female' ? -161 : -78;
  return base + offset;
}

/**
 * Multiplier used for the starting estimate.
 * In daily-adjust mode, logged exercise is added on top every day, so the
 * baseline uses one level lower (min sedentary) to avoid counting it twice.
 */
export function baselineMultiplier(level: ActivityLevel, mode: CalorieMode): number {
  if (mode === 'adaptive') return ACTIVITY_MULTIPLIERS[level];
  const idx = Math.max(0, LEVELS.indexOf(level) - 1);
  return ACTIVITY_MULTIPLIERS[LEVELS[idx]!];
}

export function formulaTdee(p: {
  sex: FormulaSex;
  weightKg: number;
  heightCm: number;
  age: number;
  activityLevel: ActivityLevel;
  mode?: CalorieMode;
}): number {
  return mifflinStJeor(p) * baselineMultiplier(p.activityLevel, p.mode ?? 'adaptive');
}
