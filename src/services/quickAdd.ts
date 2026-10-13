import { parseNumber } from './onboarding';

export interface QuickAddForm {
  kcal: string;
  proteinG: string;
  carbsG: string;
  fatG: string;
}

export type QuickAddParse =
  | { ok: true; kcal: number; proteinG: number; carbsG: number; fatG: number }
  | { ok: false; error: string };

const optional = (s: string) => (s.trim() === '' ? 0 : parseNumber(s));

/**
 * Calories are required, unless macros are given: then calories = 4·protein + 4·carbs + 9·fat.
 */
export function parseQuickAdd(f: QuickAddForm): QuickAddParse {
  const proteinG = optional(f.proteinG);
  const carbsG = optional(f.carbsG);
  const fatG = optional(f.fatG);
  if ([proteinG, carbsG, fatG].some((n) => Number.isNaN(n) || n > 1000)) return { ok: false, error: 'Check the macro amounts.' };
  const fromMacros = 4 * proteinG + 4 * carbsG + 9 * fatG;
  const kcal = f.kcal.trim() === '' ? fromMacros : parseNumber(f.kcal);
  if (Number.isNaN(kcal) || kcal > 10_000) return { ok: false, error: 'Enter calories as a number.' };
  if (kcal <= 0) return { ok: false, error: 'Enter calories or macros.' };
  return { ok: true, kcal: Math.round(kcal), proteinG, carbsG, fatG };
}

export function toForm(v: { kcal: number; proteinG: number; carbsG: number; fatG: number }): QuickAddForm {
  const s = (n: number) => (n ? String(Math.round(n * 10) / 10) : '');
  return { kcal: String(Math.round(v.kcal)), proteinG: s(v.proteinG), carbsG: s(v.carbsG), fatG: s(v.fatG) };
}
