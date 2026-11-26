CREATE TABLE `guard_audits` (
	`id` text PRIMARY KEY NOT NULL,
	`session_id` text NOT NULL,
	`created_at` integer NOT NULL,
	`amount_cents` integer,
	`amount_input` text NOT NULL,
	`country` text NOT NULL,
	`iso_code` text,
	`recipient` text NOT NULL,
	`decision` text NOT NULL,
	`reason` text NOT NULL,
	`reference` text,
	`source` text NOT NULL,
	FOREIGN KEY (`session_id`) REFERENCES `guard_sessions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `guard_audits_session` ON `guard_audits` (`session_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `guard_messages` (
	`id` text PRIMARY KEY NOT NULL,
	`session_id` text NOT NULL,
	`role` text NOT NULL,
	`content` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`session_id`) REFERENCES `guard_sessions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `guard_messages_session` ON `guard_messages` (`session_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `guard_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`token_hash` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `guard_sessions_token_hash_unique` ON `guard_sessions` (`token_hash`);