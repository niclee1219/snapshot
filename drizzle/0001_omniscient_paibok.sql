DROP INDEX `companies_clerk_user_id_unique`;--> statement-breakpoint
ALTER TABLE `companies` ADD `theme` text DEFAULT 'dark' NOT NULL;--> statement-breakpoint
CREATE INDEX `idx_companies_clerk_user_id` ON `companies` (`clerk_user_id`);--> statement-breakpoint
ALTER TABLE `events` ADD `theme` text;