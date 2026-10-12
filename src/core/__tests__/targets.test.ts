import { computeMacros, computeTargets, dailyEnergyDelta, withExerciseCredit } from '../targets';
import { makeProfile } from '../__fixtures__/builders';

const profile = makeProfile();

describe('dailyEnergyDelta', () => {
  it('kg/week × 7700 ÷ 7', () => {
    expect(dailyEnergyDelta('lose', 0.5)).toBeCloseTo(-550);
    expect(dailyEnergyDelta('gain', 0.25)).toBeCloseTo(275);
    expect(dailyEnergyDelta('maintain', 0.5)).toBe(0);
  });
});

describe('computeTargets', () => {
  it('calorie target = TDEE − rate × 7700 ÷ 7, rounded to 10', () => {
    const t = computeTargets({ tdee: 2600, goal: { type: 'lose', rateKgPerWeek: 0.5 }, weightKg: 85, profile });
    expect(t.calories).toBe(2050);
    expect(t.reasons).toEqual([]);
  });

  it('macros: protein 1.8 g/kg, fat ≥ 0.6 g/kg (or 25 % kcal), carbs = remainder', () => {
    const t = computeTargets({ tdee: 2600, goal: { type: 'maintain', rateKgPerWeek: 0 }, weightKg: 80, profile });
    expect(t.proteinG).toBe(144);
    expect(t.fatG).toBe(Math.round((0.25 * 2600) / 9));
    expect(4 * t.proteinG + 9 * t.fatG + 4 * t.carbsG).toBeCloseTo(t.calories, -1);
  });

  it('protein setting is clamped to 1.6–2.2 g/kg', () => {
    expect(computeMacros(2500, 80, 3, 0.6).proteinG).toBe(176);
    expect(computeMacros(2500, 80, 1, 0.6).proteinG).toBe(128);
  });

  it('clamps the loss rate to 1 % bodyweight/week', () => {
    const t = computeTargets({ tdee: 3000, goal: { type: 'lose', rateKgPerWeek: 1.5 }, weightKg: 80, profile });
    expect(t.rateKgPerWeek).toBeCloseTo(0.8);
    expect(t.reasons).toContain('rate_clamped');
    expect(t.calories).toBe(Math.round((3000 - 880) / 10) * 10);
  });

  it('clamps the gain rate to 0.5 % bodyweight/week', () => {
    const t = computeTargets({ tdee: 2500, goal: { type: 'gain', rateKgPerWeek: 1 }, weightKg: 70, profile });
    expect(t.rateKgPerWeek).toBeCloseTo(0.35);
    expect(t.reasons).toContain('rate_clamped');
  });

  it('never goes below 1,500 (male) / 1,200 (female) and says so', () => {
    const male = computeTargets({ tdee: 1800, goal: { type: 'lose', rateKgPerWeek: 0.7 }, weightKg: 70, profile });
    expect(male.calories).toBe(1500);
    expect(male.reasons).toContain('floor_applied');
    const female = computeTargets({
      tdee: 1500,
      goal: { type: 'lose', rateKgPerWeek: 0.5 },
      weightKg: 55,
      profile: makeProfile({ formulaSex: 'female' }),
    });
    expect(female.calories).toBe(1200);
    const avg = computeTargets({ tdee: 1500, goal: { type: 'lose', rateKgPerWeek: 0.5 }, weightKg: 55, profile: makeProfile({ formulaSex: 'average' }) });
    expect(avg.calories).toBe(1500);
  });

  it('pregnancy/breastfeeding disables the deficit', () => {
    for (const pregnancyStatus of ['pregnant', 'breastfeeding'] as const) {
      const t = computeTargets({
        tdee: 2300,
        goal: { type: 'lose', rateKgPerWeek: 0.5 },
        weightKg: 70,
        profile: makeProfile({ formulaSex: 'female', pregnancyStatus }),
      });
      expect(t.goalType).toBe('maintain');
      expect(t.calories).toBe(2300);
      expect(t.reasons).toContain('pregnancy_no_deficit');
    }
  });

  it('at very low calories, fat then protein step down and carbs never go negative', () => {
    const t = computeTargets({
      tdee: 1300,
      goal: { type: 'lose', rateKgPerWeek: 0.5 },
      weightKg: 120,
      profile: makeProfile({ formulaSex: 'female', proteinGPerKg: 2.2 }),
    });
    expect(t.calories).toBe(1200);
    expect(t.fatG).toBe(72); // 0.6 × 120
    expect(t.proteinG).toBe(192); // stepped down to 1.6 × 120
    expect(t.carbsG).toBe(0);
    expect(t.reasons).toContain('macros_reduced');
  });
});

describe('withExerciseCredit (daily-adjust mode)', () => {
  const base = computeTargets({ tdee: 2400, goal: { type: 'lose', rateKgPerWeek: 0.5 }, weightKg: 80, profile });
  it('adds 50 % of exercise burn to calories and carbs', () => {
    const t = withExerciseCredit(base, 400, 0.5);
    expect(t.calories).toBe(base.calories + 200);
    expect(t.carbsG).toBe(base.carbsG + 50);
    expect(t.proteinG).toBe(base.proteinG);
  });
  it('no exercise → unchanged; credit clamped to 0–1', () => {
    expect(withExerciseCredit(base, 0, 0.5)).toBe(base);
    expect(withExerciseCredit(base, 300, 2).calories).toBe(base.calories + 300);
    expect(withExerciseCredit(base, -100, 0.5)).toBe(base);
  });
});
