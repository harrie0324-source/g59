import { DEFAULT_PROTEIN_G_PER_KG, lbToKg } from '@/core';
import { createTestDb } from '@/db/__tests__/testDb';
import { latestCheckIn } from '@/db/repos/checkIns';
import { goalsQuery } from '@/db/repos/goals';
import { getProfile } from '@/db/repos/profile';
import { weightsQuery } from '@/db/repos/weights';

import {
  buildPlan,
  completeOnboarding,
  defaultRate,
  emptyDraft,
  parseAbout,
  parseNumber,
  planSummary,
  rateOptions,
  type OnboardingDraft,
} from '../onboarding';

const TODAY = '2026-10-13';
const draft = (o: Partial<OnboardingDraft> = {}): OnboardingDraft => ({
  ...emptyDraft,
  disclaimerAccepted: true,
  units: 'us',
  formulaSex: 'male',
  dobMonth: '3',
  dobDay: '1',
  dobYear: '1996',
  heightFt: '5',
  heightIn: '11',
  weight: '187',
  activityLevel: 'moderate',
  goalType: 'lose',
  rateKgPerWeek: lbToKg(1),
  ...o,
});

describe('parseAbout', () => {
  it('parses US units into kg/cm', () => {
    const r = parseAbout(draft(), TODAY);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.birthDate).toBe('1996-03-01');
    expect(r.age).toBe(30);
    expect(r.heightCm).toBeCloseTo(180.34, 2);
    expect(r.weightKg).toBeCloseTo(84.82, 2);
  });

  it('parses metric and comma decimals', () => {
    const r = parseAbout(draft({ units: 'metric', heightCm: '172', weight: '68,5' }), TODAY);
    expect(r).toMatchObject({ ok: true, heightCm: 172, weightKg: 68.5 });
    expect(parseNumber('1e3')).toBeNaN();
    expect(parseNumber('')).toBeNaN();
  });

  it('reports every invalid field', () => {
    const r = parseAbout(draft({ formulaSex: null, dobMonth: '13', heightFt: '9', weight: 'abc' }), TODAY);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(Object.keys(r.errors).sort()).toEqual(['dob', 'formulaSex', 'height', 'weight']);
  });

  it('rejects impossible dates, future dates and under-13s', () => {
    const err = (o: Partial<OnboardingDraft>) => {
      const r = parseAbout(draft(o), TODAY);
      return r.ok ? null : r.errors.dob;
    };
    expect(err({ dobMonth: '2', dobDay: '30' })).toMatch(/valid/);
    expect(err({ dobYear: '2027' })).toMatch(/valid/);
    expect(err({ dobYear: '2015' })).toMatch(/13 and older/);
    expect(err({ dobYear: '2010' })).toBeNull(); // 16: allowed, logging only
  });
});

describe('rate options', () => {
  it('never offers paces beyond the safe limits', () => {
    // 60 kg: max loss 0.6 kg/wk (≈1.3 lb), max gain 0.3 kg/wk (≈0.66 lb)
    expect(rateOptions('lose', 60, 'us').map((o) => o.label)).toEqual(['0.5 lb/week', '1.0 lb/week']);
    expect(rateOptions('gain', 60, 'us').map((o) => o.label)).toEqual(['0.3 lb/week', '0.5 lb/week']);
    expect(rateOptions('lose', 60, 'metric').map((o) => o.kgPerWeek)).toEqual([0.25, 0.5]);
    expect(rateOptions('maintain', 60, 'us')).toEqual([]);
  });
  it('very light users still get one option: the limit itself', () => {
    const opts = rateOptions('gain', 15, 'metric'); // below the app's 30 kg minimum; guards the fallback
    expect(opts).toHaveLength(1);
    expect(opts[0]!.kgPerWeek).toBeCloseTo(0.075);
  });
  it('defaults to the second option (1 lb / 0.5 kg) when allowed', () => {
    expect(defaultRate('lose', 85, 'us')).toBeCloseTo(lbToKg(1));
    expect(defaultRate('lose', 85, 'metric')).toBe(0.5);
    expect(defaultRate('maintain', 85, 'us')).toBeNull();
  });
});

describe('buildPlan + planSummary', () => {
  it('formula estimate, 1 g/lb protein and a one-sentence summary', () => {
    const plan = buildPlan(draft(), TODAY)!;
    expect(plan.profile.proteinGPerKg).toBe(DEFAULT_PROTEIN_G_PER_KG);
    expect(plan.preview.status).toBe('learning');
    expect(plan.preview.tdee).toBeGreaterThan(2700);
    expect(plan.preview.targets!.calories).toBe(Math.round((plan.preview.tdee! - 500) / 10) * 10);
    expect(plan.preview.targets!.proteinG).toBe(187);
    const s = planSummary(plan, 'us');
    expect(s.sentence).toMatch(/^You likely burn ~2,\d{2}0 kcal a day, so about 2,\d{3} kcal a day should move you toward losing ~1.0 lb a week/);
    expect(s.notes).toEqual([]);
  });

  it('incomplete draft → null', () => {
    expect(buildPlan(draft({ activityLevel: null }), TODAY)).toBeNull();
  });

  it('under 18: no target, explained', () => {
    const plan = buildPlan(draft({ dobYear: '2010' }), TODAY)!;
    expect(plan.preview.targets).toBeNull();
    expect(planSummary(plan, 'us').sentence).toMatch(/Calorie targets are for adults/);
  });

  it('pregnancy turns a loss goal into maintenance and adds a doctor note', () => {
    const plan = buildPlan(draft({ formulaSex: 'female', pregnancyStatus: 'pregnant' }), TODAY)!;
    expect(plan.goal.type).toBe('maintain');
    expect(plan.preview.targets!.goalType).toBe('maintain');
    expect(planSummary(plan, 'us').sentence).toMatch(/keep your weight steady/);
  });

  it('calorie floor is applied and noted', () => {
    const plan = buildPlan(
      draft({ formulaSex: 'female', dobYear: '1950', heightFt: '4', heightIn: '11', weight: '100', activityLevel: 'sedentary', rateKgPerWeek: lbToKg(1) }),
      TODAY,
    )!;
    expect(plan.preview.targets!.calories).toBe(1200);
    expect(planSummary(plan, 'us').notes.join(' ')).toMatch(/lowest we support/);
  });
});

describe('completeOnboarding', () => {
  it('writes profile, goal, starting weight and first check-in together', () => {
    const db = createTestDb();
    const plan = buildPlan(draft(), TODAY)!;
    completeOnboarding(db, plan, TODAY, 1234);
    expect(getProfile(db)).toMatchObject({ formulaSex: 'male', weightUnit: 'lb', heightUnit: 'ftin' });
    expect(goalsQuery(db).all()).toHaveLength(1);
    expect(weightsQuery(db).all()[0]).toMatchObject({ localDate: TODAY, source: 'manual' });
    expect(latestCheckIn(db)).toMatchObject({ date: TODAY, status: 'learning', seen: true, calorieTarget: plan.preview.targets!.calories });
  });

  it('rolls back everything if any write fails', () => {
    const db = createTestDb();
    const plan = buildPlan(draft(), TODAY)!;
    completeOnboarding(db, plan, TODAY);
    expect(() => completeOnboarding(db, plan, TODAY)).toThrow(); // profile already exists
    expect(goalsQuery(db).all()).toHaveLength(1);
    expect(weightsQuery(db).all()).toHaveLength(1);
  });
});
