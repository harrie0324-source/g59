import { addDays } from '@/core';
import { makeGoal, makeProfile } from '@/core/__fixtures__/builders';
import type { CheckInRow } from '@/db/repos/checkIns';

import { buildTodayModel, checkInFor, type TodayInput } from '../today';

const TODAY = '2026-10-13';
const ci = (date: string, o: Partial<CheckInRow> = {}): CheckInRow => ({
  id: date, createdAt: 0, updatedAt: 0, deletedAt: null, serverUpdatedAt: null, dirty: true,
  date, computedAt: 0, goalId: null, status: 'learning', prevTdee: null, observedTdee: null,
  tdee: 2800, baselineTdee: 2500, confidence: 'learning', calorieTarget: 2300, proteinG: 180, fatG: 64, carbsG: 250,
  reasons: [], applied: true, seen: true, ...o,
});
const weights = [80, 80.2, 79.9, 80.1].map((kg, i) => ({
  id: `w${i}`, localDate: addDays(TODAY, i - 3), measuredAt: i, weightKg: kg, source: 'manual' as const,
}));

const input = (o: Partial<TodayInput> = {}): TodayInput => ({
  date: TODAY, today: TODAY, profile: makeProfile(), emaAlpha: 0.1, goals: [makeGoal({ startDate: addDays(TODAY, -3) })],
  weights, dayLogs: [], checkIns: [ci(addDays(TODAY, -3))],
  dayFood: [{ kcal: 500, proteinG: 30, carbsG: 50, fatG: 20 }, { kcal: 700, proteinG: 40, carbsG: 60, fatG: 25 }],
  ...o,
});

describe('buildTodayModel', () => {
  it('sums today and computes what is left', () => {
    const m = buildTodayModel(input());
    expect(m.eaten).toEqual({ kcal: 1200, proteinG: 70, carbsG: 110, fatG: 45 });
    expect(m.target).toEqual({ kcal: 2300, proteinG: 180, carbsG: 250, fatG: 64 });
    expect(m.remainingKcal).toBe(1100);
    expect(m.latestWeight).toEqual({ kg: 80.1, date: TODAY });
    expect(m.trendKg).toBeCloseTo(80, 0);
    expect(m.estimate).toMatchObject({ tdee: 2800, status: 'learning' });
    expect(m.estimate!.needed.weighIns).toBe(7); // all within the 7-day settling period
    expect(m.estimate!.learningStarts).toBe(addDays(TODAY, 4)); // goal started 3 days ago
    expect(m.unseenCheckIn).toBeNull();
  });

  it('no settling note once the first week has passed', () => {
    expect(buildTodayModel(input({ goals: [makeGoal({ startDate: addDays(TODAY, -10) })] })).estimate!.learningStarts).toBeNull();
  });

  it('above target is a negative number, not an error state', () => {
    expect(buildTodayModel(input({ dayFood: [{ kcal: 2500, proteinG: 0, carbsG: 0, fatG: 0 }] })).remainingKcal).toBe(-200);
  });

  it('no target for under-18s', () => {
    const m = buildTodayModel(input({ checkIns: [ci(TODAY, { calorieTarget: null })] }));
    expect(m.target).toBeNull();
    expect(m.remainingKcal).toBeNull();
  });

  it('surfaces a recent unusual weigh-in', () => {
    const m = buildTodayModel(input({ weights: [...weights, { ...weights[0]!, id: 'odd', localDate: addDays(TODAY, 1), measuredAt: 9, weightKg: 90 }], today: addDays(TODAY, 1) }));
    expect(m.outlier).toEqual({ entryId: 'odd', weightKg: 90, date: addDays(TODAY, 1) });
  });

  it('uses the check-in in effect for the viewed date, and flags unseen ones', () => {
    const list = [ci('2026-10-05', { calorieTarget: 2400 }), ci('2026-10-12', { calorieTarget: 2250, seen: false })];
    expect(checkInFor(list, '2026-10-01')!.calorieTarget).toBe(2400);
    expect(checkInFor(list, '2026-10-11')!.calorieTarget).toBe(2400);
    expect(checkInFor(list, '2026-10-13')!.calorieTarget).toBe(2250);
    expect(checkInFor([], TODAY)).toBeUndefined();
    expect(buildTodayModel(input({ checkIns: list })).unseenCheckIn).toBe('2026-10-12');
  });

  it('no check-ins and no weights → empty but safe', () => {
    const m = buildTodayModel(input({ checkIns: [], weights: [], dayFood: [] }));
    expect(m).toMatchObject({ target: null, remainingKcal: null, trendKg: null, latestWeight: null, outlier: null, estimate: null });
  });
});
