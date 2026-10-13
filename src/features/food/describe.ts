import { nutrientsFor, gramsFor } from '@/services/food/nutrition';
import type { FoodDTO } from '@/services/food/types';

import type { FoodRow } from '@/db/repos/foods';
import { defaultServing } from '@/db/repos/foodLogs';

/** "1 container (150 g)" / "1.5 × 1 bar" / "30 g" for a food's default serving. */
export function servingText(qty: number, unit: string): string {
  if (unit === 'g') return `${qty} g`;
  return qty === 1 ? unit : `${qty} × ${unit}`;
}

/** Default serving and its calories, for list rows. */
export function rowInfo(food: Pick<FoodRow, 'servings' | 'gramsKnown' | 'lastQty' | 'lastServingLabel' | 'kcal100g' | 'protein100g' | 'carbs100g' | 'fat100g'>) {
  const s = defaultServing(food);
  const grams = gramsFor(food.servings, s.unit, s.qty) ?? 100;
  return { serving: servingText(s.qty, s.unit), kcal: nutrientsFor(food, grams).kcal };
}

export function dtoRowInfo(dto: FoodDTO) {
  const s = dto.servings[0] ?? { label: '100 g', grams: 100 };
  return { serving: s.label, kcal: nutrientsFor(dto, s.grams).kcal };
}
