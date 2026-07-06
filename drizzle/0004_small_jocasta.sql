CREATE TABLE `asset_blobs` (
	`key` text PRIMARY KEY NOT NULL,
	`data` blob NOT NULL,
	`mime_type` text,
	`size` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
