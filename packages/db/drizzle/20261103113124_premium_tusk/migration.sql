ALTER TABLE `playlists` ADD `profile_id` text NOT NULL REFERENCES profiles(id) ON DELETE CASCADE;--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_playlists` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`profile_id` text NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `fk_playlists_profile_id_profiles_id_fk` FOREIGN KEY (`profile_id`) REFERENCES `profiles`(`id`) ON DELETE CASCADE,
	CONSTRAINT `playlists_profile_id_name_unique` UNIQUE(`profile_id`,`name`)
);
--> statement-breakpoint
INSERT INTO `__new_playlists`(`id`, `name`, `description`, `created_at`, `updated_at`) SELECT `id`, `name`, `description`, `created_at`, `updated_at` FROM `playlists`;--> statement-breakpoint
DROP TABLE `playlists`;--> statement-breakpoint
ALTER TABLE `__new_playlists` RENAME TO `playlists`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `idx_playlists_profile` ON `playlists` (`profile_id`);