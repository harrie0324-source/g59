# Burnrate

Adaptive TDEE fitness app (Expo + TypeScript). See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

## Status: M1 — algorithm core

`src/core` is a pure TypeScript module (no React Native imports, enforced by a test):

| File | What it does |
|------|--------------|
| `bmr.ts` | Mifflin-St Jeor, activity multipliers, daily-adjust baseline multiplier |
| `trend.ts` | EMA trend weight, gap interpolation, outlier flags |
| `tdee.ts` | Rolling-window observed TDEE, data gates, blending, ±150 kcal cap |
| `targets.ts` | Calorie target, rate limits, macros, exercise credit |
| `safety.ts` | Age gate, calorie floors, rate limits |
| `checkin.ts` | Weekly check-in that ties it all together |
| `describe.ts` | Plain-language, neutral explanations |
| `insights.ts` | Activity-level suggestion, correlation helper |
| `activity/*` | MET table, net MET burn, step calories, Health/manual dedupe |
| `units.ts`, `dates.ts` | kg/lb, cm/ft-in, calendar math |

## Run

```bash
npm install
npm test              # all unit tests
npm test -- --coverage
npm run typecheck
npm run simulate      # 12-week synthetic user; optional args: <trueTdee> <noiseKg>
```
