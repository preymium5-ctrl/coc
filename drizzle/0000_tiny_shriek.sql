CREATE TABLE `raid_battles` (
	`id` text PRIMARY KEY NOT NULL,
	`player_tag` text NOT NULL,
	`occurred_at` integer NOT NULL,
	`mode` text NOT NULL,
	`is_attack` integer NOT NULL,
	`gold` integer,
	`elixir` integer,
	`dark` integer,
	`data` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `battle_player_date` ON `raid_battles` (`player_tag`,`occurred_at`);--> statement-breakpoint
CREATE TABLE `player_sync` (
	`tag` text PRIMARY KEY NOT NULL,
	`synced_at` integer NOT NULL,
	`coverage` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `public_cache` (
	`key` text PRIMARY KEY NOT NULL,
	`data` text NOT NULL,
	`expires_at` integer NOT NULL
);
