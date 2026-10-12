import { addDays, dateRange, diffDays, maxDate } from './dates';
import { KCAL_PER_KG } from './targets';
import { trendOn, type TrendResult } from './trend';
import type { DayLog, Goal, ISODate } from './types';

export const DEFAULT_WINDOW_DAYS = 21;
export const MIN_COMPLETE_DAYS = 10;
export const MIN_WEIGH_INS = 7;
export const MAX_WEEKLY_CHANGE_KCAL = 150;
export const GOAL_SETTLE_DAYS = 7;
/** How much the observed value counts, from minimum data up to a perfect window. */
export const OBSERVED_WEIGHT_RANGE = [0.2, 0.8] as const;

export interface WindowStats {
  start: ISODate;
  end: ISODate;
  /** Calendar days in the window (inclusive). */
  days: number;
  completeDays: number;
  /** Days marked complete but logged as 0 kcal. Almost always a mistake, so not counted. */
  zeroKcalDaysIgnored: number;
  avgIntake: number | null;
  weighIns: number;
  deltaTrendKg: number | null;
  /** avg intake − Δtrend × 7700 ÷ days. Null when there isn't enough data to compute. */
  observedTdee: number | null;
  /** Average estimated exercise kcal per calendar day in the window (0 if none logged). */
  avgExerciseKcal: number;
  meetsMinimum: boolean;
  /** 0–1 data quality, used for blending and the confidence indicator. */
  quality: number;
}

/**
 * First date whose data may be used after the most recent goal change.
 * The first goal counts as a change unless it's 'maintain'
 * (starting a diet causes the largest water/glycogen shift).
 */
export function settleStart(goals: Goal[], asOf: ISODate): ISODate | undefined {
  const started = goals.filter((g) => g.startDate <= asOf).sort((a, b) => (a.startDate < b.startDate ? -1 : 1));
  const latest = started[started.length - 1];
  if (!latest) return undefined;
  if (started.length === 1 && latest.type === 'maintain') return undefined;
  return addDays(latest.startDate, GOAL_SETTLE_DAYS);
}

export function windowStats(p: {
  end: ISODate;
  dayLogs: DayLog[];
  trend: TrendResult;
  goals?: Goal[];
  exerciseKcalByDate?: Map<ISODate, number>;
  windowDays?: number;
}): WindowStats {
  const windowDays = p.windowDays ?? DEFAULT_WINDOW_DAYS;
  let start = addDays(p.end, -(windowDays - 1));
  const settle = p.goals ? settleStart(p.goals, p.end) : undefined;
  if (settle) start = maxDate(start, settle);
  const firstTrend = p.trend.points[0]?.date;
  if (firstTrend) start = maxDate(start, firstTrend);

  const days = Math.max(0, diffDays(start, p.end) + 1);
  const inWindow = (d: ISODate) => d >= start && d <= p.end;

  let completeDays = 0;
  let zeroKcalDaysIgnored = 0;
  let intakeSum = 0;
  for (const log of p.dayLogs) {
    if (!inWindow(log.date) || !log.isComplete) continue;
    if (!(log.kcal > 0)) {
      zeroKcalDaysIgnored++;
      continue;
    }
    completeDays++;
    intakeSum += log.kcal;
  }

  const weighIns = p.trend.accepted.filter((w) => inWindow(w.date)).length;

  let exerciseSum = 0;
  if (days > 0 && p.exerciseKcalByDate) {
    for (const d of dateRange(start, p.end)) exerciseSum += p.exerciseKcalByDate.get(d) ?? 0;
  }

  const trendStart = trendOn(p.trend, start);
  const trendEnd = trendOn(p.trend, p.end);
  const intervals = days - 1;
  const deltaTrendKg = trendStart !== undefined && trendEnd !== undefined && days > 0 ? trendEnd - trendStart : null;
  const avgIntake = completeDays > 0 ? intakeSum / completeDays : null;
  const meetsMinimum = completeDays >= MIN_COMPLETE_DAYS && weighIns >= MIN_WEIGH_INS;
  const observedTdee =
    meetsMinimum && avgIntake !== null && deltaTrendKg !== null && intervals > 0
      ? avgIntake - (deltaTrendKg * KCAL_PER_KG) / intervals
      : null;

  const quality =
    0.5 * Math.min(1, completeDays / windowDays) + 0.5 * Math.min(1, weighIns / windowDays);

  return {
    start,
    end: p.end,
    days,
    completeDays,
    zeroKcalDaysIgnored,
    avgIntake,
    weighIns,
    deltaTrendKg,
    observedTdee,
    avgExerciseKcal: days > 0 ? exerciseSum / days : 0,
    meetsMinimum,
    quality,
  };
}

/** Observed value's share of the blend, rising with data quality. */
export function observedWeight(quality: number): number {
  const [lo, hi] = OBSERVED_WEIGHT_RANGE;
  return lo + (hi - lo) * Math.min(1, Math.max(0, quality));
}

/**
 * Move from `previous` toward `observed` by a quality-based share,
 * capped at ±maxChange (per weekly check-in).
 */
export function blendTdee(
  previous: number,
  observed: number,
  quality: number,
  maxChange: number = MAX_WEEKLY_CHANGE_KCAL,
): { value: number; capped: boolean } {
  const target = previous + observedWeight(quality) * (observed - previous);
  const change = target - previous;
  if (Math.abs(change) > maxChange) {
    return { value: previous + Math.sign(change) * maxChange, capped: true };
  }
  return { value: target, capped: false };
}

export type ConfidenceLevel = 'learning' | 'low' | 'medium' | 'high';

export function confidenceLevel(meetsMinimum: boolean, quality: number): ConfidenceLevel {
  if (!meetsMinimum) return 'learning';
  if (quality >= 0.75) return 'high';
  if (quality >= 0.55) return 'medium';
  return 'low';
}
