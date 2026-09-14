CREATE TABLE `profiles` (
	`id` text PRIMARY KEY,
	`name` text NOT NULL UNIQUE,
	`avatar_color` text NOT NULL,
	`created_at` integer NOT NULL
);
