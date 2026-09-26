CREATE TABLE `genres` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`name` text NOT NULL UNIQUE,
	`created_at` text DEFAULT CURRENT_TIMESTAMP,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
ALTER TABLE `albums` ADD `genre_id` integer REFERENCES genres(id) ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE `tracks` ADD `genre_id` integer REFERENCES genres(id) ON DELETE SET NULL;--> statement-breakpoint
CREATE INDEX `idx_albums_genre` ON `albums` (`genre_id`);--> statement-breakpoint
CREATE INDEX `idx_tracks_genre` ON `tracks` (`genre_id`);--> statement-breakpoint
ALTER TABLE `albums` DROP COLUMN `genre`;--> statement-breakpoint
ALTER TABLE `tracks` DROP COLUMN `genre`;