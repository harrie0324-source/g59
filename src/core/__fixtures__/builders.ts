// Test and simulation helpers. Pure TS, deterministic (seeded noise).
import { addDays } from '../dates';
import { DEFAULT_PROTEIN_G_PER_KG, KCAL_PER_KG } from '../targets';
import type { DayLog, Goal, ISODate, Profile, WeightEntry } from '../types';

export const START: ISODate = '2026-01-05'; // a Monday

export function makeProfile(overrides: Partial<Profile> = {}): Profile {
  return {
    formulaSex: 'male',
    birthDate: '1996-03-01', // 29 on START
    heightCm: 180,
    activityLevel: 'moderate',
    calorieMode: 'adaptive',
    exerciseCredit: 0.5,
    proteinGPerKg: DEFAULT_PROTEIN_G_PER_KG,
    fatMinGPerKg: 0.6,
    pregnancyStatus: 'none',
    ...overrides,
  };
}

export function makeGoal(overrides: Partial<Goal> = {}): Goal {
  return { id: 'g1', type: 'lose', rateKgPerWeek: 0.5, startDate: START, ...overrides };
}

/** Mulberry32: tiny seeded PRNG so "noisy" tests are reproducible. */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface SimOptions {
  start?: ISODate;
  days: number;
  startWeightKg?: number;
  /** The person's real expenditure (what the algorithm should discover). */
  trueTdee: number | ((day: number) => number);
  intake: number | ((day: number) => number);
  /** Uniform daily scale noise, ± this many kg. */
  noiseKg?: number;
  seed?: number;
  /** Return false to skip a weigh-in on that day. */
  weighIn?: (day: number) => boolean;
  /** Return false to leave a day not marked complete. */
  complete?: (day: number) => boolean;
}

export function simulate(o: SimOptions): { weights: WeightEntry[]; dayLogs: DayLog[]; trueWeights: number[] } {
  const start = o.start ?? START;
  const rand = rng(o.seed ?? 1);
  const at = <T>(v: T | ((d: number) => T), d: number): T => (typeof v === 'function' ? (v as (d: number) => T)(d) : v);
  let w = o.startWeightKg ?? 85;
  const weights: WeightEntry[] = [];
  const dayLogs: DayLog[] = [];
  const trueWeights: number[] = [];
  for (let d = 0; d < o.days; d++) {
    const date = addDays(start, d);
    trueWeights.push(w);
    const noise = ((rand() * 2) - 1) * (o.noiseKg ?? 0);
    if (o.weighIn?.(d) ?? true) {
      weights.push({
        id: `w${d}`,
        localDate: date,
        measuredAt: Date.parse(`${date}T07:00:00Z`),
        weightKg: w + noise,
        source: 'manual',
      });
    }
    const kcal = at(o.intake, d);
    dayLogs.push({ date, kcal, isComplete: o.complete?.(d) ?? true });
    w += (kcal - at(o.trueTdee, d)) / KCAL_PER_KG;
  }
  return { weights, dayLogs, trueWeights };
}

export function weekly(start: ISODate, count: number, offsetDays = 7): ISODate[] {
  return Array.from({ length: count }, (_, i) => addDays(start, offsetDays + i * 7));
}
