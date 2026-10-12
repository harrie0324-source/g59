import { formulaTdee } from '../bmr';
import { runCheckIns, toAnchor, weeklyCheckIn, type CheckInInput } from '../checkin';
import { addDays } from '../dates';
import { describeCheckIn } from '../describe';
import { lbToKg } from '../units';
import type { ActivityLog } from '../types';
import { makeGoal, makeProfile, simulate, START, weekly } from '../__fixtures__/builders';

const profile = makeProfile(); // male, 29, 180 cm, moderate → formula ≈ 2,840 at 85 kg
const goals = [makeGoal()];
const TRUE_TDEE = 2500;
const sim = simulate({ days: 120, trueTdee: TRUE_TDEE, intake: 2000, startWeightKg: 85, noiseKg: 0.4, seed: 7 });

const input = (o: Partial<CheckInInput> = {}): CheckInInput => ({
  date: addDays(START, 28),
  profile,
  goals,
  weights: sim.weights,
  dayLogs: sim.dayLogs,
  previous: null,
  ...o,
});

describe('weekly check-in', () => {
  it('no data → nothing to compute, says so', () => {
    const r = weeklyCheckIn(input({ weights: [], dayLogs: [] }));
    expect(r.reasons).toEqual(['no_weight_data']);
    expect(r.tdee).toBeNull();
    expect(r.targets).toBeNull();
    expect(toAnchor(r)).toBeNull();
    expect(describeCheckIn(r, { unit: 'kg', formulaSex: 'male' })).toEqual(['Add a weigh-in to get started.']);
  });

  it('one weigh-in → formula estimate, "still learning", targets available', () => {
    const r = weeklyCheckIn(input({ date: addDays(START, 1), weights: sim.weights.slice(0, 1), dayLogs: sim.dayLogs.slice(0, 1) }));
    expect(r.status).toBe('learning');
    const w0 = sim.weights[0]!.weightKg;
    expect(r.tdee).toBeCloseTo(formulaTdee({ sex: 'male', weightKg: w0, heightCm: 180, age: 29, activityLevel: 'moderate' }));
    expect(r.reasons).toContain('still_learning');
    expect(r.needed.weighIns).toBe(7); // weigh-ins in the 7-day settling period don't count
    expect(r.targets!.calories).toBeGreaterThan(1500);
    expect(r.confidence).toBe('learning');
  });

  it('first 7 days after starting a loss goal are ignored, so day 14 is still learning', () => {
    const r = weeklyCheckIn(input({ date: addDays(START, 14) }));
    expect(r.status).toBe('learning');
    expect(r.reasons).toEqual(expect.arrayContaining(['still_learning', 'goal_change_settling', 'not_enough_logged_days']));
  });

  it('adapts once there is enough data, moving ≤150 kcal per week toward the truth', () => {
    const results = runCheckIns(weekly(START, 15, 14), { profile, goals, weights: sim.weights, dayLogs: sim.dayLogs });
    const adaptive = results.filter((r) => r.status === 'adaptive');
    expect(adaptive.length).toBeGreaterThan(10);
    for (let i = 1; i < results.length; i++) {
      const prev = results[i - 1]!.tdee!;
      if (results[i]!.status === 'adaptive' && results[i - 1]!.status !== 'learning') {
        expect(Math.abs(results[i]!.tdee! - prev)).toBeLessThanOrEqual(150 + 1e-9);
      }
    }
    expect(adaptive[0]!.reasons).toContain('tdee_down');
    expect(adaptive[0]!.reasons).toContain('change_capped');
    expect(Math.abs(results.at(-1)!.tdee! - TRUE_TDEE)).toBeLessThan(100);
    expect(results.at(-1)!.confidence).toBe('high');
  });

  it('gaps of 5+ days between weigh-ins still adapt (7 weigh-ins in the window)', () => {
    // Window = days 21–41. Weigh-ins on 21, then a 6-day gap, then every 3 days.
    const keep = new Set([27, 30, 33, 36, 39, 41]);
    const gappy = sim.weights.filter((_, d) => d <= 21 || keep.has(d));
    const r = weeklyCheckIn(input({ date: addDays(START, 42), weights: gappy }));
    expect(r.stats!.weighIns).toBeGreaterThanOrEqual(7);
    expect(r.status).toBe('adaptive');
  });

  it('a wild outlier is flagged and barely affects the estimate', () => {
    const base = weeklyCheckIn(input({ date: addDays(START, 42) }));
    const withOutlier = sim.weights.map((w, i) => (i === 38 ? { ...w, weightKg: w.weightKg + 12 } : w));
    const r = weeklyCheckIn(input({ date: addDays(START, 42), weights: withOutlier }));
    expect(r.reasons).toContain('outliers_pending');
    expect(Math.abs(r.observedTdee! - base.observedTdee!)).toBeLessThan(60);
  });

  it('goal switched mid-week: holds the estimate, applies the new goal right away', () => {
    const results = runCheckIns(weekly(START, 6, 14), { profile, goals, weights: sim.weights, dayLogs: sim.dayLogs });
    const anchor = toAnchor(results.at(-1)!)!;
    expect(anchor.status).toBe('adaptive');
    const date = addDays(START, 56);
    const switched = [...goals, makeGoal({ id: 'g2', type: 'maintain', startDate: addDays(date, -3) })];
    const r = weeklyCheckIn(input({ date, goals: switched, previous: anchor }));
    expect(r.status).toBe('holding');
    expect(r.tdee).toBe(anchor.tdee);
    expect(r.reasons).toEqual(expect.arrayContaining(['holding_previous', 'goal_change_settling']));
    expect(r.targets!.goalType).toBe('maintain');
    expect(r.targets!.calories).toBe(Math.round(anchor.tdee / 10) * 10);
  });

  it('0 kcal on a "complete" day is ignored instead of dragging the estimate down', () => {
    const date = addDays(START, 42);
    const clean = weeklyCheckIn(input({ date }));
    const zeroed = sim.dayLogs.map((d, i) => (i === 35 || i === 36 ? { ...d, kcal: 0 } : d));
    const r = weeklyCheckIn(input({ date, dayLogs: zeroed }));
    expect(r.reasons).toContain('zero_kcal_days_ignored');
    expect(r.stats!.zeroKcalDaysIgnored).toBe(2);
    expect(r.observedTdee).toBeCloseTo(clean.observedTdee!, 6);
  });

  it('lb vs kg entry gives the same result (all math in kg)', () => {
    const date = addDays(START, 42);
    const viaLb = sim.weights.map((w) => ({ ...w, weightKg: lbToKg(w.weightKg / 0.45359237) }));
    expect(weeklyCheckIn(input({ date, weights: viaLb })).tdee).toBeCloseTo(weeklyCheckIn(input({ date })).tdee!, 6);
  });

  it('holds the last estimate when logging stops after adapting', () => {
    const results = runCheckIns(weekly(START, 6, 14), { profile, goals, weights: sim.weights, dayLogs: sim.dayLogs });
    const anchor = toAnchor(results.at(-1)!)!;
    const date = addDays(START, 84);
    const r = weeklyCheckIn(input({
      date,
      previous: anchor,
      weights: sim.weights.filter((w) => w.localDate < addDays(START, 56)),
      dayLogs: sim.dayLogs.filter((d) => d.date < addDays(START, 56)),
    }));
    expect(r.status).toBe('holding');
    expect(r.tdee).toBe(anchor.tdee);
    expect(r.reasons).toContain('not_enough_weigh_ins');
  });

  it('under 18 → no calorie targets', () => {
    const r = weeklyCheckIn(input({ profile: makeProfile({ birthDate: addDays(START, -365 * 17) }) }));
    expect(r.targets).toBeNull();
    expect(r.reasons[0]).toBe('under_18');
  });

  it('pregnancy disables the deficit; floors apply', () => {
    const preg = weeklyCheckIn(input({ profile: makeProfile({ formulaSex: 'female', pregnancyStatus: 'pregnant' }) }));
    expect(preg.targets!.goalType).toBe('maintain');
    expect(preg.reasons).toContain('pregnancy_no_deficit');

    const small = simulate({ days: 30, trueTdee: 1500, intake: 1300, startWeightKg: 48 });
    const r = weeklyCheckIn({
      date: addDays(START, 28),
      profile: makeProfile({ formulaSex: 'female', heightCm: 152, activityLevel: 'sedentary', birthDate: '1960-01-01' }),
      goals: [makeGoal({ rateKgPerWeek: 0.45 })],
      weights: small.weights,
      dayLogs: small.dayLogs,
      previous: null,
    });
    expect(r.targets!.calories).toBe(1200);
    expect(r.reasons).toContain('floor_applied');
  });
});

