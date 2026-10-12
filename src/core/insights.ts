import type { ActivityLevel } from './types';

// Rough mapping from what people actually log to the onboarding activity level.
// The level is the higher of the steps-based and minutes-based levels.
// In adaptive mode the level only matters until the estimate learns from real data,
// so this suggestion is most useful while "still learning" or in daily-adjust mode.

const LEVELS: ActivityLevel[] = ['sedentary', 'light', 'moderate', 'very', 'extra'];
const STEP_BANDS = [5_000, 7_500, 10_000, 12_500]; // avg steps/day
const MINUTE_BANDS = [60, 150, 300, 450]; // active minutes/week
/** Need at least this many days of activity data before suggesting a change. */
export const MIN_DAYS_FOR_SUGGESTION = 14;

function band(value: number, bands: number[]): number {
  const i = bands.findIndex((b) => value < b);
  return i === -1 ? bands.length : i;
}

export function estimateActivityLevel(avgSteps: number, weeklyActiveMinutes: number): ActivityLevel {
  return LEVELS[Math.max(band(avgSteps, STEP_BANDS), band(weeklyActiveMinutes, MINUTE_BANDS))]!;
}

/** A level to suggest, or null if the current one still fits (or there's too little data). */
export function suggestActivityLevel(p: {
  current: ActivityLevel;
  avgSteps: number;
  weeklyActiveMinutes: number;
  daysOfData: number;
}): ActivityLevel | null {
  if (p.daysOfData < MIN_DAYS_FOR_SUGGESTION) return null;
  const estimated = estimateActivityLevel(p.avgSteps, p.weeklyActiveMinutes);
  return estimated === p.current ? null : estimated;
}

/** Pearson correlation, e.g. weekly avg steps vs weekly TDEE for the insights chart. */
export function correlation(xs: number[], ys: number[]): number | null {
  const n = Math.min(xs.length, ys.length);
  if (n < 3) return null;
  const mx = xs.slice(0, n).reduce((a, b) => a + b, 0) / n;
  const my = ys.slice(0, n).reduce((a, b) => a + b, 0) / n;
  let sxy = 0;
  let sxx = 0;
  let syy = 0;
  for (let i = 0; i < n; i++) {
    const dx = xs[i]! - mx;
    const dy = ys[i]! - my;
    sxy += dx * dy;
    sxx += dx * dx;
    syy += dy * dy;
  }
  return sxx === 0 || syy === 0 ? null : sxy / Math.sqrt(sxx * syy);
}
