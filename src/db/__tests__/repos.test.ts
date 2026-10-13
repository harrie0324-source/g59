import { ids } from '@/lib/ids';

import { toDayLogs } from '../mappers';
import { checkInsQuery, latestCheckIn, markCheckInSeen, saveCheckIn } from '../repos/checkIns';
import { daysQuery, setDayComplete } from '../repos/days';
import { dailyTotalsQuery, deleteFoodLog, foodLogsForDateQuery, getFoodLog, quickAdd, updateQuickAdd } from '../repos/foodLogs';
import { goalsQuery, startGoal } from '../repos/goals';
import { createProfile, getProfile, updateProfile } from '../repos/profile';
import { addWeight, confirmWeight, deleteWeight, logManualWeight, manualWeightOn, weightsQuery } from '../repos/weights';
import { createTestDb } from './testDb';

const D = '2026-10-12';

describe('repositories', () => {
  it('profile: one row with a stable id; edits mark it dirty', () => {
    const db = createTestDb();
    expect(getProfile(db)).toBeUndefined();
    createProfile(db, { formulaSex: 'female', birthDate: '1995-05-05', heightCm: 165, activityLevel: 'light', weightUnit: 'lb', heightUnit: 'ftin', proteinGPerKg: 2.2 }, 1000);
    const p = getProfile(db)!;
    expect(p.id).toBe(ids.profile());
    expect(p.calorieMode).toBe('adaptive');
    expect(p.hideCalories).toBe(false);
    updateProfile(db, { hideCalories: true }, 2000);
    expect(getProfile(db)).toMatchObject({ hideCalories: true, updatedAt: 2000, dirty: true });
  });

  it('goals: starting a new goal ends the previous one', () => {
    const db = createTestDb();
    startGoal(db, { type: 'lose', rateKgPerWeek: 0.5, startDate: '2026-10-01' });
    startGoal(db, { type: 'maintain', rateKgPerWeek: 0.5, startDate: D });
    const g = goalsQuery(db).all();
    expect(g).toHaveLength(2);
    expect(g[0]).toMatchObject({ type: 'lose', endDate: D });
    expect(g[1]).toMatchObject({ type: 'maintain', rateKgPerWeek: 0, endDate: null });
  });

  it('weights: add, confirm an outlier, soft delete', () => {
    const db = createTestDb();
    const a = addWeight(db, { weightKg: 80, localDate: D, measuredAt: 1 });
    const b = addWeight(db, { weightKg: 95, localDate: '2026-10-13', measuredAt: 2 });
    confirmWeight(db, b);
    expect(weightsQuery(db).all().find((w) => w.id === b)!.outlierStatus).toBe('confirmed');
    deleteWeight(db, a, 5);
    expect(weightsQuery(db).all().map((w) => w.id)).toEqual([b]);
  });

  it('manual weigh-ins: one per day, a second entry corrects it', () => {
    const db = createTestDb();
    const a = logManualWeight(db, { weightKg: 80, localDate: D, measuredAt: 1 });
    addWeight(db, { weightKg: 79.5, localDate: D, measuredAt: 0, source: 'healthkit' });
    confirmWeight(db, a);
    const b = logManualWeight(db, { weightKg: 80.4, localDate: D, measuredAt: 2 }, 9);
    expect(b).toBe(a);
    expect(manualWeightOn(db, D)).toMatchObject({ weightKg: 80.4, outlierStatus: 'none', updatedAt: 9 });
    expect(weightsQuery(db).all()).toHaveLength(2); // the HealthKit sample is untouched
    expect(manualWeightOn(db, '2026-10-13')).toBeUndefined();
  });

  it('food logs: quick add, edit, delete, daily totals', () => {
    const db = createTestDb();
    const id = quickAdd(db, { localDate: D, meal: 'lunch', kcal: 600, proteinG: 40 }, 100);
    quickAdd(db, { localDate: D, meal: 'dinner', name: '  Pasta ', kcal: 800, carbsG: 100 }, 200);
    quickAdd(db, { localDate: '2026-10-13', meal: 'snack', kcal: 150 }, 300);
    expect(getFoodLog(db, id)!.name).toBe('Quick add');
    expect(foodLogsForDateQuery(db, D).all().map((f) => f.name)).toEqual(['Quick add', 'Pasta']);

    updateQuickAdd(db, id, { localDate: D, meal: 'lunch', kcal: 650, proteinG: 45 }, 400);
    expect(getFoodLog(db, id)).toMatchObject({ kcal: 650, updatedAt: 400 });

    const totals = dailyTotalsQuery(db).all();
    expect(totals.find((t) => t.date === D)).toMatchObject({ kcal: 1450, proteinG: 45, carbsG: 100 });

    deleteFoodLog(db, id, 500);
    expect(foodLogsForDateQuery(db, D).all()).toHaveLength(1);
    expect(dailyTotalsQuery(db).all().find((t) => t.date === D)!.kcal).toBe(800);
  });

  it('days: "fully logged" toggles one deterministic row per date', () => {
    const db = createTestDb();
    setDayComplete(db, D, true, 1);
    setDayComplete(db, D, false, 2);
    setDayComplete(db, D, true, 3);
    const days = daysQuery(db).all();
    expect(days).toHaveLength(1);
    expect(days[0]).toMatchObject({ id: ids.day(D), isComplete: true, updatedAt: 3 });

    const logs = toDayLogs([{ date: D, kcal: 2000 }, { date: '2026-10-13', kcal: 500 }], days);
    expect(logs).toEqual([
      { date: D, kcal: 2000, isComplete: true },
      { date: '2026-10-13', kcal: 500, isComplete: false },
    ]);
    // A complete day with nothing logged still shows up (with 0 kcal), so the algorithm can ignore it.
    expect(toDayLogs([], days)).toEqual([{ date: D, kcal: 0, isComplete: true }]);
  });

  it('check-ins: upsert by date, latest, seen flag', () => {
    const db = createTestDb();
    const result = {
      date: D, dataThrough: D, status: 'learning', previousTdee: null, tdee: 2500, baselineTdee: 2200,
      formulaTdee: 2500, observedTdee: null, observedBaselineTdee: null, confidence: 'learning', stats: null,
      trendKg: 80, reasons: ['still_learning'], needed: { completeDays: 10, weighIns: 7 },
      targets: { calories: 1950, proteinG: 176, fatG: 54, carbsG: 194, goalType: 'lose', rateKgPerWeek: 0.5, reasons: [] },
    } as const;
    expect(saveCheckIn(db, D, { ...result, reasons: [...result.reasons], targets: { ...result.targets, reasons: [] } })).toBe(true);
    saveCheckIn(db, D, { ...result, tdee: 2450, reasons: [], targets: null });
    saveCheckIn(db, '2026-10-19', { ...result, tdee: 2400, reasons: [], targets: null });
    expect(checkInsQuery(db).all()).toHaveLength(2);
    expect(latestCheckIn(db)!.tdee).toBe(2400);
    expect(checkInsQuery(db).all()[0]).toMatchObject({ tdee: 2450, calorieTarget: null, reasons: [] });
    markCheckInSeen(db, '2026-10-19');
    expect(latestCheckIn(db)!.seen).toBe(true);
    expect(saveCheckIn(db, '2026-10-26', { ...result, tdee: null, reasons: [], targets: null })).toBe(false);
  });
});
