CREATE TABLE `companies` (
	`id` text PRIMARY KEY NOT NULL,
	`clerk_user_id` text NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`logo_key` text,
	`accent_color` text,
	`plan` text DEFAULT 'unlimited' NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `companies_clerk_user_id_unique` ON `companies` (`clerk_user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `companies_slug_unique` ON `companies` (`slug`);--> statement-breakpoint
CREATE TABLE `events` (
	`id` text PRIMARY KEY NOT NULL,
	`company_id` text NOT NULL,
	`name` text NOT NULL,
	`url_slug` text NOT NULL,
	`event_date` text,
	`welcome_message` text,
	`cover_photo_id` text,
	`accent_color` text,
	`published` integer DEFAULT false NOT NULL,
	`pin_hash` text,
	`sort_mode` text DEFAULT 'capture' NOT NULL,
	`view_count` integer DEFAULT 0 NOT NULL,
	`download_count` integer DEFAULT 0 NOT NULL,
	`expires_at` integer,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `events_company_slug_idx` ON `events` (`company_id`,`url_slug`);--> statement-breakpoint
CREATE INDEX `events_company_idx` ON `events` (`company_id`);--> statement-breakpoint
CREATE TABLE `photos` (
	`id` text PRIMARY KEY NOT NULL,
	`event_id` text NOT NULL,
	`key_original` text NOT NULL,
	`key_display` text NOT NULL,
	`key_thumb` text NOT NULL,
	`file_name` text NOT NULL,
	`width` integer NOT NULL,
	`height` integer NOT NULL,
	`size_bytes` integer NOT NULL,
	`captured_at` integer,
	`sort_index` integer DEFAULT 0 NOT NULL,
	`hidden` integer DEFAULT false NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`event_id`) REFERENCES `events`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `photos_event_idx` ON `photos` (`event_id`);