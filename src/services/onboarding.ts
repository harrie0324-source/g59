import {
  addDays,
  ageOn,
  describeCheckIn,
  DEFAULT_PROTEIN_G_PER_KG,
  formatRate,
  ftInToCm,
  lbToKg,
  maxRateKgPerWeek,
  weeklyCheckIn,
  type ActivityLevel,
  type CheckInResult,
  type FormulaSex,
  type GoalType,
  type PregnancyStatus,
  type WeightUnit,
} from '@/core';
import { saveCheckIn } from '@/db/repos/checkIns';
import { startGoal } from '@/db/repos/goals';
import { createProfile, type ProfileInput } from '@/db/repos/profile';
import { addWeight } from '@/db/repos/weights';
import type { DB } from '@/db/types';
import { formatKcal } from '@/lib/format';

export type UnitSystem = 'us' | 'metric';

export interface OnboardingDraft {
  disclaimerAccepted: boolean;
  units: UnitSystem;
  formulaSex: FormulaSex | null;
  dobMonth: string;
  dobDay: string;
  dobYear: string;
  heightFt: string;
  heightIn: string;
  heightCm: string;
  weight: string;
  pregnancyStatus: PregnancyStatus;
  activityLevel: ActivityLevel | null;
  goalType: GoalType | null;
  rateKgPerWeek: number | null;
}

export const emptyDraft: OnboardingDraft = {
  disclaimerAccepted: false,
  units: 'us',
  formulaSex: null,
  dobMonth: '',
  dobDay: '',
  dobYear: '',
  heightFt: '',
  heightIn: '',
  heightCm: '',
  weight: '',
  pregnancyStatus: 'none',
  activityLevel: null,
  goalType: null,
  rateKgPerWeek: null,
};

export const MIN_APP_AGE = 13;
const HEIGHT_CM = [120, 230] as const;
const WEIGHT_KG = [30, 300] as const;

export const weightUnitOf = (u: UnitSystem): WeightUnit => (u === 'us' ? 'lb' : 'kg');

/** Accepts "180", "180.5" and "180,5". Returns NaN for anything else. */
export function parseNumber(s: string): number {
  const t = s.trim().replace(',', '.');
  return /^\d+(\.\d+)?$/.test(t) ? Number(t) : NaN;
}

export type AboutField = 'formulaSex' | 'dob' | 'height' | 'weight';
export type AboutResult =
  | { ok: true; birthDate: string; age: number; heightCm: number; weightKg: number }
  | { ok: false; errors: Partial<Record<AboutField, string>> };

