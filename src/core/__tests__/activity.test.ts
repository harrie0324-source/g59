import { getActivityType, searchActivityTypes, ACTIVITY_TYPES } from '../activity/compendium';
import { dedupeActivities, isDuplicate } from '../activity/dedupe';
import { activityKcal, exerciseKcalByDate, formatApproxKcal, intensityFromRpe, metFor, netMetKcal } from '../activity/met';
import {
  dailyStepKcal,
  isUnusuallyHighSteps,
  resolveDailySteps,
  stepKcal,
  stepsCoveredByActivities,
} from '../activity/steps';
import { correlation, estimateActivityLevel, suggestActivityLevel } from '../insights';
import type { ActivityLog } from '../types';

const DAY = '2026-01-10';
const t0 = Date.parse(`${DAY}T17:00:00Z`);
const log = (o: Partial<ActivityLog>): ActivityLog => ({
  id: 'a',
  localDate: DAY,
  activityCode: 'running',
  durationMin: 30,
  intensity: 'moderate',
  source: 'manual',
  ...o,
});

describe('MET burn (net of BMR)', () => {
  it('kcal = (MET − 1) × kg × hours', () => {
    expect(netMetKcal(9.8, 70, 30)).toBeCloseTo(8.8 * 70 * 0.5);
    expect(activityKcal(log({}), 70)).toBeCloseTo(308);
  });
  it('MET ≤ 1, zero duration or zero weight → 0', () => {
    expect(netMetKcal(1, 70, 60)).toBe(0);
    expect(netMetKcal(0.5, 70, 60)).toBe(0);
    expect(netMetKcal(5, 70, 0)).toBe(0);
    expect(netMetKcal(5, 0, 30)).toBe(0);
  });
  it('unknown activity codes fall back to generic METs', () => {
    expect(metFor('underwater_hockey', 'vigorous')).toBe(8);
    expect(getActivityType('running')!.met.moderate).toBe(9.8);
  });
  it('strength intensity comes from RPE', () => {
    expect(intensityFromRpe(5)).toBe('light');
    expect(intensityFromRpe(7)).toBe('moderate');
    expect(intensityFromRpe(9)).toBe('vigorous');
    expect(activityKcal(log({ activityCode: 'strength', durationMin: 60, intensity: intensityFromRpe(8) }), 80)).toBeCloseTo(400);
  });
  it('every compendium entry is sane', () => {
    for (const a of ACTIVITY_TYPES) {
      expect(a.met.light).toBeLessThanOrEqual(a.met.moderate);
      expect(a.met.moderate).toBeLessThanOrEqual(a.met.vigorous);
      expect(a.met.light).toBeGreaterThan(1);
    }
    expect(searchActivityTypes('bike').map((a) => a.code)).toEqual(['stationary_bike']);
    expect(searchActivityTypes('  ')).toHaveLength(ACTIVITY_TYPES.length);
  });
  it('burn is always shown as a rounded estimate with "~"', () => {
    expect(formatApproxKcal(308)).toBe('~310 kcal');
    expect(formatApproxKcal(23)).toBe('~25 kcal');
    expect(formatApproxKcal(1234)).toBe('~1,230 kcal');
    expect(formatApproxKcal(-5)).toBe('~0 kcal');
  });
  it('no activity logged → no exercise kcal', () => {
    expect(exerciseKcalByDate([], 80).size).toBe(0);
  });
  it('sums multiple activities per day', () => {
    const m = exerciseKcalByDate([log({ id: '1' }), log({ id: '2', activityCode: 'yoga', intensity: 'light' })], 70);
    expect(m.get(DAY)).toBeCloseTo(308 + 1.5 * 70 * 0.5);
  });
});

