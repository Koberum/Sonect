CREATE TABLE `play_history` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`profile_id` text NOT NULL,
	`track_id` integer NOT NULL,
	`played_at` integer NOT NULL,
	CONSTRAINT `fk_play_history_profile_id_profiles_id_fk` FOREIGN KEY (`profile_id`) REFERENCES `profiles`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_play_history_track_id_tracks_id_fk` FOREIGN KEY (`track_id`) REFERENCES `tracks`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE INDEX `idx_play_history_profile_played` ON `play_history` (`profile_id`,`played_at`);--> statement-breakpoint
CREATE INDEX `idx_play_history_profile_track` ON `play_history` (`profile_id`,`track_id`);