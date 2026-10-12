import { exerciseKcalByDate } from './activity/met';
import { dedupeActivities } from './activity/dedupe';
import { formulaTdee } from './bmr';
import { addDays, ageOn } from './dates';
import { canReceiveTargets } from './safety';
import { computeTargets, type DailyTargets, type TargetReason } from './targets';
import {
  blendTdee,
  confidenceLevel,
  DEFAULT_WINDOW_DAYS,
  MAX_WEEKLY_CHANGE_KCAL,
  MIN_COMPLETE_DAYS,
  MIN_WEIGH_INS,
  settleStart,
  windowStats,
  type ConfidenceLevel,
  type WindowStats,
} from './tdee';
import { computeTrend, trendOn } from './trend';
import type { ActivityLog, DayLog, Goal, ISODate, Profile, WeightEntry } from './types';

export type CheckInStatus = 'learning' | 'adaptive' | 'holding';

export type CheckInReason =
  | TargetReason
  | 'no_weight_data'
  | 'under_18'
  | 'still_learning'
  | 'holding_previous'
  | 'not_enough_logged_days'
  | 'not_enough_weigh_ins'
  | 'goal_change_settling'
  | 'zero_kcal_days_ignored'
  | 'outliers_pending'
  | 'tdee_up'
  | 'tdee_down'
  | 'tdee_steady'
  | 'change_capped';

/** What a stored check-in carries forward to the next one. */
export interface CheckInAnchor {
  status: CheckInStatus;
  /** Total TDEE (adaptive mode). */
  tdee: number;
  /** TDEE without logged exercise (daily-adjust mode). */
  baselineTdee: number;
}

export interface CheckInOptions {
  windowDays?: number;
  alpha?: number;
  maxWeeklyChange?: number;
}

export interface CheckInInput {
  /** The check-in day. Uses data through the day before (today isn't finished). */
  date: ISODate;
  profile: Profile;
  goals: Goal[];
  weights: WeightEntry[];
  dayLogs: DayLog[];
  activityLogs?: ActivityLog[];
  previous: CheckInAnchor | null;
  options?: CheckInOptions;
}

export interface CheckInResult {
  date: ISODate;
  dataThrough: ISODate;
  status: CheckInStatus;
  previousTdee: number | null;
  tdee: number | null;
  baselineTdee: number | null;
  /** Formula estimate for today. Free tier can base targets on this. */
  formulaTdee: number | null;
  observedTdee: number | null;
  observedBaselineTdee: number | null;
  confidence: ConfidenceLevel;
  stats: WindowStats | null;
  trendKg: number | null;
  /** Base targets for the active mode (daily-adjust adds exercise per day via withExerciseCredit). */
  targets: DailyTargets | null;
  /** Ordered: the most important explanation comes first. */
  reasons: CheckInReason[];
  /** Days still needed before adapting (0 once met). */
  needed: { completeDays: number; weighIns: number };
}

const STEADY_KCAL = 25;

export function activeGoal(goals: Goal[], date: ISODate): Goal | undefined {
  return goals
    .filter((g) => g.startDate <= date)
    .sort((a, b) => (a.startDate < b.startDate ? -1 : 1))
    .at(-1);
}

