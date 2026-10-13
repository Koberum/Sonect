ALTER TABLE `storage_sources` RENAME COLUMN `uri` TO `path`;--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_storage_sources` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`name` text NOT NULL,
	`path` text NOT NULL,
	`enabled` integer DEFAULT 1,
	`file_count` integer DEFAULT 0,
	`dir_count` integer DEFAULT 0,
	`total_size` integer DEFAULT 0,
	`created_at` text DEFAULT CURRENT_TIMESTAMP,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
INSERT INTO `__new_storage_sources`(`id`, `name`, `path`, `enabled`, `file_count`, `dir_count`, `total_size`, `created_at`, `updated_at`) SELECT `id`, `name`, `path`, `enabled`, `file_count`, `dir_count`, `total_size`, `created_at`, `updated_at` FROM `storage_sources`;--> statement-breakpoint
DROP TABLE `storage_sources`;--> statement-breakpoint
ALTER TABLE `__new_storage_sources` RENAME TO `storage_sources`;--> statement-breakpoint
PRAGMA foreign_keys=ON;