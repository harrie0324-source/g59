import { asc, desc, eq, isNull } from 'drizzle-orm';

import type { CheckInResult } from '@/core';
import { ids } from '@/lib/ids';

import { newRow, touched } from '../rows';
import { checkIns } from '../schema';
import type { DB } from '../types';

export type CheckInRow = typeof checkIns.$inferSelect;

export const checkInsQuery = (db: DB) =>
  db.select().from(checkIns).where(isNull(checkIns.deletedAt)).orderBy(asc(checkIns.date));

export function latestCheckIn(db: DB): CheckInRow | undefined {
  return db.select().from(checkIns).where(isNull(checkIns.deletedAt)).orderBy(desc(checkIns.date)).limit(1).get();
}

/**
 * Store a computed check-in under `date` (deterministic id → one per day across devices).
 * Results without a TDEE (no weight data) are not stored.
 */
export function saveCheckIn(
  db: DB,
  date: string,
  r: CheckInResult,
  opts: { goalId?: string | null; seen?: boolean } = {},
  now = Date.now(),
): boolean {
  if (r.tdee === null || r.baselineTdee === null) return false;
  const values = {
    date,
    computedAt: now,
    goalId: opts.goalId ?? null,
    status: r.status,
    prevTdee: r.previousTdee,
    observedTdee: r.observedTdee,
    tdee: r.tdee,
    baselineTdee: r.baselineTdee,
    confidence: r.confidence,
    calorieTarget: r.targets?.calories ?? null,
    proteinG: r.targets?.proteinG ?? null,
    fatG: r.targets?.fatG ?? null,
    carbsG: r.targets?.carbsG ?? null,
    reasons: r.reasons,
    applied: true,
    seen: opts.seen ?? false,
  };
  db.insert(checkIns)
    .values({ ...newRow(now, ids.checkIn(date)), ...values })
    .onConflictDoUpdate({ target: checkIns.id, set: { ...values, deletedAt: null, ...touched(now) } })
    .run();
  return true;
}

export function markCheckInSeen(db: DB, date: string): void {
  // Local-only flag: not a user edit, so it doesn't mark the row dirty for sync.
  db.update(checkIns).set({ seen: true }).where(eq(checkIns.id, ids.checkIn(date))).run();
}
