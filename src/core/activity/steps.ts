import type { ActivityLog, ISODate, StepEntry } from '../types';
import { getActivityType } from './compendium';

// Step calories, scaled by body weight and height.
//   distance_km ≈ steps × stride, where stride ≈ 0.414 × height (common pedometer heuristic)
//   net walking cost ≈ 0.5 kcal per kg per km, from the ACSM walking equation
//     (horizontal VO2 0.1 mL/kg/m net of rest × ~5 kcal per L O2);
//     ACSM's Guidelines for Exercise Testing and Prescription, metabolic calculations.
//   ⇒ kcal ≈ steps × 0.414 × height_m × weight_kg × 0.0005
// Example: 10,000 steps, 175 cm, 70 kg ≈ 254 kcal (~0.025 kcal/step).

export const STRIDE_HEIGHT_RATIO = 0.414;
export const NET_KCAL_PER_KG_PER_KM = 0.5;
/** Above this, show "check this number" in the UI. The value is still counted. */
export const HIGH_STEP_WARNING = 50_000;
/** Sanity cap for calculations: almost certainly a sensor or entry error past this. */
export const MAX_STEPS_PER_DAY = 100_000;

export function stepKcal(p: { steps: number; heightCm: number; weightKg: number }): number {
  const steps = Math.min(Math.max(0, p.steps), MAX_STEPS_PER_DAY);
  const km = (steps * STRIDE_HEIGHT_RATIO * (p.heightCm / 100)) / 1000;
  return km * p.weightKg * NET_KCAL_PER_KG_PER_KM;
}

export function isUnusuallyHighSteps(steps: number): boolean {
  return steps > HIGH_STEP_WARNING;
}

/**
 * One step count per day. A manual entry overrides health data for that day
 * (the user corrected it). Otherwise use the highest health value: HealthKit and
 * Health Connect already merge phone + watch, so two health sources only happen
 * if the user switched platforms.
 */
export function resolveDailySteps(entries: StepEntry[]): Map<ISODate, number> {
  const manual = new Map<ISODate, number>();
  const health = new Map<ISODate, number>();
  for (const e of entries) {
    const target = e.source === 'manual' ? manual : health;
    target.set(e.localDate, Math.max(target.get(e.localDate) ?? 0, Math.max(0, e.steps)));
  }
  const out = new Map(health);
  for (const [date, steps] of manual) out.set(date, steps);
  return out;
}

/** Steps a step counter likely recorded during logged walking/running activities. */
export function stepsCoveredByActivities(logs: ActivityLog[]): number {
  let total = 0;
  for (const log of logs) {
    const cadence = getActivityType(log.activityCode)?.stepsPerMin?.[log.intensity];
    if (cadence) total += cadence * Math.max(0, log.durationMin);
  }
  return total;
}

/**
 * Step kcal for one day, without double counting logged walks and runs:
 * steps already covered by an activity log are removed first (floor 0).
 */
export function dailyStepKcal(p: {
  steps: number;
  dayActivities: ActivityLog[];
  heightCm: number;
  weightKg: number;
}): number {
  const remaining = Math.max(0, p.steps - stepsCoveredByActivities(p.dayActivities));
  return stepKcal({ steps: remaining, heightCm: p.heightCm, weightKg: p.weightKg });
}
