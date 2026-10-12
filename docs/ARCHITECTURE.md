# Burnrate — Architecture

Status: draft v1 (step 2). Decisions marked **[D]**, assumptions marked **[A]**.

## 0. Decisions from the clarifying round

| # | Question | Answer | Consequence |
|---|----------|--------|-------------|
| 1 | Account required? | No — local first, account optional | Local rows carry no `user_id`; the server stamps it on push. No "claim data" migration. |
| 2 | Market | US only | USDA is the primary search source, Open Food Facts for barcodes. Supabase region `us-east-1`. Imperial units default. |
| 3 | Multi-device | Yes | Per-row LWW + soft deletes + deterministic IDs for "one per day/week/sample" rows. Logs are effectively append-only. |
| 4 | V2 priorities | Unsure → **[D]** design for coach sharing (cheap now), skip AI photo infra | All RLS goes through one `can_read(owner)` SQL function. Coach grants later = change one function + add one table. |
| 5 | Build setup | Unsure → **[D]** EAS Build, no Mac needed | M1–M5 run in Expo Go. Dev build only needed in M6 (HealthKit, Health Connect, RevenueCat, SQLCipher). Apple Developer ($99/yr) + Google Play ($25 once) needed by M6. |
| — | Free vs premium | Free users see the adaptive TDEE *estimate*; premium auto-applies it to targets | See §6. |
| — | Trial | 14 days | **[D]** Offered when the first adaptive estimate is ready (see §6 for why). |
| — | Step/walk overlap | Approved | Steps "inside" logged walking/running activities are subtracted before step calories are computed. |
| — | Non-binary sex input | Approved | `formula_sex`: male / female / average. Average uses the mean of both Mifflin results and the **1,500 kcal** floor. |

## 1. Architecture overview

```
┌──────────────────────────── App (Expo, one codebase) ────────────────────────────┐
│  app/ (Expo Router screens — thin, layout + navigation only)                     │
│        │                                                                         │
│  src/features/*  hooks + components per feature (food, weight, activity, …)      │
│        │                         │                         │                     │
│  src/core  (PURE TS)      src/db (SQLite = source       src/services             │
│  TDEE, trend, targets,    of truth, Drizzle ORM,        health / food-api /      │
│  activity, safety,        live queries)                 purchases / notifications│
│  units. No RN imports.          │                                                │
│                           src/sync (push dirty rows, pull by server cursor)      │
└─────────────────────────────────┼────────────────────────────────────────────────┘
                                  │ HTTPS (TLS)
                    ┌─────────────▼──────────────┐      ┌──────────────────────┐
                    │ Supabase                   │      │ USDA FoodData Central│
                    │ Postgres + RLS + Auth      │◀────▶│ (via Edge Function,  │
                    │ Edge Fns: food-search,     │      │  key hidden, cached) │
                    │           delete-account   │      └──────────────────────┘
                    └────────────────────────────┘      Open Food Facts: called
                    RevenueCat (entitlements)            directly from the app
```

Key choices, each one line:

- **SQLite is the source of truth on device [D].** Every screen reads from SQLite. The network is only for sync, food search and purchases, so offline works without special cases.
- **Drizzle ORM on expo-sqlite [D].** Typed schema, generated migrations, and `useLiveQuery` re-renders screens when rows change. That makes a separate cache layer unnecessary.
- **Zustand only for UI/session state [D]:** onboarding draft, selected date, sync status. It never holds copies of DB rows, so there's one place data lives.
- **React Query only for remote data:** food search results, RevenueCat offerings, account info.
- **Algorithm runs on device [D].** It's deterministic from synced data, so every device computes the same numbers. Only the *accepted* weekly check-ins are synced, because they anchor the TDEE chain (see §4).
- **Charts: `victory-native` (v41+, Skia-based) [D].** One library covers line, bar and area charts with press-to-inspect. It renders on the GPU, so a 90-day trend with two series stays smooth. It's actively maintained and TypeScript-first, and Skia ships in Expo Go. Runner-up: `react-native-gifted-charts` (simpler, SVG, slower with big datasets).
- **Health: one `HealthProvider` interface** with two adapters: `@kingstinct/react-native-healthkit` and `react-native-health-connect`. Manual entry uses the same tables with `source = 'manual'`.
- **Food search goes through a Supabase Edge Function [D].** It hides the USDA API key, normalizes results to one `FoodDTO` shape and caches popular queries. Open Food Facts needs no key, so barcode lookups go direct. **[A]** OFF data is ODbL: we show "Data from Open Food Facts" attribution on barcode results.
- **Rule enforcement:** an ESLint `no-restricted-imports` rule blocks `react-native`/`expo*` imports inside `src/core`, which keeps it pure and testable.

