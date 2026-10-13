// Everything the Today screen shows, computed from plain data (no React, no DB).
import {
  addDays,
  computeTrend,
  latestTrend,
  settleStart,
  weeklyCheckIn,
  type ConfidenceLevel,
  type DayLog,
  type Goal,
  type Profile,
  type WeightEntry,
} from '@/core';
import type { CheckInRow } from '@/db/repos/checkIns';

export interface Macros {
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
}

export interface TodayModel {
  target: Macros | null;
  eaten: Macros;
  /** Positive = left today, negative = above today's target. Null without a target. */
  remainingKcal: number | null;
  trendKg: number | null;
  latestWeight: { kg: number; date: string } | null;
  /** Most recent unusual weigh-in (last 14 days) waiting for "keep or remove". */
  outlier: { entryId: string; weightKg: number; date: string } | null;
  estimate: {
    tdee: number;
    status: 'learning' | 'adaptive' | 'holding';
    confidence: ConfidenceLevel;
    /** Still needed before the estimate learns from real data (live, includes today). */
    needed: { completeDays: number; weighIns: number };
    /** First day that counts after a goal change (water/glycogen settling), if still ahead. */
    learningStarts: string | null;
  } | null;
  /** Newest weekly check-in the user hasn't opened yet. */
  unseenCheckIn: string | null;
}

export interface TodayInput {
  date: string;
  today: string;
  profile: Profile;
  emaAlpha: number;
  goals: Goal[];
  weights: WeightEntry[];
  dayLogs: DayLog[];
  checkIns: CheckInRow[];
  dayFood: Pick<Macros, 'kcal' | 'proteinG' | 'carbsG' | 'fatG'>[];
}

const OUTLIER_LOOKBACK_DAYS = 14;

/** The check-in whose targets apply on `date`: the latest one on or before it (else the first). */
export function checkInFor(checkIns: CheckInRow[], date: string): CheckInRow | undefined {
  let found: CheckInRow | undefined;
  for (const c of checkIns) {
    if (c.date <= date) found = c;
  }
  return found ?? checkIns[0];
}

export function buildTodayModel(i: TodayInput): TodayModel {
  const eaten = i.dayFood.reduce<Macros>(
    (acc, f) => ({
      kcal: acc.kcal + f.kcal,
      proteinG: acc.proteinG + f.proteinG,
      carbsG: acc.carbsG + f.carbsG,
      fatG: acc.fatG + f.fatG,
    }),
    { kcal: 0, proteinG: 0, carbsG: 0, fatG: 0 },
  );

  const ci = checkInFor(i.checkIns, i.date);
  const target =
    ci && ci.calorieTarget !== null
      ? { kcal: ci.calorieTarget, proteinG: ci.proteinG ?? 0, carbsG: ci.carbsG ?? 0, fatG: ci.fatG ?? 0 }
      : null;

  const trend = computeTrend(i.weights, { alpha: i.emaAlpha, endDate: i.today });
  const last = trend.accepted.at(-1);
  const recentOutlier = trend.outliers
    .filter((o) => o.date >= addDays(i.today, -OUTLIER_LOOKBACK_DAYS))
    .at(-1);

  // "Live" progress: as if a check-in ran tomorrow, so today's entries count.
  const live = weeklyCheckIn({
    date: addDays(i.today, 1),
    profile: i.profile,
    goals: i.goals,
    weights: i.weights,
    dayLogs: i.dayLogs,
    previous: null,
    options: { alpha: i.emaAlpha },
  });
  const latest = i.checkIns.at(-1);
  const settle = settleStart(i.goals, i.today);

  return {
    target,
    eaten,
    remainingKcal: target ? target.kcal - eaten.kcal : null,
    trendKg: latestTrend(trend) ?? null,
    latestWeight: last ? { kg: last.weightKg, date: last.date } : null,
    outlier: recentOutlier ? { entryId: recentOutlier.entryId, weightKg: recentOutlier.weightKg, date: recentOutlier.date } : null,
    estimate: latest
      ? {
          tdee: latest.tdee,
          status: latest.status,
          confidence: latest.confidence,
          needed: live.needed,
          learningStarts: settle && settle > i.today ? settle : null,
        }
      : null,
    unseenCheckIn: [...i.checkIns].reverse().find((c) => !c.seen)?.date ?? null,
  };
}
