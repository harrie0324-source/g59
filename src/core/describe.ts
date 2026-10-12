import type { CheckInResult } from './checkin';
import { calorieFloor } from './safety';
import { formatRate, formatWeight } from './units';
import type { FormulaSex, WeightUnit } from './types';

// Plain-language explanations for the weekly check-in.
// Copy rules: neutral, no judgement, no "over/under budget", no "earn" or "burn off",
// never suggest extra exercise. Burn numbers are always shown as "~".

export interface DescribeOptions {
  unit: WeightUnit;
  formulaSex: FormulaSex;
  hideCalories?: boolean;
  hideWeight?: boolean;
}

const kcal = (n: number) => `~${(Math.round(n / 10) * 10).toLocaleString('en-US')} kcal/day`;

export function describeCheckIn(r: CheckInResult, o: DescribeOptions): string[] {
  const lines: string[] = [];
  const tdee = r.tdee ?? 0;
  const burn = o.hideCalories ? 'your estimated burn' : kcal(tdee);
  const has = (code: CheckInResult['reasons'][number]) => r.reasons.includes(code);

  if (has('no_weight_data')) return ['Add a weigh-in to get started.'];
  if (has('under_18')) {
    lines.push('Calorie targets are only available for adults (18+). You can still log food, weight and activity.');
  }

  if (r.status === 'learning') {
    lines.push(`Still learning. For now we're using a formula estimate of ${burn}.`);
    const parts: string[] = [];
    if (r.needed.completeDays > 0) parts.push(`${r.needed.completeDays} more fully logged ${plural(r.needed.completeDays, 'day')}`);
    if (r.needed.weighIns > 0) parts.push(`${r.needed.weighIns} more ${plural(r.needed.weighIns, 'weigh-in')}`);
    if (parts.length) lines.push(`After ${parts.join(' and ')}, your estimate will come from your own data.`);
  } else if (r.status === 'holding') {
    lines.push(`There wasn't enough logged data this week to update, so your estimate stays at ${burn}. That's fine — it updates whenever there's enough.`);
  } else {
    const delta = Math.round(((r.tdee ?? 0) - (r.previousTdee ?? r.formulaTdee ?? 0)) / 10) * 10;
    if (has('tdee_steady')) lines.push(`Your estimated burn is about the same: ${burn}.`);
    else if (o.hideCalories) lines.push(`Your estimated burn went ${delta > 0 ? 'up' : 'down'} a little based on your recent data.`);
    else lines.push(`Your estimated burn went ${delta > 0 ? 'up' : 'down'} by ~${Math.abs(delta)} to ${burn}.`);

    const s = r.stats;
    if (s && s.deltaTrendKg !== null && s.avgIntake !== null && !o.hideCalories && !o.hideWeight) {
      const dir = s.deltaTrendKg >= 0 ? 'up' : 'down';
      lines.push(
        `Over the last ${s.days} days your trend weight moved ${dir} ${formatWeight(Math.abs(s.deltaTrendKg), o.unit)} while you averaged ~${Math.round(s.avgIntake).toLocaleString('en-US')} kcal on fully logged days.`,
      );
    }
    if (has('change_capped')) lines.push('We adjust gradually (at most 150 kcal per week), so it may keep moving next week.');
  }

  if (has('goal_change_settling')) {
    lines.push("You changed your goal recently. Water and glycogen shift in the first week, so we're leaving those days out.");
  }
  if (has('zero_kcal_days_ignored')) {
    lines.push('A day marked complete had no food logged, so we left it out. You can edit it any time.');
  }
  if (has('outliers_pending')) {
    lines.push("One weigh-in looks unusual. Confirm or remove it and we'll include it if it's right.");
  }

  const t = r.targets;
  if (t) {
    if (!o.hideCalories) {
      lines.push(`Your daily target: ${t.calories.toLocaleString('en-US')} kcal · ${t.proteinG} g protein · ${t.fatG} g fat · ${t.carbsG} g carbs.`);
    }
    if (t.reasons.includes('pregnancy_no_deficit')) {
      lines.push("Because you're pregnant or breastfeeding, targets are set to maintenance. Please talk with your doctor about what's right for you.");
    }
    if (t.reasons.includes('rate_clamped')) {
      lines.push(`Your chosen pace was faster than our safe limit, so we're using ${formatRate(t.rateKgPerWeek, o.unit)}.`);
    }
    if (t.reasons.includes('floor_applied')) {
      const floor = calorieFloor(o.formulaSex).toLocaleString('en-US');
      lines.push(
        o.hideCalories
          ? "Your target is set to the lowest level we support. A doctor or registered dietitian can help if you need a different plan."
          : `Your target is set to ${floor} kcal, the lowest we support. A doctor or registered dietitian can help if you need a different plan.`,
      );
    }
  }
  return lines;
}

function plural(n: number, word: string): string {
  return n === 1 ? word : `${word}s`;
}
