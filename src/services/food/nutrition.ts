import type { ServingOption } from '@/db/schema';

export interface Per100 {
  kcal100g: number;
  protein100g: number;
  carbs100g: number;
  fat100g: number;
}

export interface Nutrients {
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
}

export const GRAM_UNIT = 'g';

/** Grams for a quantity of a serving ("g" means the quantity is grams). Null if unknown. */
export function gramsFor(servings: ServingOption[], unit: string, qty: number): number | null {
  if (!(qty > 0)) return null;
  if (unit === GRAM_UNIT) return qty;
  const s = servings.find((x) => x.label === unit);
  return s ? s.grams * qty : null;
}

export function nutrientsFor(food: Per100, grams: number): Nutrients {
  const f = grams / 100;
  return {
    kcal: food.kcal100g * f,
    proteinG: food.protein100g * f,
    carbsG: food.carbs100g * f,
    fatG: food.fat100g * f,
  };
}

/** Per-serving numbers (from a label) → per-100 g, for custom foods. */
export function per100FromServing(n: Nutrients, servingGrams: number): Per100 {
  const f = 100 / servingGrams;
  return { kcal100g: n.kcal * f, protein100g: n.proteinG * f, carbs100g: n.carbsG * f, fat100g: n.fatG * f };
}
