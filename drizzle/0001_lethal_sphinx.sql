CREATE TABLE `referring_doctors` (
	`id` text PRIMARY KEY NOT NULL,
	`lab_id` text NOT NULL,
	`name` text NOT NULL,
	`qualification` text,
	`clinic` text,
	`phone` text,
	`commission_percent` real DEFAULT 0 NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`lab_id`) REFERENCES `labs`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `email_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`lab_id` text NOT NULL,
	`visit_id` text,
	`to_email` text NOT NULL,
	`subject` text NOT NULL,
	`body` text NOT NULL,
	`purpose` text DEFAULT 'other' NOT NULL,
	`provider` text DEFAULT 'mock' NOT NULL,
	`status` text DEFAULT 'queued' NOT NULL,
	`provider_message_id` text,
	`error` text,
	`sent_by` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`lab_id`) REFERENCES `labs`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `email_logs_visit_idx` ON `email_logs` (`visit_id`);--> statement-breakpoint
CREATE INDEX `email_logs_status_idx` ON `email_logs` (`status`);