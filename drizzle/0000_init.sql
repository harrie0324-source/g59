CREATE TABLE `activity_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	`server_updated_at` integer,
	`dirty` integer DEFAULT true NOT NULL,
	`local_date` text NOT NULL,
	`started_at` integer,
	`activity_code` text NOT NULL,
	`duration_min` real NOT NULL,
	`intensity` text NOT NULL,
	`met_used` real NOT NULL,
	`kcal_est` real NOT NULL,
	`source` text NOT NULL,
	`external_id` text
);
--> statement-breakpoint
CREATE INDEX `activity_logs_date` ON `activity_logs` (`local_date`);--> statement-breakpoint
CREATE TABLE `check_ins` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	`server_updated_at` integer,
	`dirty` integer DEFAULT true NOT NULL,
	`date` text NOT NULL,
	`computed_at` integer NOT NULL,
	`goal_id` text,
	`status` text NOT NULL,
	`prev_tdee` real,
	`observed_tdee` real,
	`tdee` real NOT NULL,
	`baseline_tdee` real NOT NULL,
	`confidence` text NOT NULL,
	`calorie_target` real,
	`protein_g` real,
	`fat_g` real,
	`carbs_g` real,
	`reasons` text NOT NULL,
	`applied` integer DEFAULT true NOT NULL,
	`seen` integer DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `check_ins_date` ON `check_ins` (`date`);--> statement-breakpoint
CREATE TABLE `daily_steps` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	`server_updated_at` integer,
	`dirty` integer DEFAULT true NOT NULL,
	`local_date` text NOT NULL,
	`steps` integer NOT NULL,
	`source` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `daily_steps_date` ON `daily_steps` (`local_date`);--> statement-breakpoint
CREATE TABLE `daily_summaries` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	`server_updated_at` integer,
	`dirty` integer DEFAULT true NOT NULL,
	`local_date` text NOT NULL,
	`is_complete` integer DEFAULT false NOT NULL,
	`is_rest_day` integer DEFAULT false NOT NULL,
	`activity_checkin` text DEFAULT 'none' NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `daily_summaries_date` ON `daily_summaries` (`local_date`);--> statement-breakpoint
CREATE TABLE `food_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	`server_updated_at` integer,
	`dirty` integer DEFAULT true NOT NULL,
	`local_date` text NOT NULL,
	`meal` text NOT NULL,
	`food_id` text,
	`name` text NOT NULL,
	`servings_qty` real DEFAULT 1 NOT NULL,
	`serving_label` text,
	`grams` real,
	`kcal` real NOT NULL,
	`protein_g` real DEFAULT 0 NOT NULL,
	`carbs_g` real DEFAULT 0 NOT NULL,
	`fat_g` real DEFAULT 0 NOT NULL,
	`logged_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `food_logs_date` ON `food_logs` (`local_date`);--> statement-breakpoint
CREATE TABLE `foods` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	`server_updated_at` integer,
	`dirty` integer DEFAULT true NOT NULL,
	`source` text NOT NULL,
	`source_id` text,
	`barcode` text,
	`name` text NOT NULL,
	`brand` text,
	`kcal_100g` real NOT NULL,
	`protein_100g` real NOT NULL,
	`carbs_100g` real NOT NULL,
	`fat_100g` real NOT NULL,
	`fiber_100g` real,
	`servings` text NOT NULL,
	`is_favorite` integer DEFAULT false NOT NULL,
	`last_used_at` integer
);
--> statement-breakpoint
CREATE INDEX `foods_barcode` ON `foods` (`barcode`);--> statement-breakpoint
CREATE TABLE `goals` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	`server_updated_at` integer,
	`dirty` integer DEFAULT true NOT NULL,
	`type` text NOT NULL,
	`rate_kg_per_week` real NOT NULL,
	`target_weight_kg` real,
	`start_date` text NOT NULL,
	`end_date` text
);
--> statement-breakpoint
CREATE TABLE `profiles` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	`server_updated_at` integer,
	`dirty` integer DEFAULT true NOT NULL,
	`formula_sex` text NOT NULL,
	`birth_date` text NOT NULL,
	`height_cm` real NOT NULL,
	`activity_level` text NOT NULL,
	`weight_unit` text NOT NULL,
	`height_unit` text NOT NULL,
	`calorie_mode` text DEFAULT 'adaptive' NOT NULL,
	`exercise_credit` real DEFAULT 0.5 NOT NULL,
	`protein_g_per_kg` real NOT NULL,
	`fat_min_g_per_kg` real DEFAULT 0.6 NOT NULL,
	`ema_alpha` real DEFAULT 0.1 NOT NULL,
	`checkin_weekday` integer DEFAULT 1 NOT NULL,
	`hide_calories` integer DEFAULT false NOT NULL,
	`hide_weight` integer DEFAULT false NOT NULL,
	`pregnancy_status` text DEFAULT 'none' NOT NULL,
	`disclaimer_accepted_at` integer,
	`evening_reminder` text,
	`timezone` text
);
--> statement-breakpoint
CREATE TABLE `weight_entries` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	`server_updated_at` integer,
	`dirty` integer DEFAULT true NOT NULL,
	`measured_at` integer NOT NULL,
	`local_date` text NOT NULL,
	`weight_kg` real NOT NULL,
	`source` text NOT NULL,
	`external_id` text,
	`outlier_status` text DEFAULT 'none' NOT NULL
);
--> statement-breakpoint
CREATE INDEX `weight_entries_date` ON `weight_entries` (`local_date`);--> statement-breakpoint
CREATE TABLE `workout_exercises` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	`server_updated_at` integer,
	`dirty` integer DEFAULT true NOT NULL,
	`workout_id` text NOT NULL,
	`position` integer NOT NULL,
	`exercise_name` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `workout_sets` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	`server_updated_at` integer,
	`dirty` integer DEFAULT true NOT NULL,
	`workout_exercise_id` text NOT NULL,
	`position` integer NOT NULL,
	`reps` integer NOT NULL,
	`weight_kg` real,
	`rpe` real,
	`is_warmup` integer DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE `workouts` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	`server_updated_at` integer,
	`dirty` integer DEFAULT true NOT NULL,
	`activity_log_id` text NOT NULL,
	`type` text NOT NULL,
	`name` text,
	`rpe` real,
	`notes` text
);
