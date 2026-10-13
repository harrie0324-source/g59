// USDA FoodData Central search results → FoodDTO.
// Shape per the FDC API v1 docs (SearchResultFood). The proxy (supabase/functions/food-search)
// forwards this shape trimmed, and dev mode calls the API directly, so both use this parser.
import type { FoodDTO } from './types';
import { servingLabel, tidyName } from './text';

export interface UsdaNutrient {
  nutrientId?: number;
  nutrientNumber?: string;
  unitName?: string;
  value?: number;
}

export interface UsdaFood {
  fdcId: number;
  description: string;
  dataType?: string;
  brandOwner?: string;
  brandName?: string;
  gtinUpc?: string;
  servingSize?: number;
  servingSizeUnit?: string;
  householdServingFullText?: string;
  foodNutrients?: UsdaNutrient[];
  foodMeasures?: { disseminationText?: string; gramWeight?: number }[];
}

/** Nutrient ids (and legacy numbers). Energy has several variants; kcal ones are preferred. */
export const USDA_NUTRIENTS = {
  energy: { ids: [1008, 2047, 2048], numbers: ['208', '957', '958'] },
  protein: { ids: [1003], numbers: ['203'] },
  fat: { ids: [1004], numbers: ['204'] },
  carbs: { ids: [1005], numbers: ['205'] },
  fiber: { ids: [1079], numbers: ['291'] },
} as const;

export const USDA_NUTRIENT_IDS: number[] = Object.values(USDA_NUTRIENTS).flatMap((n) => [...n.ids]);

function pick(nutrients: UsdaNutrient[], key: keyof typeof USDA_NUTRIENTS): number | null {
  const spec = USDA_NUTRIENTS[key];
  const matches = nutrients.filter(
    (n) =>
      typeof n.value === 'number' &&
      Number.isFinite(n.value) &&
      ((n.nutrientId !== undefined && (spec.ids as readonly number[]).includes(n.nutrientId)) ||
        (n.nutrientNumber !== undefined && (spec.numbers as readonly string[]).includes(n.nutrientNumber))),
  );
  if (key === 'energy') {
    const kcal = matches.find((n) => n.unitName?.toUpperCase() === 'KCAL');
    if (kcal) return kcal.value!;
    const kj = matches.find((n) => n.unitName?.toUpperCase() === 'KJ');
    return kj ? kj.value! / 4.184 : null;
  }
  return matches[0]?.value ?? null;
}

export function parseUsdaFood(f: UsdaFood): FoodDTO | null {
  const n = f.foodNutrients ?? [];
  const kcal = pick(n, 'energy');
  if (kcal === null || !f.description) return null;

  const servings: FoodDTO['servings'] = [];
  const unit = f.servingSizeUnit?.toLowerCase();
  if (f.servingSize && f.servingSize > 0 && (unit === 'g' || unit === 'grm' || unit === 'ml' || unit === 'mlt')) {
    servings.push({ label: servingLabel(f.householdServingFullText, f.servingSize), grams: f.servingSize });
  }
  for (const m of f.foodMeasures ?? []) {
    if (m.gramWeight && m.gramWeight > 0 && m.disseminationText && servings.length < 4) {
      servings.push({ label: servingLabel(m.disseminationText, m.gramWeight), grams: m.gramWeight });
    }
  }
  if (servings.length === 0) servings.push({ label: '100 g', grams: 100 });

  const brand = f.brandName || f.brandOwner;
  return {
    source: 'usda',
    sourceId: String(f.fdcId),
    barcode: f.gtinUpc?.replace(/\D/g, '') || null,
    name: tidyName(f.description),
    brand: brand ? tidyName(brand) : null,
    kcal100g: kcal,
    protein100g: pick(n, 'protein') ?? 0,
    carbs100g: pick(n, 'carbs') ?? 0,
    fat100g: pick(n, 'fat') ?? 0,
    fiber100g: pick(n, 'fiber'),
    servings,
  };
}

export function parseUsdaSearch(json: unknown): FoodDTO[] {
  const foods = (json as { foods?: UsdaFood[] } | null)?.foods;
  if (!Array.isArray(foods)) return [];
  return foods.map(parseUsdaFood).filter((f): f is FoodDTO => f !== null);
}
