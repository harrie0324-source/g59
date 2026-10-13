import { createFoodApi, FoodApiError } from '../api';
import { offNotFound, offProduct, usdaSearch } from './fixtures';

function mockFetch(routes: Record<string, unknown | ((url: string, init?: RequestInit) => unknown)>) {
  const calls: { url: string; init?: RequestInit }[] = [];
  const fn = (async (url: string, init?: RequestInit) => {
    calls.push({ url, init });
    const key = Object.keys(routes).find((k) => url.includes(k));
    if (!key) throw new TypeError('Network request failed');
    const v = routes[key];
    const body = typeof v === 'function' ? (v as (u: string, i?: RequestInit) => unknown)(url, init) : v;
    if (body === 404) return { ok: false, status: 404, json: async () => ({}) } as Response;
    if (body === 500) return { ok: false, status: 500, json: async () => ({}) } as Response;
    return { ok: true, status: 200, json: async () => body } as Response;
  }) as typeof fetch;
  return { fn, calls };
}

describe('food API', () => {
  it('mode: proxy when Supabase is configured, direct only for dev with a key, else none', () => {
    const f = mockFetch({}).fn;
    expect(createFoodApi({ supabaseUrl: 'https://x.supabase.co', supabaseKey: 'k', allowDirect: false, fetch: f }).mode).toBe('proxy');
    expect(createFoodApi({ usdaDevKey: 'dev', allowDirect: true, fetch: f }).mode).toBe('direct');
    expect(createFoodApi({ usdaDevKey: 'dev', allowDirect: false, fetch: f }).mode).toBe('none');
  });

  it('proxy search sends the key headers and parses results', async () => {
    const m = mockFetch({ '/functions/v1/food-search?q=greek%20yogurt': usdaSearch });
    const api = createFoodApi({ supabaseUrl: 'https://x.supabase.co/', supabaseKey: 'pk', allowDirect: false, fetch: m.fn });
    const res = await api.searchFoods(' greek yogurt ');
    expect(res).toHaveLength(3);
    expect(m.calls[0]!.url).toBe('https://x.supabase.co/functions/v1/food-search?q=greek%20yogurt');
    expect((m.calls[0]!.init!.headers as Record<string, string>).apikey).toBe('pk');
  });

  it('direct (dev) search posts to USDA', async () => {
    const m = mockFetch({ 'api.nal.usda.gov': usdaSearch });
    const api = createFoodApi({ usdaDevKey: 'dev', allowDirect: true, fetch: m.fn });
    await api.searchFoods('oats');
    expect(m.calls[0]!.url).toContain('api_key=dev');
    expect(JSON.parse(m.calls[0]!.init!.body as string)).toMatchObject({ query: 'oats' });
  });

  it('short queries do nothing; not configured / offline / server errors are typed', async () => {
    const none = createFoodApi({ allowDirect: false, fetch: mockFetch({}).fn });
    expect(await none.searchFoods('a')).toEqual([]);
    await expect(none.searchFoods('apple')).rejects.toMatchObject({ kind: 'not_configured' });

    const offline = createFoodApi({ supabaseUrl: 'https://x', supabaseKey: 'k', allowDirect: false, fetch: mockFetch({}).fn });
    await expect(offline.searchFoods('apple')).rejects.toBeInstanceOf(FoodApiError);
    await expect(offline.searchFoods('apple')).rejects.toMatchObject({ kind: 'offline' });

    const broken = createFoodApi({ supabaseUrl: 'https://x', supabaseKey: 'k', allowDirect: false, fetch: mockFetch({ 'food-search': 500 }).fn });
    await expect(broken.searchFoods('apple')).rejects.toMatchObject({ kind: 'server' });
  });

  it('barcode: Open Food Facts first', async () => {
    const m = mockFetch({ 'openfoodfacts.org/api/v2/product/3017620422003.json': offProduct });
    const api = createFoodApi({ allowDirect: false, fetch: m.fn, userAgent: 'Burnrate/test' });
    expect((await api.lookupBarcode('3017620422003'))!.name).toBe('Nutella');
    expect((m.calls[0]!.init!.headers as Record<string, string>)['User-Agent']).toBe('Burnrate/test');
  });

  it('barcode: falls back to USDA branded foods matched by UPC (leading zeros ignored)', async () => {
    const m = mockFetch({ openfoodfacts: offNotFound, 'food-search?barcode=0818290014191': usdaSearch });
    const api = createFoodApi({ supabaseUrl: 'https://x', supabaseKey: 'k', allowDirect: false, fetch: m.fn });
    expect((await api.lookupBarcode('0818290014191'))!.sourceId).toBe('2346401');
  });

  it('barcode: not found anywhere → null; OFF 404 handled; offline everywhere → error', async () => {
    const api = createFoodApi({ supabaseUrl: 'https://x', supabaseKey: 'k', allowDirect: false, fetch: mockFetch({ openfoodfacts: 404, 'food-search': { foods: [] } }).fn });
    expect(await api.lookupBarcode('1111111111111')).toBeNull();
    const offline = createFoodApi({ allowDirect: false, fetch: mockFetch({}).fn });
    await expect(offline.lookupBarcode('1111111111111')).rejects.toMatchObject({ kind: 'offline' });
  });

  it('times out slow requests', async () => {
    const slow = ((_: string, init?: RequestInit) =>
      new Promise((_r, reject) => init!.signal!.addEventListener('abort', () => reject(new Error('aborted'))))) as typeof fetch;
    const api = createFoodApi({ supabaseUrl: 'https://x', supabaseKey: 'k', allowDirect: false, fetch: slow, timeoutMs: 20 });
    await expect(api.searchFoods('apple')).rejects.toMatchObject({ kind: 'offline' });
  });
});
