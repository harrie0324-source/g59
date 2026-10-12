import { ACTIVITY_MULTIPLIERS, baselineMultiplier, formulaTdee, mifflinStJeor } from '../bmr';
import { addDays, ageOn, dateRange, diffDays } from '../dates';
import { calorieFloor, canReceiveTargets, clampRate, isRateAllowed, maxRateKgPerWeek } from '../safety';

describe('Mifflin-St Jeor', () => {
  it('male: 10×kg + 6.25×cm − 5×age + 5', () => {
    expect(mifflinStJeor({ sex: 'male', weightKg: 80, heightCm: 180, age: 30 })).toBe(1780);
  });
  it('female: … − 161', () => {
    expect(mifflinStJeor({ sex: 'female', weightKg: 60, heightCm: 165, age: 25 })).toBeCloseTo(1345.25);
  });
  it('average is the mean of male and female', () => {
    const p = { weightKg: 70, heightCm: 172, age: 28 };
    const m = mifflinStJeor({ ...p, sex: 'male' });
    const f = mifflinStJeor({ ...p, sex: 'female' });
    expect(mifflinStJeor({ ...p, sex: 'average' })).toBeCloseTo((m + f) / 2);
  });
  it('TDEE = BMR × multiplier', () => {
    expect(Object.values(ACTIVITY_MULTIPLIERS)).toEqual([1.2, 1.375, 1.55, 1.725, 1.9]);
    expect(formulaTdee({ sex: 'male', weightKg: 80, heightCm: 180, age: 30, activityLevel: 'moderate' })).toBeCloseTo(1780 * 1.55);
  });
  it('daily-adjust baseline uses one level lower, never below sedentary', () => {
    expect(baselineMultiplier('moderate', 'daily_adjust')).toBe(1.375);
    expect(baselineMultiplier('sedentary', 'daily_adjust')).toBe(1.2);
    expect(baselineMultiplier('extra', 'adaptive')).toBe(1.9);
  });
});

describe('dates', () => {
  it('does calendar math across month, year and DST boundaries', () => {
    expect(addDays('2026-02-28', 1)).toBe('2026-03-01');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-03-08', 1)).toBe('2026-03-09'); // US DST start
    expect(diffDays('2026-01-01', '2026-01-22')).toBe(21);
    expect(dateRange('2026-01-01', '2026-01-03')).toEqual(['2026-01-01', '2026-01-02', '2026-01-03']);
    expect(dateRange('2026-01-03', '2026-01-01')).toEqual([]);
    expect(() => addDays('01/02/2026', 1)).toThrow();
  });
  it('computes age with birthdays', () => {
    expect(ageOn('2008-10-12', '2026-10-11')).toBe(17);
    expect(ageOn('2008-10-12', '2026-10-12')).toBe(18);
  });
});

describe('safety', () => {
  it('calorie floors: 1200 female, 1500 male and average', () => {
    expect(calorieFloor('female')).toBe(1200);
    expect(calorieFloor('male')).toBe(1500);
    expect(calorieFloor('average')).toBe(1500);
  });
  it('rate limits: loss ≤ 1 %/week, gain ≤ 0.5 %/week', () => {
    expect(maxRateKgPerWeek('lose', 80)).toBeCloseTo(0.8);
    expect(maxRateKgPerWeek('gain', 80)).toBeCloseTo(0.4);
    expect(maxRateKgPerWeek('maintain', 80)).toBe(0);
    expect(clampRate('lose', 1.2, 80)).toEqual({ rate: 0.8, clamped: true });
    expect(clampRate('gain', 0.25, 80)).toEqual({ rate: 0.25, clamped: false });
    expect(clampRate('lose', -1, 80)).toEqual({ rate: 0, clamped: false });
    expect(isRateAllowed('lose', 0.8, 80)).toBe(true);
    expect(isRateAllowed('lose', 0.81, 80)).toBe(false);
    expect(isRateAllowed('gain', -0.1, 80)).toBe(false);
  });
  it('targets are 18+ only', () => {
    expect(canReceiveTargets(17)).toBe(false);
    expect(canReceiveTargets(18)).toBe(true);
  });
});
