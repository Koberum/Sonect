CREATE TABLE `profile_settings` (
	`profile_id` text PRIMARY KEY,
	`crossfade_seconds` integer DEFAULT 0 NOT NULL,
	`updated_at` integer NOT NULL,
	CONSTRAINT `fk_profile_settings_profile_id_profiles_id_fk` FOREIGN KEY (`profile_id`) REFERENCES `profiles`(`id`) ON DELETE CASCADE
);
