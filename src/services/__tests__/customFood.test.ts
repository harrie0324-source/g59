import { emptyCustomFood, parseCustomFood } from '../customFood';

describe('parseCustomFood', () => {
  it('parses a label (per serving)', () => {
    const r = parseCustomFood({ ...emptyCustomFood, name: 'Bar', servingLabel: '1 bar', servingGrams: '45', kcal: '200', proteinG: '20' }, '0123456789012');
    expect(r).toEqual({ ok: true, value: { name: 'Bar', brand: null, barcode: '0123456789012', servingLabel: '1 bar', servingGrams: 45, kcal: 200, proteinG: 20, carbsG: 0, fatG: 0 } });
  });
  it('serving weight is optional', () => {
    const r = parseCustomFood({ ...emptyCustomFood, name: 'Soup', kcal: '300' });
    expect(r.ok && r.value.servingGrams).toBeNull();
  });
  it('reports problems', () => {
    const r = parseCustomFood({ ...emptyCustomFood, servingGrams: '0', kcal: 'x', fatG: 'lots' });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(Object.keys(r.errors).sort()).toEqual(['kcal', 'name', 'proteinG', 'servingGrams']);
  });
});
