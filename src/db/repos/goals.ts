import { and, asc, isNull } from 'drizzle-orm';

import type { GoalType } from '@/core';

import { newRow, touched } from '../rows';
import { goals } from '../schema';
import type { DB } from '../types';

export type GoalRow = typeof goals.$inferSelect;

export const goalsQuery = (db: DB) =>
  db.select().from(goals).where(isNull(goals.deletedAt)).orderBy(asc(goals.startDate), asc(goals.createdAt));

/** Ends the active goal (if any) and starts a new one. */
export function startGoal(
  db: DB,
  goal: { type: GoalType; rateKgPerWeek: number; startDate: string; targetWeightKg?: number | null },
  now = Date.now(),
): string {
  const row = newRow(now);
  db.transaction((tx) => {
    tx.update(goals)
      .set({ endDate: goal.startDate, ...touched(now) })
      .where(and(isNull(goals.endDate), isNull(goals.deletedAt)))
      .run();
    tx.insert(goals)
      .values({
        ...row,
        type: goal.type,
        rateKgPerWeek: goal.type === 'maintain' ? 0 : goal.rateKgPerWeek,
        targetWeightKg: goal.targetWeightKg ?? null,
        startDate: goal.startDate,
        endDate: null,
      })
      .run();
  });
  return row.id;
}