describe('calorie modes', () => {
  // 45 min moderate run 4×/week, logged manually AND imported from HealthKit (dedupe test).
  const runs: ActivityLog[] = [];
  for (let d = 0; d < 120; d++) {
    if (d % 7 >= 4) continue;
    const date = addDays(START, d);
    const startedAt = Date.parse(`${date}T18:00:00Z`);
    runs.push({ id: `m${d}`, localDate: date, startedAt, activityCode: 'running', durationMin: 45, intensity: 'moderate', source: 'manual' });
    runs.push({ id: `h${d}`, localDate: date, startedAt: startedAt + 60_000, activityCode: 'running', durationMin: 44, intensity: 'vigorous', source: 'healthkit' });
  }
  const date = addDays(START, 42);

  it('no activity logged: baseline equals total observed TDEE', () => {
    const r = weeklyCheckIn(input({ date, profile: makeProfile({ calorieMode: 'daily_adjust' }) }));
    expect(r.observedBaselineTdee).toBeCloseTo(r.observedTdee!, 6);
  });

  it('daily-adjust: baseline = observed − avg exercise, deduped so runs count once', () => {
    const manualOnly = runs.filter((r) => r.source === 'manual');
    const a = weeklyCheckIn(input({ date, activityLogs: runs, profile: makeProfile({ calorieMode: 'daily_adjust' }) }));
    const b = weeklyCheckIn(input({ date, activityLogs: manualOnly, profile: makeProfile({ calorieMode: 'daily_adjust' }) }));
    expect(a.stats!.avgExerciseKcal).toBeCloseTo(b.stats!.avgExerciseKcal, 6);
    expect(a.stats!.avgExerciseKcal).toBeGreaterThan(200);
    expect(a.observedBaselineTdee).toBeCloseTo(a.observedTdee! - a.stats!.avgExerciseKcal, 6);
  });

  it('adaptive mode: activity is tracked but does not change targets', () => {
    const without = weeklyCheckIn(input({ date }));
    const withRuns = weeklyCheckIn(input({ date, activityLogs: runs }));
    expect(withRuns.targets).toEqual(without.targets);
  });

  it('switching modes mid-window: both estimates are always tracked, nothing double-counted', () => {
    const dates = weekly(START, 6, 14);
    const shared = { goals, weights: sim.weights, dayLogs: sim.dayLogs, activityLogs: runs };
    const adaptive = runCheckIns(dates, { ...shared, profile });
    const daily = runCheckIns(dates, { ...shared, profile: makeProfile({ calorieMode: 'daily_adjust' }) });
    // Observed values don't depend on the mode.
    expect(daily.at(-1)!.observedTdee).toBeCloseTo(adaptive.at(-1)!.observedTdee!, 6);

    // Switch to daily-adjust for the last check-in, carrying the adaptive anchor.
    const switched = weeklyCheckIn({
      ...shared,
      date: addDays(dates.at(-1)!, 7),
      profile: makeProfile({ calorieMode: 'daily_adjust' }),
      previous: toAnchor(adaptive.at(-1)!),
    });
    const stayed = weeklyCheckIn({ ...shared, date: addDays(dates.at(-1)!, 7), profile, previous: toAnchor(adaptive.at(-1)!) });
    expect(switched.tdee).toBeCloseTo(stayed.tdee!, 6);
    expect(switched.baselineTdee).toBeCloseTo(stayed.baselineTdee!, 6);
    // Daily-adjust targets start from the lower baseline; exercise is added per day instead.
    expect(switched.targets!.calories).toBeLessThan(stayed.targets!.calories);
    expect(switched.baselineTdee!).toBeLessThan(switched.tdee!);
  });
});
