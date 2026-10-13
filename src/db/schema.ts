// Local SQLite schema (Drizzle). Mirrors the Supabase tables in docs/ARCHITECTURE.md §3.
// Units: kg, cm, kcal. Dates: local 'YYYY-MM-DD'. Timestamps: epoch ms.
import { index, integer, real, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

import type {
  ActivityLevel,
  CalorieMode,
  DataSource,
  FormulaSex,
  GoalType,
  Intensity,
  PregnancyStatus,
  WeightUnit,
} from '@/core';

/** Sync bookkeeping on every synced table. */
const syncColumns = {
  id: text('id').primaryKey(),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
  deletedAt: integer('deleted_at'),
  /** Set by the server; the pull cursor. Null until first synced. */
  serverUpdatedAt: integer('server_updated_at'),
  /** Local only: 1 = needs push. */
  dirty: integer('dirty', { mode: 'boolean' }).notNull().default(true),
};

export const profiles = sqliteTable('profiles', {
  ...syncColumns,
  formulaSex: text('formula_sex').$type<FormulaSex>().notNull(),
  birthDate: text('birth_date').notNull(),
  heightCm: real('height_cm').notNull(),
  activityLevel: text('activity_level').$type<ActivityLevel>().notNull(),
  weightUnit: text('weight_unit').$type<WeightUnit>().notNull(),
  heightUnit: text('height_unit').$type<'cm' | 'ftin'>().notNull(),
  calorieMode: text('calorie_mode').$type<CalorieMode>().notNull().default('adaptive'),
  exerciseCredit: real('exercise_credit').notNull().default(0.5),
  proteinGPerKg: real('protein_g_per_kg').notNull(),
  fatMinGPerKg: real('fat_min_g_per_kg').notNull().default(0.6),
  emaAlpha: real('ema_alpha').notNull().default(0.1),
  checkinWeekday: integer('checkin_weekday').notNull().default(1),
  hideCalories: integer('hide_calories', { mode: 'boolean' }).notNull().default(false),
  hideWeight: integer('hide_weight', { mode: 'boolean' }).notNull().default(false),
  pregnancyStatus: text('pregnancy_status').$type<PregnancyStatus>().notNull().default('none'),
  disclaimerAcceptedAt: integer('disclaimer_accepted_at'),
  eveningReminder: text('evening_reminder'),
  timezone: text('timezone'),
});

export const goals = sqliteTable('goals', {
  ...syncColumns,
  type: text('type').$type<GoalType>().notNull(),
  rateKgPerWeek: real('rate_kg_per_week').notNull(),
  targetWeightKg: real('target_weight_kg'),
  startDate: text('start_date').notNull(),
  endDate: text('end_date'),
});

export const weightEntries = sqliteTable(
  'weight_entries',
  {
    ...syncColumns,
    measuredAt: integer('measured_at').notNull(),
    localDate: text('local_date').notNull(),
    weightKg: real('weight_kg').notNull(),
    source: text('source').$type<DataSource>().notNull(),
    externalId: text('external_id'),
    outlierStatus: text('outlier_status').$type<'none' | 'confirmed'>().notNull().default('none'),
  },
  (t) => [index('weight_entries_date').on(t.localDate)],
);

export type ServingOption = { label: string; grams: number };

export const foods = sqliteTable(
  'foods',
  {
    ...syncColumns,
    source: text('source').$type<'usda' | 'off' | 'custom'>().notNull(),
    sourceId: text('source_id'),
    barcode: text('barcode'),
    name: text('name').notNull(),
    brand: text('brand'),
    kcal100g: real('kcal_100g').notNull(),
    protein100g: real('protein_100g').notNull(),
    carbs100g: real('carbs_100g').notNull(),
    fat100g: real('fat_100g').notNull(),
    fiber100g: real('fiber_100g'),
    servings: text('servings', { mode: 'json' }).$type<ServingOption[]>().notNull(),
    /** False for custom foods entered "per serving" without a weight: no gram option then. */
    gramsKnown: integer('grams_known', { mode: 'boolean' }).notNull().default(true),
    /** The serving used last time, so logging again is one tap. */
    lastQty: real('last_qty'),
    lastServingLabel: text('last_serving_label'),
    isFavorite: integer('is_favorite', { mode: 'boolean' }).notNull().default(false),
    lastUsedAt: integer('last_used_at'),
  },
  (t) => [index('foods_barcode').on(t.barcode), index('foods_source').on(t.source, t.sourceId), index('foods_last_used').on(t.lastUsedAt)],
);

export type Meal = 'breakfast' | 'lunch' | 'dinner' | 'snack';

export const foodLogs = sqliteTable(
  'food_logs',
  {
    ...syncColumns,
    localDate: text('local_date').notNull(),
    meal: text('meal').$type<Meal>().notNull(),
    /** Null = quick add. */
    foodId: text('food_id'),
    name: text('name').notNull(),
    servingsQty: real('servings_qty').notNull().default(1),
    servingLabel: text('serving_label'),
    grams: real('grams'),
    // Nutrients snapshotted at log time, so editing a food never rewrites history.
    kcal: real('kcal').notNull(),
    proteinG: real('protein_g').notNull().default(0),
    carbsG: real('carbs_g').notNull().default(0),
    fatG: real('fat_g').notNull().default(0),
    loggedAt: integer('logged_at').notNull(),
  },
  (t) => [index('food_logs_date').on(t.localDate)],
);

export const dailySummaries = sqliteTable(
  'daily_summaries',
  {
    ...syncColumns, // id = ids.day(date)
    localDate: text('local_date').notNull(),
    isComplete: integer('is_complete', { mode: 'boolean' }).notNull().default(false),
    isRestDay: integer('is_rest_day', { mode: 'boolean' }).notNull().default(false),
    activityCheckin: text('activity_checkin').$type<'none' | 'done' | 'skipped'>().notNull().default('none'),
  },
  (t) => [uniqueIndex('daily_summaries_date').on(t.localDate)],
);

export const dailySteps = sqliteTable(
  'daily_steps',
  {
    ...syncColumns, // id = ids.steps(source, date)
    localDate: text('local_date').notNull(),
    steps: integer('steps').notNull(),
    source: text('source').$type<DataSource>().notNull(),
  },
  (t) => [index('daily_steps_date').on(t.localDate)],
);

/** The single source of exercise burn. Workouts attach detail to one of these. */
export const activityLogs = sqliteTable(
  'activity_logs',
  {
    ...syncColumns,
    localDate: text('local_date').notNull(),
    startedAt: integer('started_at'),
    activityCode: text('activity_code').notNull(),
    durationMin: real('duration_min').notNull(),
    intensity: text('intensity').$type<Intensity>().notNull(),
    metUsed: real('met_used').notNull(),
    kcalEst: real('kcal_est').notNull(),
    source: text('source').$type<DataSource>().notNull(),
    externalId: text('external_id'),
  },
  (t) => [index('activity_logs_date').on(t.localDate)],
);

export const workouts = sqliteTable('workouts', {
  ...syncColumns,
  activityLogId: text('activity_log_id').notNull(),
  type: text('type').$type<'strength' | 'cardio' | 'sport' | 'other'>().notNull(),
  name: text('name'),
  rpe: real('rpe'),
  notes: text('notes'),
});

export const workoutExercises = sqliteTable('workout_exercises', {
  ...syncColumns,
  workoutId: text('workout_id').notNull(),
  position: integer('position').notNull(),
  exerciseName: text('exercise_name').notNull(),
});

export const workoutSets = sqliteTable('workout_sets', {
  ...syncColumns,
  workoutExerciseId: text('workout_exercise_id').notNull(),
  position: integer('position').notNull(),
  reps: integer('reps').notNull(),
  weightKg: real('weight_kg'),
  rpe: real('rpe'),
  isWarmup: integer('is_warmup', { mode: 'boolean' }).notNull().default(false),
});

export type CheckInReasonCode = string;

export const checkIns = sqliteTable(
  'check_ins',
  {
    ...syncColumns, // id = ids.checkIn(date)
    date: text('date').notNull(),
    computedAt: integer('computed_at').notNull(),
    goalId: text('goal_id'),
    status: text('status').$type<'learning' | 'adaptive' | 'holding'>().notNull(),
    prevTdee: real('prev_tdee'),
    observedTdee: real('observed_tdee'),
    tdee: real('tdee').notNull(),
    baselineTdee: real('baseline_tdee').notNull(),
    confidence: text('confidence').$type<'learning' | 'low' | 'medium' | 'high'>().notNull(),
    calorieTarget: real('calorie_target'),
    proteinG: real('protein_g'),
    fatG: real('fat_g'),
    carbsG: real('carbs_g'),
    reasons: text('reasons', { mode: 'json' }).$type<CheckInReasonCode[]>().notNull(),
    applied: integer('applied', { mode: 'boolean' }).notNull().default(true),
    /** Local only: the user has opened this check-in. */
    seen: integer('seen', { mode: 'boolean' }).notNull().default(false),
  },
  (t) => [uniqueIndex('check_ins_date').on(t.date)],
);

export const schema = {
  profiles,
  goals,
  weightEntries,
  foods,
  foodLogs,
  dailySummaries,
  dailySteps,
  activityLogs,
  workouts,
  workoutExercises,
  workoutSets,
  checkIns,
};

/** Tables that sync to Supabase (all of them, today). */
export const SYNCED_TABLES = Object.values(schema);
