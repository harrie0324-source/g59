import { and, asc, eq, isNull, sql } from 'drizzle-orm';

import { GRAM_UNIT, gramsFor, nutrientsFor } from '@/services/food/nutrition';

import type { FoodRow } from './foods';

import { newRow, softDeleted, touched } from '../rows';
import { foodLogs, foods, type Meal } from '../schema';
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

/** The serving to pre-select for a food: the one used last time, else its first serving. */
export function defaultServing(food: Pick<FoodRow, 'servings' | 'gramsKnown' | 'lastQty' | 'lastServingLabel'>): { qty: number; unit: string } {
  const lastValid =
    food.lastServingLabel &&
    food.lastQty &&
    (food.servings.some((s) => s.label === food.lastServingLabel) || (food.lastServingLabel === GRAM_UNIT && food.gramsKnown));
  if (lastValid) return { qty: food.lastQty!, unit: food.lastServingLabel! };
  const first = food.servings[0];
  return first ? { qty: 1, unit: first.label } : { qty: 100, unit: GRAM_UNIT };
}

export interface LogFoodInput {
  food: FoodRow;
  qty: number;
  unit: string;
  meal: Meal;
  localDate: string;
}

function snapshot(input: LogFoodInput) {
  const grams = gramsFor(input.food.servings, input.unit, input.qty);
  if (grams === null) throw new Error(`Unknown serving "${input.unit}" for ${input.food.name}`);
  const n = nutrientsFor(input.food, grams);
  return {
    localDate: input.localDate,
    meal: input.meal,
    foodId: input.food.id,
    name: input.food.brand ? `${input.food.name} · ${input.food.brand}` : input.food.name,
    servingsQty: input.qty,
    servingLabel: input.unit,
    grams: input.food.gramsKnown ? grams : null,
    kcal: n.kcal,
    proteinG: n.proteinG,
    carbsG: n.carbsG,
    fatG: n.fatG,
  };
}

function rememberServing(db: DB, input: LogFoodInput, now: number) {
  db.update(foods)
    .set({ lastUsedAt: now, lastQty: input.qty, lastServingLabel: input.unit, ...touched(now) })
    .where(eq(foods.id, input.food.id))
    .run();
}

/** Logs a food (nutrients snapshotted) and remembers the serving for next time. */
export function logFood(db: DB, input: LogFoodInput, now = Date.now()): string {
  const row = newRow(now);
  db.transaction((tx) => {
    tx.insert(foodLogs).values({ ...row, ...snapshot(input), loggedAt: now }).run();
    rememberServing(tx, input, now);
  });
  return row.id;
}

export function updateLoggedFood(db: DB, logId: string, input: LogFoodInput, now = Date.now()): void {
  db.transaction((tx) => {
    tx.update(foodLogs).set({ ...snapshot(input), ...touched(now) }).where(eq(foodLogs.id, logId)).run();
    rememberServing(tx, input, now);
  });
}

/** Copies one meal from a day to another as new entries. Returns how many were copied. */
export function copyMeal(db: DB, fromDate: string, toDate: string, meal: Meal, now = Date.now()): number {
  const source = db
    .select()
    .from(foodLogs)
    .where(and(eq(foodLogs.localDate, fromDate), eq(foodLogs.meal, meal), isNull(foodLogs.deletedAt)))
    .orderBy(asc(foodLogs.loggedAt))
    .all();
  db.transaction((tx) => {
    source.forEach((l, i) => {
      const { id: _id, createdAt: _c, updatedAt: _u, deletedAt: _d, serverUpdatedAt: _s, dirty: _x, ...rest } = l;
      tx.insert(foodLogs)
        .values({ ...newRow(now), ...rest, localDate: toDate, loggedAt: now + i })
        .run();
    });
  });
  return source.length;
}
