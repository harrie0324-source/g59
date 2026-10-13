import { activeGoal, addDays, weeklyCheckIn, type CheckInAnchor } from '@/core';
import { saveCheckIn, type CheckInRow } from '@/db/repos/checkIns';
import type { DB } from '@/db/types';

import { loadAppData } from './appData';

export function weekdayOf(date: string): number {
  return new Date(`${date}T00:00:00Z`).getUTCDay();
}

/** Check-in days after `last`, up to and including `today`, on the user's check-in weekday. */
export function dueCheckInDates(last: string | undefined, today: string, weekday: number): string[] {
  if (!last) return [];
  const out: string[] = [];
  for (let d = addDays(last, 1); d <= today; d = addDays(d, 1)) {
    if (weekdayOf(d) === weekday) out.push(d);
  }
  return out;
}

export function toAnchorRow(r: CheckInRow | undefined): CheckInAnchor | null {
  return r ? { status: r.status, tdee: r.tdee, baselineTdee: r.baselineTdee } : null;
}

/**
 * Runs every weekly check-in that's due (catching up if the app wasn't opened),
 * each one building on the previous. Returns the dates created.
 */
export function runDueCheckIns(db: DB, today: string, now = Date.now()): string[] {
  const data = loadAppData(db);
  if (!data) return [];
  const last = data.checkIns.at(-1);
  const due = dueCheckInDates(last?.date, today, data.profileRow.checkinWeekday);
  let anchor = toAnchorRow(last);
  const created: string[] = [];
  for (const date of due) {
    const r = weeklyCheckIn({
      date,
      profile: data.profile,
      goals: data.goals,
      weights: data.weights,
      dayLogs: data.dayLogs,
      previous: anchor,
      options: { alpha: data.profileRow.emaAlpha },
    });
    const goalId = activeGoal(data.goals, date)?.id ?? null;
    if (saveCheckIn(db, date, r, { goalId }, now)) {
      created.push(date);
      anchor = { status: r.status, tdee: r.tdee!, baselineTdee: r.baselineTdee! };
    }
  }
  return created;
}
