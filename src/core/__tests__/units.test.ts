import { computeTrend } from '../trend';
import { cmToFtIn, formatRate, formatWeight, fromKg, ftInToCm, kgToLb, lbToKg, toKg } from '../units';
import type { WeightEntry } from '../types';

describe('units', () => {
  it('converts lb and kg exactly', () => {
    expect(lbToKg(1)).toBe(0.45359237);
    expect(lbToKg(180)).toBeCloseTo(81.6466, 4);
    expect(kgToLb(100)).toBeCloseTo(220.4623, 4);
  });

  it('round-trips without drift', () => {
    for (const lb of [99.9, 150, 180.4, 312.6]) {
      expect(kgToLb(lbToKg(lb))).toBeCloseTo(lb, 10);
      expect(fromKg(toKg(lb, 'lb'), 'lb')).toBeCloseTo(lb, 10);
    }
    expect(toKg(80, 'kg')).toBe(80);
  });

  it('converts height', () => {
    expect(ftInToCm(5, 11)).toBeCloseTo(180.34, 2);
    expect(cmToFtIn(180)).toEqual({ feet: 5, inches: 11 });
    expect(cmToFtIn(182.88)).toEqual({ feet: 6, inches: 0 });
  });

  it('formats for display only', () => {
    expect(formatWeight(lbToKg(180.4), 'lb')).toBe('180.4 lb');
    expect(formatWeight(81.65, 'kg')).toBe('81.7 kg');
    expect(formatRate(0.5, 'lb')).toBe('1.1 lb/week');
  });

  it('switching units mid-history does not change the trend (stored in kg)', () => {
    const kgEntries: WeightEntry[] = [80, 79.8, 79.9, 79.6, 79.5].map((kg, i) => ({
      id: `${i}`,
      localDate: `2026-01-0${i + 1}`,
      measuredAt: i,
      weightKg: kg,
      source: 'manual',
    }));
    // Same weights, but the user typed the last three in lb (rounded to 0.1 lb as the UI would).
    const mixed = kgEntries.map((e, i) =>
      i < 2 ? e : { ...e, weightKg: toKg(Math.round(kgToLb(e.weightKg) * 10) / 10, 'lb') },
    );
    const a = computeTrend(kgEntries).points.map((p) => p.trendKg);
    const b = computeTrend(mixed).points.map((p) => p.trendKg);
    a.forEach((v, i) => expect(b[i]).toBeCloseTo(v, 1));
  });
});
