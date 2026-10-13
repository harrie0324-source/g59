// Database rows → pure core types.
import type { DayLog, Goal, Profile, WeightEntry } from '@/core';

import type { DayRow } from './repos/days';
import type { GoalRow } from './repos/goals';
import type { ProfileRow } from './repos/profile';
import type { WeightRow } from './repos/weights';

export function toProfile(r: ProfileRow): Profile {
  return {
    formulaSex: r.formulaSex,
    birthDate: r.birthDate,
    heightCm: r.heightCm,
    activityLevel: r.activityLevel,
    calorieMode: r.calorieMode,
    exerciseCredit: r.exerciseCredit,
    proteinGPerKg: r.proteinGPerKg,
    fatMinGPerKg: r.fatMinGPerKg,
    pregnancyStatus: r.pregnancyStatus,
  };
}

export function toGoal(r: GoalRow): Goal {
  return { id: r.id, type: r.type, rateKgPerWeek: r.rateKgPerWeek, startDate: r.startDate };
}

export function toWeightEntry(r: WeightRow): WeightEntry {
  return {
    id: r.id,
    localDate: r.localDate,
    measuredAt: r.measuredAt,
    weightKg: r.weightKg,
    source: r.source,
    outlierStatus: r.outlierStatus,
  };
}

/** Combine per-day food totals with "fully logged" flags. Days with neither are omitted. */
export function toDayLogs(totals: { date: string; kcal: number }[], days: DayRow[]): DayLog[] {
  const byDate = new Map<string, DayLog>();
  for (const t of totals) byDate.set(t.date, { date: t.date, kcal: t.kcal, isComplete: false });
  for (const d of days) {
    const cur = byDate.get(d.localDate) ?? { date: d.localDate, kcal: 0, isComplete: false };
    byDate.set(d.localDate, { ...cur, isComplete: d.isComplete });
  }
  return [...byDate.values()].sort((a, b) => (a.date < b.date ? -1 : 1));
}