## 2. Folder structure

```
burnrate/
├─ app/                         # Expo Router (screens only)
│  ├─ _layout.tsx               # providers: theme, DB, query client, sync
│  ├─ (onboarding)/             # units → sex → age → height → weight → activity → goal → result
│  ├─ (tabs)/
│  │  ├─ index.tsx              # Today (dashboard + activity check-in card)
│  │  ├─ trends.tsx
│  │  ├─ activity.tsx
│  │  └─ settings.tsx
│  ├─ food/search.tsx  food/scan.tsx  food/[id].tsx  food/quick-add.tsx  food/custom.tsx
│  ├─ weight/add.tsx
│  ├─ activity/check-in.tsx  activity/workout/[id].tsx
│  ├─ check-in/[week].tsx       # weekly check-in
│  └─ paywall.tsx
├─ src/
│  ├─ core/                     # M1 — pure TypeScript, zero UI imports
│  │  ├─ types.ts  units.ts  dates.ts
│  │  ├─ bmr.ts                 # Mifflin-St Jeor + activity multipliers
│  │  ├─ trend.ts               # EMA, gap handling, outlier flags
│  │  ├─ tdee.ts                # observed TDEE, blending, caps, data gates
│  │  ├─ targets.ts             # calories, rate limits, macros
│  │  ├─ safety.ts              # age gate, floors, pregnancy
│  │  ├─ activity/              # steps.ts, met.ts, dedupe.ts, compendium.ts
│  │  ├─ checkin.ts             # weekly recompute → reason codes
│  │  └─ __tests__/
│  ├─ db/                       # schema.ts, client.ts, migrations/, repos/
│  ├─ sync/                     # engine.ts, tables.ts, cursor.ts
│  ├─ services/                 # health/, food-api/, purchases/, notifications/, export/
│  ├─ features/                 # food/, weight/, activity/, dashboard/, trends/, checkin/, onboarding/, settings/
│  ├─ stores/                   # zustand stores (UI/session only)
│  ├─ ui/                       # theme tokens, primitives (Card, Button, Stat, Approx), a11y helpers
│  └─ lib/                      # ids.ts (uuid v7 + deterministic v5), env.ts
├─ supabase/
│  ├─ migrations/               # SQL: tables, triggers, RLS
│  └─ functions/                # food-search/, delete-account/
├─ scripts/simulate.ts          # runs the algorithm on synthetic data (manual sanity check)
└─ docs/                        # ARCHITECTURE.md, PRIVACY.md, APP_STORE_LABELS.md
```

## 3. Data model

### 3.1 Conventions (every synced table)

| Column | Where | Purpose |
|--------|-------|---------|
| `id` uuid | both | Client-generated UUID v7. For "one per X" rows it's a **deterministic** UUID v5 (see below). |
| `user_id` uuid | server only | Default `auth.uid()`. Local DB doesn't need it, because the device is single-user. |
| `created_at`, `updated_at` | both | Client epoch ms. `updated_at` is the LWW clock. |
| `deleted_at` | both | Soft delete, so deletions sync. Rows are hard-purged after 90 days. |
| `server_updated_at` | both | Set by a server trigger. Used as the pull cursor. |
| `_dirty` | local only | 1 = needs push. |

- **Server primary key = `(user_id, id)`** so deterministic IDs never collide across users.
- **Deterministic IDs [D]:** `uuidv5(NS, key)`, where key is `day:2026-10-12`, `checkin:2026-10-05`, `steps:healthkit:2026-10-12`, or `hk:<sampleUUID>`. Two devices creating "today's summary" or importing the same HealthKit sample produce the *same row*, and LWW merges them. That's the core of cross-device dedupe.
- **Units:** mass in kg, length in cm, energy in kcal, all stored as REAL. Dates as `local_date TEXT 'YYYY-MM-DD'` in the user's timezone at entry time. **[A]** The day boundary is local midnight; travel doesn't rewrite past days.

