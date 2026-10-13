# Burnrate

Adaptive TDEE fitness app (Expo SDK 57 + TypeScript). See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

## Status: M3 — food logging

- **M1:** `src/core` algorithm (pure TypeScript, fully unit-tested)
- **M2:** onboarding with safety gates, Today dashboard, quick-add food, weight logging with outlier prompts, "fully logged" days, weekly check-ins, settings (units, hide numbers, erase data). Everything is stored locally in SQLite and works offline.
- **M3:** food search (USDA via a Supabase Edge Function), barcode scanning (Open Food Facts, then USDA), serving picker with grams, recents and one-tap re-logging, favorites, custom foods, copy yesterday's meal. Logged foods work offline.

**Set up food search:** see [`docs/SUPABASE_SETUP.md`](docs/SUPABASE_SETUP.md). Without it, everything else still works, and search shows a "not set up yet" note.

## Run it on your phone

1. Install **Expo Go** (it must support SDK 57) on your iPhone or Android phone.
2. On your computer (Node 20+):
   ```bash
   npm install
   npx expo start
   ```
3. Scan the QR code: Camera app on iPhone, Expo Go on Android. Phone and computer must be on the same Wi-Fi network (or use `npx expo start --tunnel`).

## Checks

```bash
npm test              # unit + database tests (in-memory SQLite with the real migrations)
npm run typecheck
npm run lint
npm run simulate      # 12-week synthetic user through the algorithm
```

## Changing the database

Edit `src/db/schema.ts`, then run `npm run db:generate`. It writes a new migration to `drizzle/`, and the app applies it on next launch.

## Layout

| Path | What |
|------|------|
| `src/core/` | TDEE algorithm. Pure TS, no React Native imports (lint + test enforced) |
| `src/db/` | Drizzle schema, repositories, mappers. `client.ts` is the app DB |
| `src/services/` | Onboarding, check-ins, Today model: logic that uses the DB, tested in Node |
| `src/app/` | Expo Router screens |
| `src/ui/` | Theme tokens (light/dark) and accessible primitives |
| `src/stores/` | Zustand (UI state only, never DB copies) |
| `drizzle/` | Generated SQL migrations |
| `supabase/functions/` | Edge Functions (Deno). `food-search` proxies USDA |
