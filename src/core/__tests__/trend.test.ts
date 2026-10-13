import { addDays } from '../dates';
import { computeTrend, dailyWeighIns, latestTrend, trendOn } from '../trend';
import type { WeightEntry } from '../types';

const D0 = '2026-01-05';
function entries(values: (number | null)[], start = D0): WeightEntry[] {
  const out: WeightEntry[] = [];
  values.forEach((v, i) => {
    if (v === null) return;
    const date = addDays(start, i);
    out.push({ id: `e${i}`, localDate: date, measuredAt: Date.parse(`${date}T07:00:00Z`), weightKg: v, source: 'manual' });
  });
  return out;
}

describe('computeTrend', () => {
  it('no data → empty result', () => {
    const r = computeTrend([], { endDate: D0 });
    expect(r.points).toEqual([]);
    expect(r.outliers).toEqual([]);
    expect(latestTrend(r)).toBeUndefined();
    expect(trendOn(r, D0)).toBeUndefined();
  });

  it('one weigh-in → trend equals that weight, carried forward', () => {
    const r = computeTrend(entries([80]), { endDate: addDays(D0, 3) });
    expect(r.points).toHaveLength(4);
    r.points.forEach((p) => expect(p.trendKg).toBe(80));
    expect(r.points[0]!.weightKg).toBe(80);
    expect(r.points[3]!.weightKg).toBeNull();
    expect(r.accepted).toHaveLength(1);
  });

  it('applies the EMA with alpha 0.1 by default', () => {
    const r = computeTrend(entries([80, 81]));
    expect(r.points[0]!.trendKg).toBe(80);
    expect(r.points[1]!.trendKg).toBeCloseTo(80.1);
  });

  it('alpha is configurable and validated', () => {
    const slow = computeTrend(entries([80, 81]), { alpha: 0.1 }).points[1]!.trendKg;
    const fast = computeTrend(entries([80, 81]), { alpha: 0.5 }).points[1]!.trendKg;
    expect(fast).toBeGreaterThan(slow);
    expect(() => computeTrend(entries([80]), { alpha: 0 })).toThrow();
    expect(() => computeTrend(entries([80]), { alpha: 1.5 })).toThrow();
  });

  it('uses the earliest weigh-in of a day and ignores invalid values', () => {
    const e: WeightEntry[] = [
      { id: 'pm', localDate: D0, measuredAt: 2000, weightKg: 81, source: 'manual' },
      { id: 'am', localDate: D0, measuredAt: 1000, weightKg: 80, source: 'healthkit' },
      { id: 'bad', localDate: addDays(D0, 1), measuredAt: 1, weightKg: 0, source: 'manual' },
      { id: 'nan', localDate: addDays(D0, 2), measuredAt: 1, weightKg: NaN, source: 'manual' },
    ];
    expect(dailyWeighIns(e).map((x) => x.id)).toEqual(['am']);
  });

  it('gap of 5+ days: interpolates without breaking the trend', () => {
    const r = computeTrend(entries([80, 80, 80, null, null, null, null, null, null, 79.3]));
    expect(r.points).toHaveLength(10);
    expect(r.points.slice(3, 9).every((p) => p.interpolated)).toBe(true);
    expect(r.outliers).toHaveLength(0);
    for (let i = 3; i < r.points.length; i++) {
      expect(r.points[i]!.trendKg).toBeLessThan(r.points[i - 1]!.trendKg);
    }
    // Interpolating keeps lag the same as weighing daily on a straight line.
    const daily = computeTrend(entries([80, 80, 80, 79.9, 79.8, 79.7, 79.6, 79.5, 79.4, 79.3]));
    expect(latestTrend(r)).toBeCloseTo(latestTrend(daily)!, 6);
  });

  it('carries forward after the last weigh-in, up to endDate', () => {
    const r = computeTrend(entries([80, 79.8]), { endDate: addDays(D0, 10) });
    expect(r.points).toHaveLength(11);
    expect(r.points[10]!.trendKg).toBe(r.points[1]!.trendKg);
  });

  it('wild outlier is flagged and left out until confirmed', () => {
    const vals = [80, 80.1, 79.9, 80, 95, 80.1, 80];
    const r = computeTrend(entries(vals));
    expect(r.outliers).toHaveLength(1);
    expect(r.outliers[0]).toMatchObject({ entryId: 'e4', weightKg: 95 });
    expect(r.outliers[0]!.deviation).toBeGreaterThan(0.15);
    expect(latestTrend(r)).toBeCloseTo(80, 0);
    expect(r.points.find((p) => p.date === addDays(D0, 4))!.weightKg).toBeNull();

    const confirmed = entries(vals).map((e) => (e.id === 'e4' ? { ...e, outlierStatus: 'confirmed' as const } : e));
    const r2 = computeTrend(confirmed);
    expect(r2.outliers).toHaveLength(0);
    expect(latestTrend(r2)!).toBeGreaterThan(latestTrend(r)! + 1);
  });

  it('a typo on the very first day does not poison the seed', () => {
    const r = computeTrend(entries([8.0, 80, 80.2, 80.1]));
    expect(r.outliers.map((o) => o.entryId)).toEqual(['e0']);
    expect(r.points[0]!.date).toBe(addDays(D0, 1));
    expect(latestTrend(r)).toBeCloseTo(80.1, 0);
  });

  it('after confirming a real jump, following weigh-ins are not re-flagged', () => {
    const vals = [80, 80, 80, 80, 82.5, 82.4, 82.6, 82.5];
    const e = entries(vals).map((x) => (x.id === 'e4' ? { ...x, outlierStatus: 'confirmed' as const } : x));
    expect(computeTrend(e).outliers).toHaveLength(0);
  });

  it('normal 1–1.5 % day-to-day noise is not flagged', () => {
    const r = computeTrend(entries([80, 80.9, 79.4, 80.6, 79.5, 80.8, 79.7]));
    expect(r.outliers).toHaveLength(0);
  });
});
