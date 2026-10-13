import { barcodeKey, normalizeBarcode, parseOffProduct } from '../off';
import { GRAM_UNIT, gramsFor, nutrientsFor, per100FromServing } from '../nutrition';
import { servingLabel, tidyName } from '../text';
import { parseUsdaSearch } from '../usda';
import { offNotFound, offProduct, usdaSearch } from './fixtures';

describe('USDA parser', () => {
  const foods = parseUsdaSearch(usdaSearch);

  it('skips foods without energy', () => {
    expect(foods.map((f) => f.sourceId)).toEqual(['2346401', '171304', '2000']);
  });

  it('branded: per-100 g nutrients, household serving, tidy names', () => {
    expect(foods[0]).toEqual({
      source: 'usda',
      sourceId: '2346401',
      barcode: '818290014191',
      name: 'Greek Nonfat Yogurt, Plain',
      brand: 'Chobani',
      kcal100g: 53,
      protein100g: 10,
      carbs100g: 4,
      fat100g: 0,
      fiber100g: null,
      servings: [{ label: '1 container (150 g)', grams: 150 }],
    });
  });

  it('SR Legacy: kcal preferred over kJ, food measures become servings', () => {
    expect(foods[1]!.kcal100g).toBe(59);
    expect(foods[1]!.name).toBe('Yogurt, Greek, plain, nonfat');
    expect(foods[1]!.servings).toEqual([
      { label: '1 container (6 oz) (170 g)', grams: 170 },
      { label: '1 cup (245 g)', grams: 245 },
    ]);
  });

  it('Foundation: Atwater energy and fiber; falls back to a 100 g serving', () => {
    expect(foods[2]).toMatchObject({ kcal100g: 379, fiber100g: 10.1, servings: [{ label: '100 g', grams: 100 }] });
  });

  it('kJ only → converted to kcal', () => {
    const [f] = parseUsdaSearch({ foods: [{ fdcId: 1, description: 'x', foodNutrients: [{ nutrientId: 1008, unitName: 'kJ', value: 418.4 }] }] });
    expect(f!.kcal100g).toBeCloseTo(100);
  });

  it('garbage in → empty list', () => {
    expect(parseUsdaSearch(null)).toEqual([]);
    expect(parseUsdaSearch({ foods: 'nope' })).toEqual([]);
  });
});

describe('Open Food Facts parser', () => {
  it('parses a product with a serving', () => {
    expect(parseOffProduct(offProduct, '3017620422003')).toEqual({
      source: 'off',
      sourceId: '3017620422003',
      barcode: '3017620422003',
      name: 'Nutella',
      brand: 'Ferrero',
      kcal100g: 539,
      protein100g: 6.3,
      carbs100g: 57.5,
      fat100g: 30.9,
      fiber100g: 0,
      servings: [
        { label: '15 g', grams: 15 },
        { label: '100 g', grams: 100 },
      ],
    });
  });

  it('falls back to kJ, string numbers and a household serving text', () => {
    const p = parseOffProduct(
      { status: 1, product: { product_name: 'Bar', serving_size: '1 bar (45 g)', serving_quantity: '45', nutriments: { energy_100g: '1673.6', proteins_100g: '20' } } },
      '123456789012',
    )!;
    expect(p.kcal100g).toBeCloseTo(400);
    expect(p.protein100g).toBe(20);
    expect(p.servings[0]).toEqual({ label: '1 bar (45 g)', grams: 45 });
    expect(p.sourceId).toBe('123456789012');
  });

  it('not found or unusable → null', () => {
    expect(parseOffProduct(offNotFound, '0')).toBeNull();
    expect(parseOffProduct({ status: 1, product: { product_name: 'No energy', nutriments: {} } }, '1')).toBeNull();
    expect(parseOffProduct(null, '1')).toBeNull();
  });

  it('barcode helpers', () => {
    expect(normalizeBarcode(' 0 12345 67890 5 ')).toBe('012345678905');
    expect(normalizeBarcode('1234')).toBeNull();
    expect(barcodeKey('0012345678905')).toBe(barcodeKey('012345678905'));
  });
});

describe('nutrition math', () => {
  const food = { kcal100g: 200, protein100g: 10, carbs100g: 20, fat100g: 5 };
  const servings = [{ label: '1 bar (45 g)', grams: 45 }];
  it('grams for servings and for "g"', () => {
    expect(gramsFor(servings, '1 bar (45 g)', 2)).toBe(90);
    expect(gramsFor(servings, GRAM_UNIT, 30)).toBe(30);
    expect(gramsFor(servings, 'cup', 1)).toBeNull();
    expect(gramsFor(servings, GRAM_UNIT, 0)).toBeNull();
  });
  it('nutrients scale with grams', () => {
    expect(nutrientsFor(food, 50)).toEqual({ kcal: 100, proteinG: 5, carbsG: 10, fatG: 2.5 });
  });
  it('per-serving label numbers → per 100 g', () => {
    expect(per100FromServing({ kcal: 90, proteinG: 9, carbsG: 4.5, fatG: 1.8 }, 45)).toEqual({ kcal100g: 200, protein100g: 20, carbs100g: 10, fat100g: 4 });
  });
  it('text helpers', () => {
    expect(tidyName('PEANUT BUTTER WITH HONEY')).toBe('Peanut Butter with Honey');
    expect(tidyName('  McDonald’s  fries ')).toBe('McDonald’s fries');
    expect(servingLabel('100 g', 100)).toBe('100 g');
    expect(servingLabel(null, 33.333)).toBe('33.3 g');
  });
});
