import { and, asc, desc, eq, isNotNull, isNull, like, or, sql } from 'drizzle-orm';

import type { FoodDTO } from '@/services/food/types';

import { newRow, softDeleted, touched } from '../rows';
import { foods } from '../schema';
import type { DB } from '../types';

export type FoodRow = typeof foods.$inferSelect;

const alive = isNull(foods.deletedAt);

export const recentFoodsQuery = (db: DB) =>
  db.select().from(foods).where(and(alive, isNotNull(foods.lastUsedAt))).orderBy(desc(foods.lastUsedAt)).limit(30);

export const favoriteFoodsQuery = (db: DB) =>
  db.select().from(foods).where(and(alive, eq(foods.isFavorite, true))).orderBy(asc(foods.name));

export const customFoodsQuery = (db: DB) =>
  db.select().from(foods).where(and(alive, eq(foods.source, 'custom'))).orderBy(asc(foods.name));

/** Foods saved on this phone matching a search (name or brand), most recently used first. */
export function searchLocalFoods(db: DB, q: string, limit = 15): FoodRow[] {
  const pattern = `%${q.trim().replace(/[%_]/g, '')}%`;
  return db
    .select()
    .from(foods)
    .where(and(alive, or(like(foods.name, pattern), like(foods.brand, pattern))))
    .orderBy(sql`${foods.lastUsedAt} is null`, desc(foods.lastUsedAt), asc(foods.name))
    .limit(limit)
    .all();
}

export function getFood(db: DB, id: string): FoodRow | undefined {
  return db.select().from(foods).where(eq(foods.id, id)).get();
}

export function findFoodByBarcode(db: DB, key: string): FoodRow | undefined {
  // Stored codes may carry leading zeros (UPC-A vs EAN-13 vs GTIN-14); compare without them.
  return db
    .select()
    .from(foods)
    .where(and(alive, sql`ltrim(${foods.barcode}, '0') = ${key}`))
    .orderBy(desc(foods.lastUsedAt))
    .get();
}

/**
 * Save a USDA / Open Food Facts result on this phone (insert, or refresh the existing copy).
 * Favorites and the remembered serving are kept.
 */
export function saveExternalFood(db: DB, dto: FoodDTO, now = Date.now()): string {
  const existing =
    dto.sourceId !== null
      ? db.select().from(foods).where(and(alive, eq(foods.source, dto.source), eq(foods.sourceId, dto.sourceId))).get()
      : undefined;
  const values = {
    source: dto.source,
    sourceId: dto.sourceId,
    barcode: dto.barcode,
    name: dto.name,
    brand: dto.brand,
    kcal100g: dto.kcal100g,
    protein100g: dto.protein100g,
    carbs100g: dto.carbs100g,
    fat100g: dto.fat100g,
    fiber100g: dto.fiber100g,
    servings: dto.servings,
  };
  if (existing) {
    db.update(foods).set({ ...values, ...touched(now) }).where(eq(foods.id, existing.id)).run();
    return existing.id;
  }
  const row = newRow(now);
  db.insert(foods).values({ ...row, ...values, gramsKnown: true }).run();
  return row.id;
}

export interface CustomFoodInput {
  name: string;
  brand?: string | null;
  barcode?: string | null;
  servingLabel: string;
  /** Serving weight if known. Without it, nutrients are stored per serving (see gramsKnown). */
  servingGrams: number | null;
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
}

function customValues(input: CustomFoodInput) {
  // Without a known weight, treat one serving as 100 "units" so per-100 math still works,
  // and hide the gram option (gramsKnown = false).
  const grams = input.servingGrams ?? 100;
  const f = 100 / grams;
  return {
    source: 'custom' as const,
    name: input.name.trim(),
    brand: input.brand?.trim() || null,
    barcode: input.barcode ?? null,
    kcal100g: input.kcal * f,
    protein100g: input.proteinG * f,
    carbs100g: input.carbsG * f,
    fat100g: input.fatG * f,
    servings: [{ label: input.servingLabel.trim() || '1 serving', grams }],
    gramsKnown: input.servingGrams !== null,
  };
}

export function createCustomFood(db: DB, input: CustomFoodInput, now = Date.now()): string {
  const row = newRow(now);
  db.insert(foods).values({ ...row, ...customValues(input) }).run();
  return row.id;
}

export function updateCustomFood(db: DB, id: string, input: CustomFoodInput, now = Date.now()): void {
  db.update(foods)
    .set({ ...customValues(input), lastQty: null, lastServingLabel: null, ...touched(now) })
    .where(eq(foods.id, id))
    .run();
}

export function setFavorite(db: DB, id: string, isFavorite: boolean, now = Date.now()): void {
  db.update(foods).set({ isFavorite, ...touched(now) }).where(eq(foods.id, id)).run();
}

export function deleteFood(db: DB, id: string, now = Date.now()): void {
  db.update(foods).set(softDeleted(now)).where(eq(foods.id, id)).run();
}
