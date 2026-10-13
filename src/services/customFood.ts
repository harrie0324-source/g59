import type { CustomFoodInput } from '@/db/repos/foods';

import { parseNumber } from './onboarding';

export interface CustomFoodForm {
  name: string;
  brand: string;
  servingLabel: string;
  servingGrams: string;
  kcal: string;
  proteinG: string;
  carbsG: string;
  fatG: string;
}

export const emptyCustomFood: CustomFoodForm = { name: '', brand: '', servingLabel: '1 serving', servingGrams: '', kcal: '', proteinG: '', carbsG: '', fatG: '' };

export function parseCustomFood(f: CustomFoodForm, barcode?: string | null): { ok: true; value: CustomFoodInput } | { ok: false; errors: Partial<Record<keyof CustomFoodForm, string>> } {
  const errors: Partial<Record<keyof CustomFoodForm, string>> = {};
  const opt = (s: string) => (s.trim() === '' ? 0 : parseNumber(s));
  if (!f.name.trim()) errors.name = 'Give it a name.';
  const grams = f.servingGrams.trim() === '' ? null : parseNumber(f.servingGrams);
  if (grams !== null && !(grams > 0 && grams <= 5000)) errors.servingGrams = 'Enter the serving weight in grams, or leave it blank.';
  const kcal = parseNumber(f.kcal);
  if (!(kcal >= 0 && kcal <= 5000)) errors.kcal = 'Enter calories per serving.';
  const [p, c, fat] = [opt(f.proteinG), opt(f.carbsG), opt(f.fatG)];
  if ([p, c, fat].some((x) => Number.isNaN(x) || x > 1000)) errors.proteinG = 'Check the macro amounts.';
  if (Object.keys(errors).length) return { ok: false, errors };
  return {
    ok: true,
    value: {
      name: f.name,
      brand: f.brand || null,
      barcode: barcode ?? null,
      servingLabel: f.servingLabel,
      servingGrams: grams,
      kcal,
      proteinG: p,
      carbsG: c,
      fatG: fat,
    },
  };
}
