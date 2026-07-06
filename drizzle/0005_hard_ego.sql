CREATE TABLE `report_signatories` (
	`id` text PRIMARY KEY NOT NULL,
	`lab_id` text NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`storage_key` text NOT NULL,
	`url` text NOT NULL,
	`mime_type` text,
	`display_order` integer DEFAULT 0 NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	`created_by` text,
	`updated_by` text,
	FOREIGN KEY (`lab_id`) REFERENCES `labs`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `report_signatories_lab_idx` ON `report_signatories` (`lab_id`);