### 3.2 Tables

**users** — Supabase `auth.users` (managed). No custom users table.

**profiles** (one row; id = deterministic `profile`)
`formula_sex` (male|female|average), `birth_date`, `height_cm`, `activity_level` (sedentary|light|moderate|very|extra), `weight_unit` (kg|lb), `height_unit` (cm|ftin), `calorie_mode` (adaptive|daily_adjust), `exercise_credit` (0–1, default 0.5), `protein_g_per_kg` (1.6 g/kg – 1 g/lb, default 1 g/lb ≈ 2.2046 g/kg; shown as g/lb when weight unit is lb), `fat_min_g_per_kg` (default 0.6), `ema_alpha` (default 0.1), `checkin_weekday` (0–6, default 1 = Monday), `hide_calories`, `hide_weight`, `pregnancy_status` (none|pregnant|breastfeeding), `disclaimer_accepted_at`, `evening_reminder` (HH:MM, nullable), `timezone`.
**[A]** We store birth date, not age, so age stays correct over time.

**goals** (history; the active goal has `end_date IS NULL`)
`type` (lose|maintain|gain), `rate_kg_per_week` (≥ 0, sign comes from type), `target_weight_kg?`, `start_date`, `end_date`.
History is kept so the algorithm can skip the 7 days after any goal change.

**weight_entries**
`measured_at` (ms), `local_date`, `weight_kg`, `source` (manual|healthkit|health_connect), `external_id?`, `outlier_status` (none|flagged|confirmed).
**[A]** With several weigh-ins on one day, the trend uses the **earliest** (morning) one.

**foods** (the user's custom foods + a local copy of every external food they've logged, so logs and recents work offline)
`source` (usda|off|custom), `source_id?`, `barcode?`, `name`, `brand?`, `kcal_100g`, `protein_100g`, `carbs_100g`, `fat_100g`, `fiber_100g?`, `servings` (JSON `[{label, grams}]`), `is_favorite`, `last_used_at`.

**food_logs**
`local_date`, `meal` (breakfast|lunch|dinner|snack), `food_id?` (null = quick-add), `name`, `servings_qty`, `serving_label`, `grams?`, `kcal`, `protein_g`, `carbs_g`, `fat_g`, `logged_at`.
Nutrients are **snapshotted** when the entry is logged, so editing a custom food never rewrites history.

**daily_summaries** (id = `day:<date>`)
Synced: `local_date`, `is_complete`, `is_rest_day`, `activity_checkin` (none|done|skipped).
Local-only cache, recomputed on device: `kcal_in`, `protein_g`, `carbs_g`, `fat_g`, `exercise_kcal_est`, `steps`.

**daily_steps** (id = `steps:<source>:<date>`)
`local_date`, `steps`, `source`.
Rule: a manual row overrides health rows for that day. Otherwise use the health value, which is already deduped by HealthKit/Health Connect across watch and phone.

**activity_types** (seeded with the app, **not synced**)
`code` (Compendium code), `name`, `category`, `met_light`, `met_moderate`, `met_vigorous`, `step_cadence?` (steps/min, set for walking/running, used for the step-overlap rule).

**activity_logs** — the *single* source of exercise burn
`local_date`, `started_at?`, `activity_type_code`, `duration_min`, `intensity` (light|moderate|vigorous), `met_used`, `kcal_est`, `source`, `external_id?`.
**[D]** A strength workout or an imported Health workout always creates exactly one `activity_log`. Detail lives in `workouts`. That way burn is never summed from two tables.

**workouts** (optional detail attached to an activity_log)
`activity_log_id`, `type` (strength|cardio|sport|other), `name?`, `rpe?` (session), `notes?`.

**workout_exercises**: `workout_id`, `position`, `exercise_name` (V2: `exercise_id` → templates).
**workout_sets**: `workout_exercise_id`, `position`, `reps`, `weight_kg?`, `rpe?`, `is_warmup`.

