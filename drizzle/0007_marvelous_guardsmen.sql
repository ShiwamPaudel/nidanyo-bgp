CREATE TABLE `rate_limits` (
	`id` text PRIMARY KEY NOT NULL,
	`key` text NOT NULL,
	`count` integer DEFAULT 0 NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `rate_limits_key_unique` ON `rate_limits` (`key`);--> statement-breakpoint
CREATE INDEX `rate_limits_expires_idx` ON `rate_limits` (`expires_at`);