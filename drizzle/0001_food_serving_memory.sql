ALTER TABLE `foods` ADD `grams_known` integer DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `foods` ADD `last_qty` real;--> statement-breakpoint
ALTER TABLE `foods` ADD `last_serving_label` text;--> statement-breakpoint
CREATE INDEX `foods_source` ON `foods` (`source`,`source_id`);--> statement-breakpoint
CREATE INDEX `foods_last_used` ON `foods` (`last_used_at`);