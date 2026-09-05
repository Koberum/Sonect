CREATE TABLE `albums` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`title` text NOT NULL,
	`artist_id` integer,
	`artist_name` text,
	`date` text,
	`genre` text,
	`cover_path` text,
	`last_played` text,
	`year` integer,
	`created_at` text DEFAULT CURRENT_TIMESTAMP,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `fk_albums_artist_id_artists_id_fk` FOREIGN KEY (`artist_id`) REFERENCES `artists`(`id`) ON DELETE SET NULL
);
--> statement-breakpoint
CREATE TABLE `artists` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`name` text NOT NULL UNIQUE,
	`sort_name` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE TABLE `playlist_tracks` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`playlist_id` integer NOT NULL,
	`track_id` integer NOT NULL,
	`position` integer NOT NULL,
	`added_at` text DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `fk_playlist_tracks_playlist_id_playlists_id_fk` FOREIGN KEY (`playlist_id`) REFERENCES `playlists`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_playlist_tracks_track_id_tracks_id_fk` FOREIGN KEY (`track_id`) REFERENCES `tracks`(`id`) ON DELETE CASCADE,
	CONSTRAINT `playlist_tracks_playlist_id_track_id_unique` UNIQUE(`playlist_id`,`track_id`)
);
--> statement-breakpoint
CREATE TABLE `playlists` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`name` text NOT NULL UNIQUE,
	`description` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE TABLE `setup_progress` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`step` text NOT NULL UNIQUE,
	`completed` integer DEFAULT 0,
	`completed_at` text
);
--> statement-breakpoint
CREATE TABLE `storage_sources` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`name` text NOT NULL,
	`type` text NOT NULL,
	`uri` text NOT NULL,
	`mount_path` text NOT NULL,
	`username` text,
	`password` text,
	`enabled` integer DEFAULT 1,
	`file_count` integer DEFAULT 0,
	`dir_count` integer DEFAULT 0,
	`total_size` integer DEFAULT 0,
	`created_at` text DEFAULT CURRENT_TIMESTAMP,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT "storage_sources_type_check" CHECK("type" in ('smb', 'nfs', 'local'))
);
--> statement-breakpoint
CREATE TABLE `sync_metadata` (
	`key` text PRIMARY KEY,
	`value` text,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE TABLE `tracks` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`file` text NOT NULL CONSTRAINT `tracks_file_unique` UNIQUE,
	`title` text NOT NULL,
	`artist_id` integer,
	`album_id` integer,
	`track_number` integer,
	`disc_number` integer,
	`duration` real,
	`date` text,
	`genre` text,
	`composer` text,
	`performer` text,
	`comment` text,
	`last_modified` text,
	`play_count` integer DEFAULT 0,
	`last_played` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `fk_tracks_artist_id_artists_id_fk` FOREIGN KEY (`artist_id`) REFERENCES `artists`(`id`) ON DELETE SET NULL,
	CONSTRAINT `fk_tracks_album_id_albums_id_fk` FOREIGN KEY (`album_id`) REFERENCES `albums`(`id`) ON DELETE SET NULL
);
--> statement-breakpoint
CREATE INDEX `idx_albums_artist` ON `albums` (`artist_id`);--> statement-breakpoint
CREATE INDEX `idx_playlist_tracks_playlist` ON `playlist_tracks` (`playlist_id`);--> statement-breakpoint
CREATE INDEX `idx_playlist_tracks_track` ON `playlist_tracks` (`track_id`);--> statement-breakpoint
CREATE INDEX `idx_tracks_artist` ON `tracks` (`artist_id`);--> statement-breakpoint
CREATE INDEX `idx_tracks_album` ON `tracks` (`album_id`);--> statement-breakpoint
CREATE INDEX `idx_tracks_file` ON `tracks` (`file`);