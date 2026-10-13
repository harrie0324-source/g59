import { parseOffProduct } from '@/services/food/off';
import { parseUsdaSearch } from '@/services/food/usda';
import { offProduct, usdaSearch } from '@/services/food/__tests__/fixtures';

import {
  createCustomFood,
  customFoodsQuery,
  deleteFood,
  favoriteFoodsQuery,
  findFoodByBarcode,
  getFood,
  recentFoodsQuery,
  saveExternalFood,
  searchLocalFoods,
  setFavorite,
  updateCustomFood,
} from '../repos/foods';
import { copyMeal, dailyTotalsQuery, defaultServing, foodLogsForDateQuery, logFood, updateLoggedFood } from '../repos/foodLogs';
import { createTestDb } from './testDb';

const [yogurt, srYogurt] = parseUsdaSearch(usdaSearch);
const nutella = parseOffProduct(offProduct, '3017620422003')!;
const D = '2026-10-13';

describe('foods repository', () => {
  it('saves external foods once (by source id) and keeps favorites when refreshed', () => {
    const db = createTestDb();
    const id = saveExternalFood(db, yogurt!, 1);
    setFavorite(db, id, true);
    expect(saveExternalFood(db, { ...yogurt!, kcal100g: 55 }, 2)).toBe(id);
    expect(getFood(db, id)).toMatchObject({ kcal100g: 55, isFavorite: true, gramsKnown: true });
    expect(favoriteFoodsQuery(db).all().map((f) => f.id)).toEqual([id]);
  });

  it('finds by barcode regardless of leading zeros', () => {
    const db = createTestDb();
    const id = saveExternalFood(db, yogurt!); // stored as 818290014191
    expect(findFoodByBarcode(db, '818290014191')!.id).toBe(id);
    expect(findFoodByBarcode(db, '0818290014191'.replace(/^0+/, ''))!.id).toBe(id);
    expect(findFoodByBarcode(db, '999')).toBeUndefined();
  });

  it('local search matches name or brand, recently used first', () => {
    const db = createTestDb();
    const a = saveExternalFood(db, yogurt!);
    const b = saveExternalFood(db, srYogurt!);
    saveExternalFood(db, nutella);
    logFood(db, { food: getFood(db, b)!, qty: 1, unit: '1 cup (245 g)', meal: 'breakfast', localDate: D }, 50);
    expect(searchLocalFoods(db, 'yogurt').map((f) => f.id)).toEqual([b, a]);
    expect(searchLocalFoods(db, 'ferrero').map((f) => f.name)).toEqual(['Nutella']);
    expect(searchLocalFoods(db, '100%_')).toEqual([]);
  });

  it('custom foods: per-serving entry with and without a weight', () => {
    const db = createTestDb();
    const bar = createCustomFood(db, { name: ' Protein bar ', servingLabel: '1 bar', servingGrams: 45, kcal: 200, proteinG: 20, carbsG: 22, fatG: 7 });
    const soup = createCustomFood(db, { name: "Mom's soup", servingLabel: '1 bowl', servingGrams: null, kcal: 300, proteinG: 15, carbsG: 30, fatG: 10 });
    expect(getFood(db, bar)).toMatchObject({ name: 'Protein bar', kcal100g: 200 / 0.45, gramsKnown: true, servings: [{ label: '1 bar', grams: 45 }] });
    expect(getFood(db, soup)).toMatchObject({ kcal100g: 300, gramsKnown: false, servings: [{ label: '1 bowl', grams: 100 }] });
    expect(customFoodsQuery(db).all().map((f) => f.name)).toEqual(["Mom's soup", 'Protein bar']);

    updateCustomFood(db, bar, { name: 'Protein bar', servingLabel: '1 bar', servingGrams: 50, kcal: 210, proteinG: 21, carbsG: 22, fatG: 7 });
    expect(getFood(db, bar)!.kcal100g).toBeCloseTo(420);
    deleteFood(db, soup);
    expect(customFoodsQuery(db).all()).toHaveLength(1);
  });
});