export function parseAbout(d: OnboardingDraft, today: string): AboutResult {
  const errors: Partial<Record<AboutField, string>> = {};
  if (!d.formulaSex) errors.formulaSex = 'Choose one to continue.';

  const [y, m, day] = [parseNumber(d.dobYear), parseNumber(d.dobMonth), parseNumber(d.dobDay)];
  const birthDate = `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  const ms = Date.parse(`${birthDate}T00:00:00Z`);
  const valid =
    Number.isInteger(y) && Number.isInteger(m) && Number.isInteger(day) && y >= 1900 &&
    !Number.isNaN(ms) && new Date(ms).toISOString().slice(0, 10) === birthDate && // rejects Feb 30 etc.
    birthDate <= today;
  let age = NaN;
  if (!valid) errors.dob = 'Enter a valid date of birth.';
  else {
    age = ageOn(birthDate, today);
    if (age < MIN_APP_AGE) errors.dob = `Burnrate is for people ${MIN_APP_AGE} and older.`;
    else if (age > 110) errors.dob = 'Enter a valid date of birth.';
  }

  const heightCm =
    d.units === 'us' ? ftInToCm(parseNumber(d.heightFt), d.heightIn.trim() ? parseNumber(d.heightIn) : 0) : parseNumber(d.heightCm);
  if (!(heightCm >= HEIGHT_CM[0] && heightCm <= HEIGHT_CM[1])) errors.height = 'Enter a height between 4 ft and 7 ft 6 in (120–230 cm).';

  const w = parseNumber(d.weight);
  const weightKg = d.units === 'us' ? lbToKg(w) : w;
  if (!(weightKg >= WEIGHT_KG[0] && weightKg <= WEIGHT_KG[1])) errors.weight = 'Enter a weight between 66 and 660 lb (30–300 kg).';

  return Object.keys(errors).length ? { ok: false, errors } : { ok: true, birthDate, age, heightCm, weightKg };
}

const RATE_STEPS: Record<UnitSystem, Record<'lose' | 'gain', number[]>> = {
  us: { lose: [0.5, 1, 1.5, 2].map(lbToKg), gain: [0.25, 0.5, 0.75].map(lbToKg) },
  metric: { lose: [0.25, 0.5, 0.75, 1], gain: [0.1, 0.25, 0.4] },
};

/** Pace choices within the safe limits (loss ≤ 1 %/week, gain ≤ 0.5 %/week). Faster paces are never offered. */
export function rateOptions(type: GoalType, weightKg: number, units: UnitSystem): { kgPerWeek: number; label: string }[] {
  if (type === 'maintain') return [];
  const max = maxRateKgPerWeek(type, weightKg) + 1e-9;
  const allowed = RATE_STEPS[units][type].filter((r) => r <= max);
  // Very light users may fall below the smallest step: offer the limit itself.
  const list = allowed.length ? allowed : [maxRateKgPerWeek(type, weightKg)];
  return list.map((kgPerWeek) => ({ kgPerWeek, label: formatRate(kgPerWeek, weightUnitOf(units)) }));
}

export function defaultRate(type: GoalType, weightKg: number, units: UnitSystem): number | null {
  const opts = rateOptions(type, weightKg, units);
  return (opts[1] ?? opts[0])?.kgPerWeek ?? null;
}

export interface Plan {
  profile: ProfileInput;
  goal: { type: GoalType; rateKgPerWeek: number; startDate: string };
  weightKg: number;
  age: number;
  preview: CheckInResult;
}

export function buildPlan(d: OnboardingDraft, today: string): Plan | null {
  const about = parseAbout(d, today);
  if (!about.ok || !d.activityLevel || !d.goalType || !d.formulaSex) return null;
  const goalType: GoalType = d.pregnancyStatus !== 'none' && d.goalType === 'lose' ? 'maintain' : d.goalType;
  const goal = {
    type: goalType,
    rateKgPerWeek: goalType === 'maintain' ? 0 : d.rateKgPerWeek ?? defaultRate(goalType, about.weightKg, d.units) ?? 0,
    startDate: today,
  };
  const profile: ProfileInput = {
    formulaSex: d.formulaSex,
    birthDate: about.birthDate,
    heightCm: about.heightCm,
    activityLevel: d.activityLevel,
    weightUnit: weightUnitOf(d.units),
    heightUnit: d.units === 'us' ? 'ftin' : 'cm',
    proteinGPerKg: DEFAULT_PROTEIN_G_PER_KG,
    pregnancyStatus: d.pregnancyStatus,
    disclaimerAcceptedAt: d.disclaimerAccepted ? Date.now() : null,
  };
  // The check-in uses data through the day before its date, so preview "as of tomorrow"
  // to include today's starting weight.
  const preview = weeklyCheckIn({
    date: addDays(today, 1),
    profile: {
      formulaSex: d.formulaSex,
      birthDate: about.birthDate,
      heightCm: about.heightCm,
      activityLevel: d.activityLevel,
      calorieMode: 'adaptive',
      exerciseCredit: 0.5,
      proteinGPerKg: DEFAULT_PROTEIN_G_PER_KG,
      fatMinGPerKg: 0.6,
      pregnancyStatus: d.pregnancyStatus,
    },
    goals: [{ id: 'onboarding', ...goal }],
    weights: [{ id: 'start', localDate: today, measuredAt: 0, weightKg: about.weightKg, source: 'manual' }],
    dayLogs: [],
    previous: null,
  });
  return { profile, goal, weightKg: about.weightKg, age: about.age, preview };
}

/** The one-sentence explanation at the end of onboarding, plus any safety notes. */
export function planSummary(plan: Plan, units: UnitSystem): { sentence: string; notes: string[] } {
  const t = plan.preview.targets;
  const burn = formatKcal(Math.round((plan.preview.tdee ?? 0) / 10) * 10);
  if (!t) {
    return {
      sentence: 'Calorie targets are for adults, so for now Burnrate will help you log food, weight and activity without a target.',
      notes: [],
    };
  }
  const pace = formatRate(t.rateKgPerWeek, weightUnitOf(units)).replace('/week', ' a week');
  const target = formatKcal(t.calories);
  const action =
    t.goalType === 'maintain'
      ? `eating about ${target} kcal a day should keep your weight steady`
      : `about ${target} kcal a day should move you toward ${t.goalType === 'lose' ? 'losing' : 'gaining'} ~${pace}`;
  const sentence = `You likely burn ~${burn} kcal a day, so ${action} — and Burnrate will fine-tune this from your real data over the next few weeks.`;
  const notes = describeCheckIn(plan.preview, { unit: weightUnitOf(units), formulaSex: plan.profile.formulaSex }).filter(
    (l) => /lowest we support|safe limit|doctor/.test(l),
  );
  return { sentence, notes };
}

/** Saves profile, goal, starting weight and the first (formula) check-in in one transaction. */
export function completeOnboarding(db: DB, plan: Plan, today: string, now = Date.now()): void {
  db.transaction((tx) => {
    createProfile(tx, { ...plan.profile, disclaimerAcceptedAt: plan.profile.disclaimerAcceptedAt ?? now }, now);
    const goalId = startGoal(tx, plan.goal, now);
    addWeight(tx, { weightKg: plan.weightKg, localDate: today, measuredAt: now, source: 'manual' }, now);
    saveCheckIn(tx, today, plan.preview, { goalId, seen: true }, now);
  });
}
