CREATE TABLE `liked_tracks` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`profile_id` text NOT NULL,
	`track_id` integer NOT NULL,
	`liked_at` integer NOT NULL,
	CONSTRAINT `fk_liked_tracks_profile_id_profiles_id_fk` FOREIGN KEY (`profile_id`) REFERENCES `profiles`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_liked_tracks_track_id_tracks_id_fk` FOREIGN KEY (`track_id`) REFERENCES `tracks`(`id`) ON DELETE CASCADE,
	CONSTRAINT `liked_tracks_profile_track_unique` UNIQUE(`profile_id`,`track_id`)
);
--> statement-breakpoint
CREATE INDEX `idx_liked_tracks_profile` ON `liked_tracks` (`profile_id`,`liked_at`);--> statement-breakpoint
CREATE INDEX `idx_liked_tracks_track` ON `liked_tracks` (`track_id`);