**check_ins** (id = `checkin:<week_start>`; synced; these anchor the TDEE chain)
`week_start`, `computed_at`, `goal_id`, `prev_tdee`, `observed_tdee?`, `new_tdee`, `baseline_tdee?` (daily-adjust mode), `confidence` (0–1), `status` (learning|adaptive), `calorie_target`, `protein_g`, `fat_g`, `carbs_g`, `reasons` (JSON reason codes, e.g. `["cap_hit_up","few_weigh_ins"]`), `applied` (bool).
Reasons are stored as codes, not sentences, so the wording can change later without a migration.

**tdee_estimates** (local-only cache, recomputed; feeds the "TDEE over time" chart)
`as_of_date`, `tdee`, `observed_tdee?`, `confidence`, `status`, `complete_days`, `weigh_ins`, `algo_version`.
**[D]** Not synced. It's derived data, and syncing derived data creates pointless conflicts.

**V2 placeholders (not built):** `recipes` + `recipe_items` (a recipe is a food with ingredients), `meal_plans`, `workout_templates`, `coach_grants(owner_id, grantee_id, scopes, expires_at)`, `photo_logs`. Widgets and Apple Watch read from a small shared "today" snapshot the app writes. No schema change needed.

### 3.3 Sync (local SQLite ⇄ Supabase)

1. **Writes** set `updated_at = now()` and `_dirty = 1`. Deletes set `deleted_at`.
2. **Push:** for each table, upsert dirty rows with supabase-js. A Postgres `BEFORE UPDATE` trigger does `IF NEW.updated_at <= OLD.updated_at THEN RETURN NULL` (the older write loses), stamps `user_id`, and sets `server_updated_at = now()`. On success, clear `_dirty` locally. No custom RPC needed.
3. **Pull:** `select * where server_updated_at > cursor - 30s`. The 30-second overlap covers transactions that commit out of order. Apply locally with the same LWW rule, so repeated pulls are harmless.
4. **When it runs:** app foreground, 2 s after the last local write (debounced), on reconnect (NetInfo), and on sign-in.
5. **First sign-in on a device that already has data:** push everything, then pull. Deterministic IDs merge "one per day" rows. Logs are unique UUIDs, so they simply combine.
6. **RLS:** every policy is `using (public.can_read(user_id))` / `with check (user_id = auth.uid())`. Today `can_read(o) = o = auth.uid()`. For V2 coach sharing it will also check `coach_grants`.

**[A]** Known LWW limits: a device whose clock is far ahead wins conflicts, and two edits to the *same* food log on two devices keep only the later one. Both are acceptable for this app.

## 4. Algorithm placement (summary; details in M1)

- `computeDailySeries(data, profile)` → trend weight per day plus outlier flags.
- `weeklyCheckIn(prevCheckIn, window, goalHistory, profile)` → new check-in. "Previous estimate" = the last **check-in's** `new_tdee`, so the chain is stable and identical on every device. Editing a 2-month-old log changes the charts but not past accepted targets.
- **[A]** The 7-day goal-change ignore also applies at onboarding when the goal is lose or gain, because the first week of a diet has the biggest water shift. So the first adaptive estimate typically arrives around day 14–17, not day 10.

## 5. Step calories (proposal, implemented in M1)

- Distance = steps × stride, with stride ≈ 0.414 × height. This is the common pedometer heuristic (female 0.413, male 0.415).
- Net walking cost ≈ **0.5 kcal per kg per km**. Source: the ACSM walking metabolic equation (horizontal component 0.1 mL O₂·kg⁻¹·m⁻¹, net of rest, × ~5 kcal/L O₂), in ACSM's *Guidelines for Exercise Testing and Prescription*.
- `kcal ≈ steps × 0.414 × height_m × weight_kg × 0.0005`. For 70 kg, 175 cm and 10,000 steps that's ~250 kcal.
- **Overlap:** subtract `duration × step_cadence` for each walking/running activity log on that day, floored at 0.
- **Sanity:** days above 50,000 steps are flagged "check this", but still counted.

## 6. Monetization

| | Free | Premium ($4.99/mo, $49.99/yr) |
|---|---|---|
| Logging (food, weight, activity) | ✓ | ✓ |
| Formula targets | ✓ | ✓ |
| Adaptive TDEE **estimate** shown | ✓ (once enough data) | ✓ |
| Weekly check-in auto-applies adaptive targets + explanations | — | ✓ |
| Trends | 7 / 30 days | 90 days + all-time, TDEE chart |
| Custom macros, daily-adjust mode | — | ✓ |
| CSV export | ✓ **(see flag)** | ✓ |

