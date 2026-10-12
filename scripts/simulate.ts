// Manual sanity check: a synthetic user eats roughly their target for 12 weeks.
// Run: npm run simulate            (defaults)
//      npm run simulate -- 2300 0.4  (true TDEE, scale noise in kg)
import {
  addDays,
  describeCheckIn,
  KCAL_PER_KG,
  toAnchor,
  weeklyCheckIn,
  type CheckInAnchor,
  type DayLog,
  type WeightEntry,
} from '../src/core';
import { makeGoal, makeProfile, rng, START } from '../src/core/__fixtures__/builders';

const TRUE_TDEE = Number(process.argv[2] ?? 2500);
const NOISE_KG = Number(process.argv[3] ?? 0.5);
const WEEKS = 12;

const rand = rng(42);
const profile = makeProfile(); // male, 29, 180 cm, "moderate" → formula ~2,840 at 85 kg
const goals = [makeGoal({ type: 'lose', rateKgPerWeek: 0.5 })];
const weights: WeightEntry[] = [];
const dayLogs: DayLog[] = [];

let trueWeight = 85;
let anchor: CheckInAnchor | null = null;
let target = 0;

const pad = (s: string | number, n: number) => String(s).padStart(n);
console.log(`True TDEE ${TRUE_TDEE} kcal · scale noise ±${NOISE_KG} kg · weigh-in ~5/7 days · ~85 % days fully logged\n`);
console.log(`${pad('week', 4)} ${pad('status', 9)} ${pad('conf', 8)} ${pad('TDEE', 6)} ${pad('obs', 6)} ${pad('target', 7)} ${pad('trend', 6)} ${pad('true', 6)}`);

for (let day = 0; day <= WEEKS * 7; day++) {
  const date = addDays(START, day);
  if (day % 7 === 0) {
    const r = weeklyCheckIn({ date, profile, goals, weights, dayLogs, previous: anchor });
    anchor = toAnchor(r) ?? anchor;
    target = r.targets?.calories ?? 2000;
    console.log(
      `${pad(day / 7, 4)} ${pad(r.status, 9)} ${pad(r.confidence, 8)} ${pad(r.tdee ? Math.round(r.tdee) : '-', 6)} ${pad(r.observedTdee ? Math.round(r.observedTdee) : '-', 6)} ${pad(target, 7)} ${pad(r.trendKg?.toFixed(1) ?? '-', 6)} ${pad(trueWeight.toFixed(1), 6)}`,
    );
    if (day / 7 === 3 || day / 7 === WEEKS) {
      for (const line of describeCheckIn(r, { unit: 'kg', formulaSex: 'male' })) console.log(`       · ${line}`);
    }
  }
  if (day === WEEKS * 7) break;

  if (rand() < 5 / 7) {
    weights.push({ id: `w${day}`, localDate: date, measuredAt: day, weightKg: trueWeight + (rand() * 2 - 1) * NOISE_KG, source: 'manual' });
  }
  const intake = target + (rand() * 2 - 1) * 250;
  dayLogs.push({ date, kcal: intake, isComplete: rand() < 0.85 });
  trueWeight += (intake - TRUE_TDEE) / KCAL_PER_KG;
}
