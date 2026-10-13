import type { ServingOption } from '@/db/schema';

/** A food from any source, normalized. Nutrients are per 100 g (or 100 ml, treated as grams). */
export interface FoodDTO {
  source: 'usda' | 'off' | 'custom';
  sourceId: string | null;
  barcode: string | null;
  name: string;
  brand: string | null;
  kcal100g: number;
  protein100g: number;
  carbs100g: number;
  fat100g: number;
  fiber100g: number | null;
  /** Household servings, most useful first. "g" is always offered separately when grams are known. */
  servings: ServingOption[];
}
