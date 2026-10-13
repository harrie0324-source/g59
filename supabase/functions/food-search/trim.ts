// Pure helpers for the food-search Edge Function (no Deno or Node APIs), unit-tested from Jest.

/** USDA nutrient ids the app uses: energy (3 variants), protein, fat, carbs, fiber. */
export const NUTRIENT_IDS = new Set([1008, 2047, 2048, 1003, 1004, 1005, 1079]);

// deno-lint-ignore no-explicit-any
type Json = any;

/** Keep only the fields the app parses, so responses stay small on mobile data. */
export function trimUsdaResponse(json: Json): { foods: Json[] } {
  const foods: Json[] = Array.isArray(json?.foods) ? json.foods : [];
  return {
    foods: foods.map((f) => ({
      fdcId: f.fdcId,
      description: f.description,
      dataType: f.dataType,
      brandOwner: f.brandOwner,
      brandName: f.brandName,
      gtinUpc: f.gtinUpc,
      servingSize: f.servingSize,
      servingSizeUnit: f.servingSizeUnit,
      householdServingFullText: f.householdServingFullText,
      foodNutrients: (f.foodNutrients ?? [])
        .filter((n: Json) => NUTRIENT_IDS.has(n.nutrientId))
        .map((n: Json) => ({ nutrientId: n.nutrientId, nutrientNumber: n.nutrientNumber, unitName: n.unitName, value: n.value })),
      foodMeasures: (f.foodMeasures ?? [])
        .slice(0, 5)
        .map((m: Json) => ({ disseminationText: m.disseminationText, gramWeight: m.gramWeight })),
    })),
  };
}

export type Validated = { kind: 'query'; query: string } | { kind: 'barcode'; barcode: string } | { kind: 'error'; message: string };

export function validateParams(params: URLSearchParams): Validated {
  const barcode = params.get('barcode')?.replace(/\D/g, '');
  if (barcode) {
    return barcode.length >= 8 && barcode.length <= 14 ? { kind: 'barcode', barcode } : { kind: 'error', message: 'Invalid barcode' };
  }
  const q = params.get('q')?.trim().replace(/\s+/g, ' ') ?? '';
  if (q.length < 2 || q.length > 100) return { kind: 'error', message: 'Query must be 2–100 characters' };
  return { kind: 'query', query: q };
}

/** USDA search request body. Barcodes match branded foods by UPC. */
export function usdaRequestBody(v: Exclude<Validated, { kind: 'error' }>) {
  return v.kind === 'barcode'
    ? { query: v.barcode, dataType: ['Branded'], pageSize: 5 }
    : { query: v.query, dataType: ['Foundation', 'SR Legacy', 'Branded'], pageSize: 25 };
}

/** Fixed-window rate limiter (per isolate; a best-effort guard against quota abuse). */
export function createRateLimiter(limit: number, windowMs: number) {
  const hits = new Map<string, { count: number; reset: number }>();
  return (key: string, now: number): boolean => {
    const h = hits.get(key);
    if (!h || now >= h.reset) {
      if (hits.size > 10_000) hits.clear();
      hits.set(key, { count: 1, reset: now + windowMs });
      return true;
    }
    h.count++;
    return h.count <= limit;
  };
}

/** Small TTL cache for popular queries (per isolate). */
export function createCache<T>(max: number, ttlMs: number) {
  const store = new Map<string, { at: number; value: T }>();
  return {
    get(key: string, now: number): T | undefined {
      const e = store.get(key);
      if (!e) return undefined;
      if (now - e.at > ttlMs) {
        store.delete(key);
        return undefined;
      }
      return e.value;
    },
    set(key: string, value: T, now: number) {
      if (store.size >= max) store.delete(store.keys().next().value!);
      store.set(key, { at: now, value });
    },
  };
}
