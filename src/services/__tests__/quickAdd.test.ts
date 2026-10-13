import { parseQuickAdd, toForm } from '../quickAdd';

const f = (kcal: string, proteinG = '', carbsG = '', fatG = '') => ({ kcal, proteinG, carbsG, fatG });

describe('parseQuickAdd', () => {
  it('calories only', () => {
    expect(parseQuickAdd(f('450'))).toEqual({ ok: true, kcal: 450, proteinG: 0, carbsG: 0, fatG: 0 });
  });
  it('calories from macros when calories are blank', () => {
    expect(parseQuickAdd(f('', '30', '40', '10'))).toEqual({ ok: true, kcal: 370, proteinG: 30, carbsG: 40, fatG: 10 });
  });
  it('typed calories win over macros', () => {
    expect(parseQuickAdd(f('400', '30', '40', '10'))).toMatchObject({ kcal: 400 });
  });
  it('rejects empty, zero, non-numeric and silly values', () => {
    expect(parseQuickAdd(f(''))).toEqual({ ok: false, error: 'Enter calories or macros.' });
    expect(parseQuickAdd(f('0'))).toMatchObject({ ok: false });
    expect(parseQuickAdd(f('abc'))).toMatchObject({ ok: false });
    expect(parseQuickAdd(f('20000'))).toMatchObject({ ok: false });
    expect(parseQuickAdd(f('300', 'x'))).toMatchObject({ ok: false, error: 'Check the macro amounts.' });
  });
  it('round-trips through the edit form', () => {
    expect(toForm({ kcal: 450.4, proteinG: 30, carbsG: 0, fatG: 12.25 })).toEqual({ kcal: '450', proteinG: '30', carbsG: '', fatG: '12.3' });
  });
});
