CREATE TABLE `auth_sessions` (
	`token_hash` text PRIMARY KEY,
	`profile_id` text NOT NULL,
	`created_at` integer NOT NULL,
	`expires_at` integer NOT NULL,
	`last_used_at` integer NOT NULL,
	`user_agent` text,
	`device_id` text,
	CONSTRAINT `fk_auth_sessions_profile_id_profiles_id_fk` FOREIGN KEY (`profile_id`) REFERENCES `profiles`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
ALTER TABLE `profiles` ADD `password_hash` text;--> statement-breakpoint
ALTER TABLE `profiles` ADD `role` text DEFAULT 'user' NOT NULL;--> statement-breakpoint
ALTER TABLE `profiles` ADD `password_updated_at` integer;--> statement-breakpoint
CREATE INDEX `idx_auth_sessions_profile` ON `auth_sessions` (`profile_id`);--> statement-breakpoint
CREATE INDEX `idx_auth_sessions_expires` ON `auth_sessions` (`expires_at`);