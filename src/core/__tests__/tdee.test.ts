import { addDays } from '../dates';
import {
  blendTdee,
  confidenceLevel,
  observedWeight,
  settleStart,
  windowStats,
} from '../tdee';
import { computeTrend } from '../trend';
import { makeGoal, simulate, START } from '../__fixtures__/builders';

describe('settleStart', () => {
  it('ignores 7 days after a goal change', () => {
    const goals = [makeGoal({ type: 'maintain', startDate: START }), makeGoal({ id: 'g2', startDate: addDays(START, 30) })];
    expect(settleStart(goals, addDays(START, 20))).toBeUndefined(); // initial maintain → no settling
    expect(settleStart(goals, addDays(START, 33))).toBe(addDays(START, 37));
  });
  it('a first goal of lose/gain settles too', () => {
    expect(settleStart([makeGoal()], addDays(START, 5))).toBe(addDays(START, 7));
  });
  it('no goals → none', () => {
    expect(settleStart([], START)).toBeUndefined();
  });
});

describe('windowStats', () => {
  const sim = simulate({ days: 42, trueTdee: 2500, intake: 2000, startWeightKg: 85 });
  const end = addDays(START, 41);

  it('recovers the true TDEE from clean data', () => {
    const s = windowStats({ end, dayLogs: sim.dayLogs, trend: computeTrend(sim.weights, { endDate: end }) });
    expect(s.days).toBe(21);
    expect(s.completeDays).toBe(21);
    expect(s.weighIns).toBe(21);
    expect(s.avgIntake).toBe(2000);
    expect(s.observedTdee!).toBeGreaterThan(2450);
    expect(s.observedTdee!).toBeLessThan(2550);
    expect(s.quality).toBe(1);
  });

  it('only counts days marked complete', () => {
    const logs = sim.dayLogs.map((d, i) => (i % 2 ? { ...d, isComplete: false, kcal: 9999 } : d));
    const s = windowStats({ end, dayLogs: logs, trend: computeTrend(sim.weights, { endDate: end }) });
    expect(s.completeDays).toBe(10); // even days 22–40
    expect(s.avgIntake).toBe(2000);
  });

  it('0 kcal on a "complete" day is ignored, not averaged in', () => {
    const logs = sim.dayLogs.map((d, i) => (i === 40 ? { ...d, kcal: 0 } : d));
    const s = windowStats({ end, dayLogs: logs, trend: computeTrend(sim.weights, { endDate: end }) });
    expect(s.zeroKcalDaysIgnored).toBe(1);
    expect(s.completeDays).toBe(20);
    expect(s.avgIntake).toBe(2000);
  });

  it('requires 10 complete days and 7 weigh-ins', () => {
    const few = simulate({ days: 42, trueTdee: 2500, intake: 2000, complete: (d) => d < 21 || d % 3 === 0 });
    const s = windowStats({ end, dayLogs: few.dayLogs, trend: computeTrend(few.weights, { endDate: end }) });
    expect(s.completeDays).toBeLessThan(10);
    expect(s.meetsMinimum).toBe(false);
    expect(s.observedTdee).toBeNull();

    const sparse = simulate({ days: 42, trueTdee: 2500, intake: 2000, weighIn: (d) => d < 21 || (d >= 24 && d % 3 === 0) });
    const s2 = windowStats({ end, dayLogs: sparse.dayLogs, trend: computeTrend(sparse.weights, { endDate: end }) });
    expect(s2.weighIns).toBe(6);
    expect(s2.observedTdee).toBeNull();
  });

  it('window is clipped by goal settling and by the first weigh-in', () => {
    const goals = [makeGoal({ startDate: addDays(START, 30) })];
    const s = windowStats({ end, dayLogs: sim.dayLogs, trend: computeTrend(sim.weights, { endDate: end }), goals });
    expect(s.start).toBe(addDays(START, 37));
    expect(s.meetsMinimum).toBe(false);

    const late = sim.weights.filter((w) => w.localDate >= addDays(START, 35));
    const s2 = windowStats({ end, dayLogs: sim.dayLogs, trend: computeTrend(late, { endDate: end }) });
    expect(s2.start).toBe(addDays(START, 35));
  });

  it('averages exercise over every calendar day in the window', () => {
    const ex = new Map([[addDays(START, 40), 420]]);
    const s = windowStats({ end, dayLogs: sim.dayLogs, trend: computeTrend(sim.weights, { endDate: end }), exerciseKcalByDate: ex });
    expect(s.avgExerciseKcal).toBeCloseTo(20);
  });

  it('no data at all', () => {
    const s = windowStats({ end, dayLogs: [], trend: computeTrend([]) });
    expect(s.observedTdee).toBeNull();
    expect(s.avgIntake).toBeNull();
    expect(s.deltaTrendKg).toBeNull();
    expect(s.quality).toBe(0);
  });
});

describe('blendTdee', () => {
  it('gives more weight to observed data as quality rises', () => {
    expect(observedWeight(0)).toBeCloseTo(0.2);
    expect(observedWeight(1)).toBeCloseTo(0.8);
    expect(observedWeight(5)).toBeCloseTo(0.8);
    const low = blendTdee(2500, 2600, 0.4).value;
    const high = blendTdee(2500, 2600, 1).value;
    expect(high).toBeGreaterThan(low);
    expect(high).toBeCloseTo(2580);
  });
  it('caps changes at ±150 kcal per check-in', () => {
    expect(blendTdee(2500, 3500, 1)).toEqual({ value: 2650, capped: true });
    expect(blendTdee(2500, 1500, 1)).toEqual({ value: 2350, capped: true });
    expect(blendTdee(2500, 2550, 1).capped).toBe(false);
  });
});

describe('confidenceLevel', () => {
  it('maps quality to a label', () => {
    expect(confidenceLevel(false, 1)).toBe('learning');
    expect(confidenceLevel(true, 0.4)).toBe('low');
    expect(confidenceLevel(true, 0.6)).toBe('medium');
    expect(confidenceLevel(true, 0.9)).toBe('high');
  });
});