describe('step calories', () => {
  it('≈ steps × 0.414 × height_m × kg × 0.0005', () => {
    expect(stepKcal({ steps: 10_000, heightCm: 175, weightKg: 70 })).toBeCloseTo(253.6, 1);
  });
  it('scales with body weight', () => {
    const a = stepKcal({ steps: 8000, heightCm: 175, weightKg: 60 });
    const b = stepKcal({ steps: 8000, heightCm: 175, weightKg: 90 });
    expect(b / a).toBeCloseTo(1.5);
  });
  it('very high step counts: flagged, and capped at 100k for the math', () => {
    expect(isUnusuallyHighSteps(45_000)).toBe(false);
    expect(isUnusuallyHighSteps(60_000)).toBe(true);
    const capped = stepKcal({ steps: 250_000, heightCm: 180, weightKg: 80 });
    expect(capped).toBeCloseTo(stepKcal({ steps: 100_000, heightCm: 180, weightKg: 80 }));
    expect(Number.isFinite(capped)).toBe(true);
    expect(stepKcal({ steps: -50, heightCm: 180, weightKg: 80 })).toBe(0);
  });
  it('manual steps override health; otherwise the max health value', () => {
    const m = resolveDailySteps([
      { localDate: DAY, steps: 8000, source: 'healthkit' },
      { localDate: DAY, steps: 9000, source: 'manual' },
      { localDate: '2026-01-11', steps: 5000, source: 'healthkit' },
      { localDate: '2026-01-11', steps: 6000, source: 'health_connect' },
    ]);
    expect(m.get(DAY)).toBe(9000);
    expect(m.get('2026-01-11')).toBe(6000);
  });
  it('removes steps already covered by a logged walk or run', () => {
    const walk = log({ activityCode: 'walking', durationMin: 30, intensity: 'moderate' });
    expect(stepsCoveredByActivities([walk, log({ activityCode: 'strength' })])).toBe(3150);
    const withWalk = dailyStepKcal({ steps: 10_000, dayActivities: [walk], heightCm: 175, weightKg: 70 });
    expect(withWalk).toBeCloseTo(stepKcal({ steps: 6850, heightCm: 175, weightKg: 70 }));
    const noActivity = dailyStepKcal({ steps: 10_000, dayActivities: [], heightCm: 175, weightKg: 70 });
    expect(noActivity).toBeCloseTo(253.6, 1);
    // A long logged run covering more steps than recorded floors at 0.
    expect(dailyStepKcal({ steps: 2000, dayActivities: [log({ durationMin: 60 })], heightCm: 175, weightKg: 70 })).toBe(0);
  });
});

describe('dedupe: same workout from Health + manual', () => {
  const manual = log({ id: 'm', startedAt: t0, durationMin: 30 });
  const hk = log({ id: 'hk', startedAt: t0 + 2 * 60_000, durationMin: 31, source: 'healthkit' });

  it('overlapping times → one session, manual kept', () => {
    const r = dedupeActivities([hk, manual]);
    expect(r.kept.map((k) => k.id)).toEqual(['m']);
    expect(r.duplicates.get('hk')).toBe('m');
  });
  it('manual without a start time matches on similar duration', () => {
    expect(isDuplicate(log({ id: 'm2' }), hk)).toBe(true);
    expect(isDuplicate(log({ id: 'm3', durationMin: 75 }), hk)).toBe(false);
  });
  it('two manual entries are never merged', () => {
    expect(dedupeActivities([manual, { ...manual, id: 'm2' }]).kept).toHaveLength(2);
  });
  it('different activity types or times are kept', () => {
    expect(isDuplicate(manual, { ...hk, activityCode: 'yoga' })).toBe(false);
    expect(isDuplicate(manual, { ...hk, startedAt: t0 + 3 * 3600_000 })).toBe(false);
    expect(isDuplicate(manual, { ...hk, localDate: '2026-01-11' })).toBe(false);
  });
  it('same category counts as the same kind (walk vs treadmill walk)', () => {
    const w = log({ id: 'w', activityCode: 'walking', startedAt: t0 });
    expect(isDuplicate(w, { ...w, id: 'hw', activityCode: 'treadmill_walk', source: 'health_connect' })).toBe(true);
    expect(isDuplicate(w, { ...w, id: 'x', activityCode: 'mystery', source: 'healthkit' })).toBe(false);
  });
  it('dedupe means burn is counted once', () => {
    const kept = dedupeActivities([manual, hk]).kept;
    expect(exerciseKcalByDate(kept, 70).get(DAY)).toBeCloseTo(308);
  });
});

describe('activity level insights', () => {
  it('estimates level from steps and active minutes', () => {
    expect(estimateActivityLevel(3000, 0)).toBe('sedentary');
    expect(estimateActivityLevel(8000, 30)).toBe('moderate');
    expect(estimateActivityLevel(3000, 320)).toBe('very');
    expect(estimateActivityLevel(15000, 500)).toBe('extra');
  });
  it('suggests a change only with enough data and a mismatch', () => {
    expect(suggestActivityLevel({ current: 'very', avgSteps: 4000, weeklyActiveMinutes: 20, daysOfData: 21 })).toBe('sedentary');
    expect(suggestActivityLevel({ current: 'sedentary', avgSteps: 4000, weeklyActiveMinutes: 20, daysOfData: 21 })).toBeNull();
    expect(suggestActivityLevel({ current: 'very', avgSteps: 4000, weeklyActiveMinutes: 20, daysOfData: 7 })).toBeNull();
  });
  it('correlation', () => {
    expect(correlation([1, 2, 3, 4], [2, 4, 6, 8])).toBeCloseTo(1);
    expect(correlation([1, 2, 3], [3, 2, 1])).toBeCloseTo(-1);
    expect(correlation([1, 2], [1, 2])).toBeNull();
    expect(correlation([1, 1, 1], [1, 2, 3])).toBeNull();
  });
});
