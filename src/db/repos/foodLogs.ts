import { and, asc, eq, isNull, sql } from 'drizzle-orm';

import { newRow, softDeleted, touched } from '../rows';
import { foodLogs, type Meal } from '../schema';
import type { DB } from '../types';

export type FoodLogRow = typeof foodLogs.$inferSelect;

export interface QuickAddInput {
  localDate: string;
  meal: Meal;
  name?: string;
  kcal: number;
  proteinG?: number;
  carbsG?: number;
  fatG?: number;
}

export const foodLogsForDateQuery = (db: DB, date: string) =>
  db
    .select()
    .from(foodLogs)
    .where(and(eq(foodLogs.localDate, date), isNull(foodLogs.deletedAt)))
    .orderBy(asc(foodLogs.loggedAt));

/** Per-day totals, used by the TDEE window. */
export const dailyTotalsQuery = (db: DB) =>
  db
    .select({
      date: foodLogs.localDate,
      kcal: sql<number>`coalesce(sum(${foodLogs.kcal}), 0)`,
      proteinG: sql<number>`coalesce(sum(${foodLogs.proteinG}), 0)`,
      carbsG: sql<number>`coalesce(sum(${foodLogs.carbsG}), 0)`,
      fatG: sql<number>`coalesce(sum(${foodLogs.fatG}), 0)`,
    })
    .from(foodLogs)
    .where(isNull(foodLogs.deletedAt))
    .groupBy(foodLogs.localDate);

export function getFoodLog(db: DB, id: string): FoodLogRow | undefined {
  return db.select().from(foodLogs).where(eq(foodLogs.id, id)).get();
}

export function quickAdd(db: DB, input: QuickAddInput, now = Date.now()): string {
  const row = newRow(now);
  db.insert(foodLogs)
    .values({
      ...row,
      localDate: input.localDate,
      meal: input.meal,
      foodId: null,
      name: input.name?.trim() || 'Quick add',
      kcal: input.kcal,
      proteinG: input.proteinG ?? 0,
      carbsG: input.carbsG ?? 0,
      fatG: input.fatG ?? 0,
      loggedAt: now,
    })
    .run();
  return row.id;
}

export function updateQuickAdd(db: DB, id: string, input: QuickAddInput, now = Date.now()): void {
  db.update(foodLogs)
    .set({
      localDate: input.localDate,
      meal: input.meal,
      name: input.name?.trim() || 'Quick add',
      kcal: input.kcal,
      proteinG: input.proteinG ?? 0,
      carbsG: input.carbsG ?? 0,
      fatG: input.fatG ?? 0,
      ...touched(now),
    })
    .where(eq(foodLogs.id, id))
    .run();
}

export function deleteFoodLog(db: DB, id: string, now = Date.now()): void {
  db.update(foodLogs).set(softDeleted(now)).where(eq(foodLogs.id, id)).run();
}
