import * as fs from 'fs';
import * as path from 'path';
import { runCheckIns, weeklyCheckIn } from '../checkin';
import { addDays } from '../dates';
import { describeCheckIn } from '../describe';
import { makeGoal, makeProfile, simulate, START, weekly } from '../__fixtures__/builders';

const BANNED = /over budget|overate|bad food|cheat|guilt|\bearn(ed)?\b|burn (it )?off|work it off|fail|streak|naughty|junk|punish|make up for/i;

function allScenarioLines(): string[] {
  const lines: string[] = [];
  const sim = simulate({ days: 90, trueTdee: 2500, intake: 2000, noiseKg: 0.4, seed: 3 });
  const profile = makeProfile();
  const results = runCheckIns(weekly(START, 11, 7), { profile, goals: [makeGoal({ rateKgPerWeek: 2 })], weights: sim.weights, dayLogs: sim.dayLogs });
  const extras = [
    weeklyCheckIn({ date: START, profile, goals: [], weights: [], dayLogs: [], previous: null }),
    weeklyCheckIn({ date: addDays(START, 30), profile: makeProfile({ birthDate: '2012-01-01' }), goals: [], weights: sim.weights, dayLogs: sim.dayLogs, previous: null }),
    weeklyCheckIn({ date: addDays(START, 30), profile: makeProfile({ pregnancyStatus: 'breastfeeding', formulaSex: 'female' }), goals: [makeGoal()], weights: sim.weights, dayLogs: sim.dayLogs.map((d, i) => (i === 25 ? { ...d, kcal: 0 } : d)), previous: null }),
  ];
  for (const r of [...results, ...extras]) {
    for (const unit of ['kg', 'lb'] as const) {
      lines.push(...describeCheckIn(r, { unit, formulaSex: 'male' }));
      lines.push(...describeCheckIn(r, { unit, formulaSex: 'female', hideCalories: true, hideWeight: true }));
    }
  }
  return lines;
}

describe('describeCheckIn', () => {
  const lines = allScenarioLines();

  it('produces explanations for every scenario', () => {
    expect(lines.length).toBeGreaterThan(50);
    expect(lines.some((l) => l.startsWith('Still learning'))).toBe(true);
    expect(lines.some((l) => /went (up|down) by ~\d+/.test(l))).toBe(true);
    expect(lines.some((l) => l.includes('safe limit'))).toBe(true);
    expect(lines.some((l) => l.includes('doctor'))).toBe(true);
    expect(lines.some((l) => l.includes('adults (18+)'))).toBe(true);
    expect(lines.some((l) => l.includes('no food logged'))).toBe(true);
  });

  it('uses neutral language only (no shame, no "earn/burn off", no exercise to compensate)', () => {
    for (const l of lines) expect(l).not.toMatch(BANNED);
  });

  it('hide-calories mode never shows kcal numbers', () => {
    const sim = simulate({ days: 60, trueTdee: 2500, intake: 2000 });
    const r = runCheckIns(weekly(START, 7, 14), { profile: makeProfile(), goals: [makeGoal()], weights: sim.weights, dayLogs: sim.dayLogs }).at(-1)!;
    const hidden = describeCheckIn(r, { unit: 'lb', formulaSex: 'male', hideCalories: true, hideWeight: true });
    expect(hidden.length).toBeGreaterThan(0);
    for (const l of hidden) expect(l).not.toMatch(/\d+\s*kcal|\d+(\.\d)? (lb|kg)/);
  });
});

describe('core purity', () => {
  it('src/core never imports React Native, Expo or app code', () => {
    const root = path.join(__dirname, '..');
    const files: string[] = [];
    const walk = (dir: string) => {
      for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, f.name);
        if (f.isDirectory()) walk(p);
        else if (p.endsWith('.ts') && !p.includes('__tests__')) files.push(p);
      }
    };
    walk(root);
    expect(files.length).toBeGreaterThan(10);
    for (const f of files) {
      const src = fs.readFileSync(f, 'utf8');
      const imports = [...src.matchAll(/from '([^']+)'/g)].map((m) => m[1]!);
      for (const i of imports) expect(i.startsWith('.')).toBe(true);
    }
  });
});
