import { addDays, dateRange, diffDays } from './dates';
import type { ISODate, WeightEntry } from './types';

export interface TrendOptions {
  /** EMA smoothing factor per day. Default 0.1. */
  alpha?: number;
  /** Flag weigh-ins further than this fraction from the trend. Default 0.02 (2 %). */
  outlierThreshold?: number;
  /** Extend the series (carrying the trend forward) up to this date. */
  endDate?: ISODate;
}

export interface TrendPoint {
  date: ISODate;
  trendKg: number;
  /** The weigh-in used on this day, or null (no weigh-in, or it was an outlier). */
  weightKg: number | null;
  /** True for days filled by linear interpolation between two weigh-ins. */
  interpolated: boolean;
}

export interface OutlierFlag {
  entryId: string;
  date: ISODate;
  weightKg: number;
  trendKg: number;
  /** Signed fraction, e.g. 0.035 = 3.5 % above trend. */
  deviation: number;
}

export interface AcceptedWeighIn {
  entryId: string;
  date: ISODate;
  weightKg: number;
}

export interface TrendResult {
  /** One point per day from the first accepted weigh-in to endDate (or the last weigh-in). */
  points: TrendPoint[];
  outliers: OutlierFlag[];
  accepted: AcceptedWeighIn[];
}

export const DEFAULT_ALPHA = 0.1;
export const DEFAULT_OUTLIER_THRESHOLD = 0.02;

/** One weigh-in per day: the earliest of the day (usually the morning one). */
export function dailyWeighIns(entries: WeightEntry[]): WeightEntry[] {
  const byDate = new Map<ISODate, WeightEntry>();
  for (const e of entries) {
    if (!Number.isFinite(e.weightKg) || e.weightKg <= 0) continue;
    const cur = byDate.get(e.localDate);
    if (!cur || e.measuredAt < cur.measuredAt) byDate.set(e.localDate, e);
  }
  return [...byDate.values()].sort((a, b) => (a.localDate < b.localDate ? -1 : 1));
}

function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2;
}

/**
 * Exponential moving average of daily weight.
 *
 * - Gaps between two weigh-ins are linearly interpolated, and the EMA steps once per
 *   calendar day. Lag therefore stays the same whether someone weighs in daily or weekly.
 * - After the last weigh-in, the trend is carried forward unchanged.
 * - A weigh-in more than `outlierThreshold` from both the current trend and the last accepted
 *   weigh-in is flagged and left out, unless the user confirmed it (outlierStatus === 'confirmed').
 * - The seed is the median of the first 3 weigh-ins (or the first one if there are fewer),
 *   so a typo on day 1 can't poison the whole series.
 */
export function computeTrend(entries: WeightEntry[], opts: TrendOptions = {}): TrendResult {
  const alpha = opts.alpha ?? DEFAULT_ALPHA;
  const threshold = opts.outlierThreshold ?? DEFAULT_OUTLIER_THRESHOLD;
  if (!(alpha > 0 && alpha <= 1)) throw new Error('alpha must be in (0, 1]');

  const daily = dailyWeighIns(entries);
  const result: TrendResult = { points: [], outliers: [], accepted: [] };
  if (daily.length === 0) return result;

  const seedSample = daily.slice(0, 3).map((d) => d.weightKg);
  let trend = seedSample.length >= 3 ? median(seedSample) : seedSample[0]!;
  let last: { date: ISODate; weightKg: number } | null = null;

  for (const entry of daily) {
    const deviation = (entry.weightKg - trend) / trend;
    // Also compare with the last accepted weigh-in, so that after the user confirms one
    // real jump (e.g. after a holiday) the following weigh-ins aren't all flagged again.
    const farFromLast = last ? Math.abs(entry.weightKg - last.weightKg) / last.weightKg > threshold : true;
    if (Math.abs(deviation) > threshold && farFromLast && entry.outlierStatus !== 'confirmed') {
      result.outliers.push({
        entryId: entry.id,
        date: entry.localDate,
        weightKg: entry.weightKg,
        trendKg: trend,
        deviation,
      });
      continue;
    }

    if (last) {
      const gap = diffDays(last.date, entry.localDate);
      for (let i = 1; i < gap; i++) {
        const filled = last.weightKg + ((entry.weightKg - last.weightKg) * i) / gap;
        trend += alpha * (filled - trend);
        result.points.push({
          date: addDays(last.date, i),
          trendKg: trend,
          weightKg: null,
          interpolated: true,
        });
      }
    }
    trend += alpha * (entry.weightKg - trend);
    result.points.push({
      date: entry.localDate,
      trendKg: trend,
      weightKg: entry.weightKg,
      interpolated: false,
    });
    result.accepted.push({ entryId: entry.id, date: entry.localDate, weightKg: entry.weightKg });
    last = { date: entry.localDate, weightKg: entry.weightKg };
  }

  if (last && opts.endDate && opts.endDate > last.date) {
    for (const date of dateRange(addDays(last.date, 1), opts.endDate)) {
      result.points.push({ date, trendKg: trend, weightKg: null, interpolated: false });
    }
  }
  return result;
}

/** Trend on a date. Carries forward from the closest earlier point; undefined before the first. */
export function trendOn(trend: TrendResult, date: ISODate): number | undefined {
  let found: number | undefined;
  for (const p of trend.points) {
    if (p.date > date) break;
    found = p.trendKg;
  }
  return found;
}

export function latestTrend(trend: TrendResult): number | undefined {
  return trend.points[trend.points.length - 1]?.trendKg;
}
