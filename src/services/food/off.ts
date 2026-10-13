// Open Food Facts product lookup (API v2) → FoodDTO.
// Data is ODbL-licensed: show "Data from Open Food Facts" wherever these foods appear.
import type { FoodDTO } from './types';
import { servingLabel, tidyName } from './text';

interface OffProduct {
  code?: string;
  product_name?: string;
  product_name_en?: string;
  brands?: string;
  serving_size?: string;
  serving_quantity?: number | string;
  nutriments?: Record<string, number | string | undefined>;
}

const num = (v: unknown): number | null => {
  const n = typeof v === 'string' ? Number(v) : v;
  return typeof n === 'number' && Number.isFinite(n) ? n : null;
};

export function parseOffProduct(json: unknown, barcode: string): FoodDTO | null {
  const body = json as { status?: number; product?: OffProduct } | null;
  const p = body?.product;
  if (!p || body?.status === 0) return null;
  const nm = p.nutriments ?? {};
  const kcal = num(nm['energy-kcal_100g']) ?? (num(nm['energy_100g']) !== null ? num(nm['energy_100g'])! / 4.184 : null);
  const name = (p.product_name_en || p.product_name || '').trim();
  if (kcal === null || !name) return null;

  const servingGrams = num(p.serving_quantity);
  const servings: FoodDTO['servings'] = [];
  if (servingGrams && servingGrams > 0) {
    const text = p.serving_size?.replace(/\s*\(.*\)\s*$/, '').trim();
    servings.push({ label: servingLabel(text && !/^\d+(\.\d+)?\s*(g|ml)$/i.test(text) ? text : null, servingGrams), grams: servingGrams });
  }
  servings.push({ label: '100 g', grams: 100 });

  return {
    source: 'off',
    sourceId: p.code || barcode,
    barcode: p.code || barcode,
    name: tidyName(name),
    brand: p.brands ? tidyName(p.brands.split(',')[0]!) : null,
    kcal100g: kcal,
    protein100g: num(nm['proteins_100g']) ?? 0,
    carbs100g: num(nm['carbohydrates_100g']) ?? 0,
    fat100g: num(nm['fat_100g']) ?? 0,
    fiber100g: num(nm['fiber_100g']),
    servings,
  };
}

/** Digits of a scanned UPC/EAN code (8–14 digits), or null if it isn't one. */
export function normalizeBarcode(raw: string): string | null {
  const digits = raw.replace(/\D/g, '');
  return digits.length >= 8 && digits.length <= 14 ? digits : null;
}

/** Comparison key: UPC-A "012345678905", EAN-13 "0012345678905" and GTIN-14 all match. */
export function barcodeKey(code: string): string {
  return code.replace(/\D/g, '').replace(/^0+/, '');
}
