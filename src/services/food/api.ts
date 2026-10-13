// Remote food lookups.
// - Search: our Supabase Edge Function (USDA key stays on the server).
//   Dev builds without Supabase can call USDA directly with a personal key (never in production).
// - Barcode: Open Food Facts first (no key needed), then USDA branded foods by UPC.
import { parseOffProduct } from './off';
import type { FoodDTO } from './types';
import { parseUsdaSearch } from './usda';

export type FoodApiMode = 'proxy' | 'direct' | 'none';

export interface FoodApiConfig {
  supabaseUrl?: string;
  supabaseKey?: string;
  /** USDA key for development only. */
  usdaDevKey?: string;
  allowDirect: boolean;
  fetch: typeof fetch;
  timeoutMs?: number;
  userAgent?: string;
}

export class FoodApiError extends Error {
  constructor(
    message: string,
    readonly kind: 'offline' | 'server' | 'not_configured',
  ) {
    super(message);
  }
}

const USDA_URL = 'https://api.nal.usda.gov/fdc/v1/foods/search';
const OFF_FIELDS = 'code,product_name,product_name_en,brands,serving_size,serving_quantity,nutriments';

export function createFoodApi(cfg: FoodApiConfig) {
  const mode: FoodApiMode =
    cfg.supabaseUrl && cfg.supabaseKey ? 'proxy' : cfg.allowDirect && cfg.usdaDevKey ? 'direct' : 'none';

  async function getJson(url: string, init: RequestInit = {}, signal?: AbortSignal): Promise<unknown> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), cfg.timeoutMs ?? 8000);
    const onAbort = () => controller.abort();
    signal?.addEventListener('abort', onAbort);
    try {
      const res = await cfg.fetch(url, { ...init, signal: controller.signal });
      if (res.status === 404) return null;
      if (!res.ok) throw new FoodApiError(`Food service error (${res.status})`, 'server');
      return await res.json();
    } catch (e) {
      if (e instanceof FoodApiError) throw e;
      if (signal?.aborted) throw e;
      throw new FoodApiError("Couldn't reach the food database", 'offline');
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener('abort', onAbort);
    }
  }

  async function usda(params: { q?: string; barcode?: string }, signal?: AbortSignal): Promise<FoodDTO[]> {
    if (mode === 'proxy') {
      const qs = params.barcode ? `barcode=${encodeURIComponent(params.barcode)}` : `q=${encodeURIComponent(params.q!)}`;
      const json = await getJson(
        `${cfg.supabaseUrl!.replace(/\/$/, '')}/functions/v1/food-search?${qs}`,
        { headers: { apikey: cfg.supabaseKey!, Authorization: `Bearer ${cfg.supabaseKey!}` } },
        signal,
      );
      return parseUsdaSearch(json);
    }
    if (mode === 'direct') {
      const body = params.barcode
        ? { query: params.barcode, dataType: ['Branded'], pageSize: 5 }
        : { query: params.q, dataType: ['Foundation', 'SR Legacy', 'Branded'], pageSize: 25 };
      const json = await getJson(
        `${USDA_URL}?api_key=${cfg.usdaDevKey}`,
        { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) },
        signal,
      );
      return parseUsdaSearch(json);
    }
    throw new FoodApiError('Food search is not set up yet', 'not_configured');
  }

  return {
    mode,

    async searchFoods(q: string, signal?: AbortSignal): Promise<FoodDTO[]> {
      const query = q.trim();
      if (query.length < 2) return [];
      return usda({ q: query }, signal);
    },

    async lookupBarcode(barcode: string, signal?: AbortSignal): Promise<FoodDTO | null> {
      let offError: unknown = null;
      try {
        const json = await getJson(
          `https://world.openfoodfacts.org/api/v2/product/${barcode}.json?fields=${OFF_FIELDS}`,
          { headers: { 'User-Agent': cfg.userAgent ?? 'Burnrate/0.1' } },
          signal,
        );
        const found = json ? parseOffProduct(json, barcode) : null;
        if (found) return found;
      } catch (e) {
        offError = e;
      }
      if (mode !== 'none') {
        const key = barcode.replace(/^0+/, '');
        const hits = await usda({ barcode }, signal);
        const match = hits.find((f) => f.barcode?.replace(/^0+/, '') === key);
        if (match) return match;
      }
      if (offError) throw offError;
      return null;
    },
  };
}

export type FoodApi = ReturnType<typeof createFoodApi>;

/** App instance, configured from EXPO_PUBLIC_* environment variables (see .env.example). */
export const foodApi = createFoodApi({
  supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL,
  supabaseKey: process.env.EXPO_PUBLIC_SUPABASE_KEY,
  usdaDevKey: process.env.EXPO_PUBLIC_USDA_DEV_KEY,
  allowDirect: typeof __DEV__ !== 'undefined' && __DEV__,
  fetch: (...args) => fetch(...args),
  userAgent: 'Burnrate/0.1 (iOS/Android)',
});