- **Flag:** you asked for export to be premium. I recommend making it free. Charging people to get their own health data out damages trust, which runs against the "no shame" brand. Premium is still worth paying for through adaptive targets.
- **Trial [D]:** 14-day free trial (configured as a store introductory offer), proposed at the moment the first adaptive estimate is ready ("Your real TDEE is ready"). Also available from Settings → Premium at any time.
  - Why not start it at install? Because of the 7-day settling window and the 10-day data minimum, a trial started at install would end before the user ever sees adaptive targets.
  - A one-line, skippable mention of the trial also appears at the end of onboarding.
- **RevenueCat:** anonymous app user ID at launch, `Purchases.logIn(supabaseUserId)` on sign-in, entitlement id `premium`, Restore Purchases button in Settings and on the paywall.

## 7. Safety and privacy mapping

- **Age gate:** onboarding requires age 18 or older for targets. Under 18 gets logging only, with no calorie target and a neutral message.
- **Floors:** 1,200 kcal female, 1,500 male/average, enforced in `core/safety.ts`. When a target is clamped, the warning reason code is surfaced in the UI.
- **Rate limits:** loss ≤ 1 % bodyweight/week, gain ≤ 0.5 %/week. The UI never offers anything beyond these, and core also clamps.
- **Pregnancy/breastfeeding:** forces a maintenance target (no deficit), shows "talk to your doctor", and hides the goal-rate picker.
- **Copy rules** live in `docs/COPY_GUIDE.md` (M2): no "over budget", no red for intake, no streaks, no "earn/burn off". Rest days are shown neutrally.
- **Encryption:** TLS in transit. Supabase encrypts at rest (AES-256). On device: OS file protection in M2–M5, then **SQLCipher** (expo-sqlite config plugin, key in expo-secure-store) in M6, because SQLCipher needs a dev build.
- **No ad or analytics SDKs [D]:** crash reporting only (Sentry, PII scrubbing on) — or none if you prefer.

## 8. Milestones

| | Scope | Working at the end |
|---|---|---|
| **M1** | `src/core` algorithm module + Jest tests + `scripts/simulate.ts` | `npm test` is green and covers every edge case in the spec. The simulation prints 60 days of trend/TDEE/targets from synthetic data. No UI. |
| **M2** | Expo app shell, theme (light/dark), SQLite + Drizzle + migrations, onboarding (incl. safety gates + disclaimer), manual weight entry, quick-add food, Today dashboard, mark-day-complete | Runs in Expo Go, fully offline. You can onboard, log quick-add calories and weight, and see remaining calories, trend weight and a "still learning" TDEE. |
| **M3** | Supabase project + `food-search` Edge Function, food search, barcode scan, serving picker, recents/favorites, custom foods, copy yesterday | Real food logging in ≤ 3 taps from Today. Barcodes work. Logged foods work offline. |
| **M4** | Daily activity check-in card + rest day, activity screen, strength logging, evening notification, Trends screen (charts), weekly check-in screen | The full adaptive loop runs on device. A weekly check-in recomputes targets with plain-language reasons. |
| **M5** | Auth (Apple/Google/email), RLS migrations, sync engine, settings (units, goal change, hide numbers, CSV export, delete account) | Two devices on one account stay in sync. Delete account wipes server + device data. |
| **M6** | EAS dev build, HealthKit + Health Connect import, RevenueCat paywall/trial/restore, SQLCipher, privacy policy + App Store / Play labels, store assets checklist | Health import with dedupe works on real phones, purchases work in sandbox, and the app is ready for TestFlight / internal testing. |

## 9. Assumptions to confirm later (non-blocking)

1. The default display unit is lb/ft-in for the US, switchable anytime.
2. The week starts Monday for check-ins (user-configurable).
3. Brand: calm/premium, primary color a muted teal (`#2F7F7A`-ish), neutral greys, and no red anywhere for intake.
4. Target user: 18–35 gym-goers. Differentiator: adaptive TDEE + fast logging + no-shame design.
5. Crash reporting: Sentry with PII scrubbing. Say if you'd rather have none.
