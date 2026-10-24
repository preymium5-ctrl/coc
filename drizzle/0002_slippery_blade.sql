CREATE TABLE `clan_auto_sync` (
	`clan_tag` text PRIMARY KEY NOT NULL,
	`run_id` text,
	`status` text DEFAULT 'idle' NOT NULL,
	`started_at` integer,
	`finished_at` integer,
	`last_success_at` integer,
	`next_at` integer DEFAULT 0 NOT NULL,
	`lease_until` integer DEFAULT 0 NOT NULL,
	`last_seen_at` integer DEFAULT 0 NOT NULL,
	`completed` integer DEFAULT 0 NOT NULL,
	`total` integer DEFAULT 0 NOT NULL,
	`failed` integer DEFAULT 0 NOT NULL,
	`roster_tags` text DEFAULT '[]' NOT NULL,
	`completed_tags` text DEFAULT '[]' NOT NULL,
	`failed_tags` text DEFAULT '[]' NOT NULL,
	`version` integer DEFAULT 0 NOT NULL
);