describe('logging foods', () => {
  it('snapshots nutrients, remembers the serving, and feeds recents', () => {
    const db = createTestDb();
    const food = getFood(db, saveExternalFood(db, yogurt!))!;
    expect(defaultServing(food)).toEqual({ qty: 1, unit: '1 container (150 g)' });

    logFood(db, { food, qty: 1.5, unit: '1 container (150 g)', meal: 'breakfast', localDate: D }, 100);
    const [log] = foodLogsForDateQuery(db, D).all();
    expect(log).toMatchObject({ foodId: food.id, name: 'Greek Nonfat Yogurt, Plain · Chobani', servingsQty: 1.5, grams: 225 });
    expect(log!.kcal).toBeCloseTo(119.25);
    expect(log!.proteinG).toBeCloseTo(22.5);

    const after = getFood(db, food.id)!;
    expect(after).toMatchObject({ lastUsedAt: 100, lastQty: 1.5, lastServingLabel: '1 container (150 g)' });
    expect(defaultServing(after)).toEqual({ qty: 1.5, unit: '1 container (150 g)' });
    expect(recentFoodsQuery(db).all().map((f) => f.id)).toEqual([food.id]);
  });

  it('logs by grams; a food without a known weight stores no grams', () => {
    const db = createTestDb();
    const nut = getFood(db, saveExternalFood(db, nutella))!;
    logFood(db, { food: nut, qty: 30, unit: 'g', meal: 'snack', localDate: D });
    expect(foodLogsForDateQuery(db, D).all()[0]!.kcal).toBeCloseTo(161.7);
    expect(defaultServing(getFood(db, nut.id)!)).toEqual({ qty: 30, unit: 'g' });

    const soup = getFood(db, createCustomFood(db, { name: 'Soup', servingLabel: '1 bowl', servingGrams: null, kcal: 300, proteinG: 15, carbsG: 30, fatG: 10 }))!;
    logFood(db, { food: soup, qty: 2, unit: '1 bowl', meal: 'dinner', localDate: D });
    expect(foodLogsForDateQuery(db, D).all()[1]).toMatchObject({ kcal: 600, grams: null });
    expect(() => logFood(db, { food: soup, qty: 1, unit: 'cup', meal: 'dinner', localDate: D })).toThrow(/Unknown serving/);
  });

  it('editing a logged food recalculates the snapshot', () => {
    const db = createTestDb();
    const food = getFood(db, saveExternalFood(db, yogurt!))!;
    const id = logFood(db, { food, qty: 1, unit: '1 container (150 g)', meal: 'breakfast', localDate: D });
    updateLoggedFood(db, id, { food, qty: 200, unit: 'g', meal: 'snack', localDate: D }, 999);
    expect(foodLogsForDateQuery(db, D).all()[0]).toMatchObject({ meal: 'snack', grams: 200, kcal: 106, updatedAt: 999 });
  });

  it('copy yesterday’s meal creates new entries on the target day', () => {
    const db = createTestDb();
    const food = getFood(db, saveExternalFood(db, yogurt!))!;
    logFood(db, { food, qty: 1, unit: '1 container (150 g)', meal: 'breakfast', localDate: '2026-10-12' });
    logFood(db, { food, qty: 100, unit: 'g', meal: 'breakfast', localDate: '2026-10-12' });
    logFood(db, { food, qty: 100, unit: 'g', meal: 'lunch', localDate: '2026-10-12' });
    expect(copyMeal(db, '2026-10-12', D, 'breakfast', 500)).toBe(2);
    const copied = foodLogsForDateQuery(db, D).all();
    expect(copied).toHaveLength(2);
    expect(copied.every((l) => l.meal === 'breakfast' && l.dirty)).toBe(true);
    expect(dailyTotalsQuery(db).all().find((t) => t.date === D)!.kcal).toBeCloseTo(79.5 + 53);
    expect(copyMeal(db, '2026-10-12', D, 'dinner')).toBe(0);
  });
});
