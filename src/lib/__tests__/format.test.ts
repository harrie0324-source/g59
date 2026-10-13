import { dayLabel, dayPhrase, formatKcal, localDate, mealForTime } from '../format';

describe('format', () => {
  it('kcal with grouping', () => {
    expect(formatKcal(2340.4)).toBe('2,340');
  });
  it('day labels and phrases', () => {
    expect(dayLabel('2026-10-13', '2026-10-13')).toBe('Today');
    expect(dayLabel('2026-10-12', '2026-10-13')).toBe('Yesterday');
    expect(dayLabel('2026-10-05', '2026-10-13')).toBe('Mon, Oct 5');
    expect(dayPhrase('2026-10-13', '2026-10-13')).toBe('today');
    expect(dayPhrase('2026-10-05', '2026-10-13')).toBe('on Mon, Oct 5');
  });
  it('local date and default meal', () => {
    expect(localDate(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05');
    expect(mealForTime(new Date(2026, 0, 5, 7))).toBe('breakfast');
    expect(mealForTime(new Date(2026, 0, 5, 12))).toBe('lunch');
    expect(mealForTime(new Date(2026, 0, 5, 18))).toBe('dinner');
    expect(mealForTime(new Date(2026, 0, 5, 22))).toBe('snack');
  });
});
