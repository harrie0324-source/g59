import { addDays, lbToKg } from '@/core';
import { createTestDb } from '@/db/__tests__/testDb';
import { checkInsQuery } from '@/db/repos/checkIns';
import { setDayComplete } from '@/db/repos/days';
import { quickAdd } from '@/db/repos/foodLogs';
import { addWeight } from '@/db/repos/weights';

import { dueCheckInDates, runDueCheckIns, weekdayOf } from '../checkins';
import { eraseLocalData } from '../erase';
import { loadAppData } from '../appData';
import { buildPlan, completeOnboarding, emptyDraft } from '../onboarding';

const START = '2026-10-13'; // Tuesday

function onboard() {
  const db = createTestDb();
  const plan = buildPlan(
    {
      ...emptyDraft, disclaimerAccepted: true, formulaSex: 'male', dobMonth: '3', dobDay: '1', dobYear: '1996',
      heightFt: '5', heightIn: '11', weight: '187', activityLevel: 'moderate', goalType: 'lose', rateKgPerWeek: lbToKg(1),
    },
    START,
  )!;
  completeOnboarding(db, plan, START, 0);
  return db;
}

describe('dueCheckInDates', () => {
  it('lists check-in weekdays after the last check-in, up to today', () => {
    expect(weekdayOf('2026-10-12')).toBe(1); // Monday
    expect(dueCheckInDates('2026-10-13', '2026-10-18', 1)).toEqual([]);
    expect(dueCheckInDates('2026-10-13', '2026-10-19', 1)).toEqual(['2026-10-19']);
    expect(dueCheckInDates('2026-10-13', '2026-11-03', 1)).toEqual(['2026-10-19', '2026-10-26', '2026-11-02']);
    expect(dueCheckInDates(undefined, '2026-11-03', 1)).toEqual([]);
  });
});

describe('runDueCheckIns', () => {
  it('does nothing before onboarding', () => {
    expect(runDueCheckIns(createTestDb(), START)).toEqual([]);
  });

  it('catches up weekly check-ins and adapts once there is enough data', () => {
    const db = onboard();
    // 5 weeks: eat 2,000 kcal, fully logged, weigh in daily, losing ~0.06 kg/day (true TDEE ≈ 2,460).
    for (let d = 1; d <= 35; d++) {
      const date = addDays(START, d);
      quickAdd(db, { localDate: date, meal: 'lunch', kcal: 2000 });
      setDayComplete(db, date, true);
      addWeight(db, { weightKg: lbToKg(187) - 0.06 * d, localDate: date, measuredAt: d });
    }
    const created = runDueCheckIns(db, addDays(START, 35));
    expect(created).toEqual(['2026-10-19', '2026-10-26', '2026-11-02', '2026-11-09', '2026-11-16']);
    const rows = checkInsQuery(db).all();
    expect(rows.map((r) => r.status)).toEqual(['learning', 'learning', 'learning', 'adaptive', 'adaptive', 'adaptive']);
    expect(rows.every((r) => r.seen === (r.date === START))).toBe(true);
    // Moves down from the formula toward the observed value, ≤150 kcal per check-in.
    for (let i = 4; i < rows.length; i++) expect(rows[i - 1]!.tdee - rows[i]!.tdee).toBeLessThanOrEqual(150 + 1e-6);
    expect(rows.at(-1)!.tdee).toBeLessThan(rows[0]!.tdee);
    // Running again is a no-op.
    expect(runDueCheckIns(db, addDays(START, 35))).toEqual([]);
  });

  it('erase removes everything', () => {
    const db = onboard();
    eraseLocalData(db);
    expect(loadAppData(db)).toBeNull();
    expect(checkInsQuery(db).all()).toEqual([]);
  });
});