export function weeklyCheckIn(input: CheckInInput): CheckInResult {
  const { profile, date } = input;
  const opts = input.options ?? {};
  const windowDays = opts.windowDays ?? DEFAULT_WINDOW_DAYS;
  const maxChange = opts.maxWeeklyChange ?? MAX_WEEKLY_CHANGE_KCAL;
  const end = addDays(date, -1);

  const weights = input.weights.filter((w) => w.localDate <= end);
  const trend = computeTrend(weights, { alpha: opts.alpha, endDate: end });
  const trendKg = trendOn(trend, end);

  const base: CheckInResult = {
    date,
    dataThrough: end,
    status: 'learning',
    previousTdee: input.previous?.tdee ?? null,
    tdee: null,
    baselineTdee: null,
    formulaTdee: null,
    observedTdee: null,
    observedBaselineTdee: null,
    confidence: 'learning',
    stats: null,
    trendKg: trendKg ?? null,
    targets: null,
    reasons: [],
    needed: { completeDays: MIN_COMPLETE_DAYS, weighIns: MIN_WEIGH_INS },
  };
  if (trendKg === undefined) return { ...base, reasons: ['no_weight_data'] };

  const age = ageOn(profile.birthDate, date);
  const formulaArgs = { sex: profile.formulaSex, weightKg: trendKg, heightCm: profile.heightCm, age, activityLevel: profile.activityLevel };
  const formulaTotal = formulaTdee({ ...formulaArgs, mode: 'adaptive' });
  const formulaBaseline = formulaTdee({ ...formulaArgs, mode: 'daily_adjust' });

  const activities = dedupeActivities((input.activityLogs ?? []).filter((a) => a.localDate <= end)).kept;
  const stats = windowStats({
    end,
    dayLogs: input.dayLogs,
    trend,
    goals: input.goals,
    exerciseKcalByDate: exerciseKcalByDate(activities, trendKg),
    windowDays,
  });

  const reasons: CheckInReason[] = [];
  let status: CheckInStatus;
  let tdee: number;
  let baselineTdee: number;
  let observedBaselineTdee: number | null = null;
  const prev = input.previous;
  const hasAdapted = prev !== null && prev.status !== 'learning';

  if (stats.observedTdee !== null) {
    status = 'adaptive';
    observedBaselineTdee = stats.observedTdee - stats.avgExerciseKcal;
    const prevTotal = hasAdapted ? prev.tdee : formulaTotal;
    const prevBaseline = hasAdapted ? prev.baselineTdee : formulaBaseline;
    const total = blendTdee(prevTotal, stats.observedTdee, stats.quality, maxChange);
    const baseline = blendTdee(prevBaseline, observedBaselineTdee, stats.quality, maxChange);
    tdee = total.value;
    baselineTdee = baseline.value;

    const [before, after, capped] =
      profile.calorieMode === 'adaptive'
        ? [prevTotal, tdee, total.capped]
        : [prevBaseline, baselineTdee, baseline.capped];
    const change = after - before;
    reasons.push(Math.abs(change) < STEADY_KCAL ? 'tdee_steady' : change > 0 ? 'tdee_up' : 'tdee_down');
    if (capped) reasons.push('change_capped');
  } else {
    if (hasAdapted) {
      status = 'holding';
      tdee = prev.tdee;
      baselineTdee = prev.baselineTdee;
      reasons.push('holding_previous');
    } else {
      status = 'learning';
      tdee = formulaTotal;
      baselineTdee = formulaBaseline;
      reasons.push('still_learning');
    }
    const settle = settleStart(input.goals, end);
    if (settle && settle > addDays(end, -(windowDays - 1))) reasons.push('goal_change_settling');
    if (stats.completeDays < MIN_COMPLETE_DAYS) reasons.push('not_enough_logged_days');
    if (stats.weighIns < MIN_WEIGH_INS) reasons.push('not_enough_weigh_ins');
  }

  if (stats.zeroKcalDaysIgnored > 0) reasons.push('zero_kcal_days_ignored');
  if (trend.outliers.some((o) => o.date >= stats.start && o.date <= end)) reasons.push('outliers_pending');

  let targets: DailyTargets | null = null;
  if (!canReceiveTargets(age)) {
    reasons.unshift('under_18');
  } else {
    const goal = activeGoal(input.goals, date) ?? { type: 'maintain' as const, rateKgPerWeek: 0 };
    targets = computeTargets({
      tdee: profile.calorieMode === 'adaptive' ? tdee : baselineTdee,
      goal,
      weightKg: trendKg,
      profile,
    });
    reasons.push(...targets.reasons);
  }

  return {
    ...base,
    status,
    tdee,
    baselineTdee,
    formulaTdee: formulaTotal,
    observedTdee: stats.observedTdee,
    observedBaselineTdee,
    confidence: confidenceLevel(stats.meetsMinimum, stats.quality),
    stats,
    targets,
    reasons,
    needed: {
      completeDays: Math.max(0, MIN_COMPLETE_DAYS - stats.completeDays),
      weighIns: Math.max(0, MIN_WEIGH_INS - stats.weighIns),
    },
  };
}

export function toAnchor(r: CheckInResult): CheckInAnchor | null {
  if (r.tdee === null || r.baselineTdee === null) return null;
  return { status: r.status, tdee: r.tdee, baselineTdee: r.baselineTdee };
}

/**
 * Runs consecutive weekly check-ins (e.g. catching up after the app wasn't opened),
 * feeding each result into the next one.
 */
export function runCheckIns(
  dates: ISODate[],
  input: Omit<CheckInInput, 'date' | 'previous'>,
  previous: CheckInAnchor | null = null,
): CheckInResult[] {
  const out: CheckInResult[] = [];
  let anchor = previous;
  for (const date of dates) {
    const r = weeklyCheckIn({ ...input, date, previous: anchor });
    out.push(r);
    anchor = toAnchor(r) ?? anchor;
  }
  return out;
}
