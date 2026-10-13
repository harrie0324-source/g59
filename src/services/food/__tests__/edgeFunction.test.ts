import {
  createCache,
  createRateLimiter,
  NUTRIENT_IDS,
  trimUsdaResponse,
  usdaRequestBody,
  validateParams,
} from '../../../../supabase/functions/food-search/trim';
import { USDA_NUTRIENT_IDS, parseUsdaSearch } from '../usda';
import { usdaSearch } from './fixtures';

describe('food-search Edge Function helpers', () => {
  it('keeps exactly the nutrients the app parses', () => {
    expect([...NUTRIENT_IDS].sort()).toEqual([...USDA_NUTRIENT_IDS].sort());
  });

  it('trimmed responses parse identically', () => {
    const trimmed = trimUsdaResponse(usdaSearch);
    expect(parseUsdaSearch(trimmed)).toEqual(parseUsdaSearch(usdaSearch));
    expect(JSON.stringify(trimmed)).not.toContain('Sodium');
    expect(trimUsdaResponse(null)).toEqual({ foods: [] });
  });

  it('validates params', () => {
    expect(validateParams(new URLSearchParams('q=  greek   yogurt '))).toEqual({ kind: 'query', query: 'greek yogurt' });
    expect(validateParams(new URLSearchParams('q=a')).kind).toBe('error');
    expect(validateParams(new URLSearchParams(`q=${'x'.repeat(101)}`)).kind).toBe('error');
    expect(validateParams(new URLSearchParams('barcode=0-12345-67890-5'))).toEqual({ kind: 'barcode', barcode: '012345678905' });
    expect(validateParams(new URLSearchParams('barcode=123')).kind).toBe('error');
  });

  it('builds USDA request bodies', () => {
    expect(usdaRequestBody({ kind: 'barcode', barcode: '123' })).toEqual({ query: '123', dataType: ['Branded'], pageSize: 5 });
    expect(usdaRequestBody({ kind: 'query', query: 'oats' }).pageSize).toBe(25);
  });

  it('rate limits per key within a window', () => {
    const allow = createRateLimiter(2, 1000);
    expect([allow('a', 0), allow('a', 1), allow('a', 2), allow('b', 2), allow('a', 1001)]).toEqual([true, true, false, true, true]);
  });

  it('caches with TTL and a size cap', () => {
    const c = createCache<string>(2, 100);
    c.set('a', '1', 0);
    c.set('b', '2', 0);
    c.set('c', '3', 0); // evicts 'a'
    expect([c.get('a', 1), c.get('b', 1), c.get('c', 1)]).toEqual([undefined, '2', '3']);
    expect(c.get('b', 200)).toBeUndefined();
  });
});
