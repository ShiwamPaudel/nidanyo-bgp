CREATE TABLE `lab_assets` (
	`id` text PRIMARY KEY NOT NULL,
	`lab_id` text NOT NULL,
	`kind` text NOT NULL,
	`owner_user_id` text,
	`storage_key` text NOT NULL,
	`url` text NOT NULL,
	`mime_type` text,
	`width` integer,
	`height` integer,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	`created_by` text,
	`updated_by` text,
	FOREIGN KEY (`lab_id`) REFERENCES `labs`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `lab_assets_lab_kind_idx` ON `lab_assets` (`lab_id`,`kind`);--> statement-breakpoint
CREATE TABLE `lab_settings` (
	`id` text PRIMARY KEY NOT NULL,
	`lab_id` text NOT NULL,
	`address` text,
	`phone` text,
	`email` text,
	`website` text,
	`pan_vat` text,
	`currency` text DEFAULT 'NPR' NOT NULL,
	`tax_enabled` integer DEFAULT false NOT NULL,
	`tax_percent` integer DEFAULT 0 NOT NULL,
	`report_margin_top_mm` integer DEFAULT 38 NOT NULL,
	`report_margin_bottom_mm` integer DEFAULT 30 NOT NULL,
	`report_margin_x_mm` integer DEFAULT 12 NOT NULL,
	`short_link_base_url` text,
	`patient_prefix` text DEFAULT 'P' NOT NULL,
	`visit_prefix` text DEFAULT 'V' NOT NULL,
	`bill_prefix` text DEFAULT 'B' NOT NULL,
	`sample_prefix` text DEFAULT 'S' NOT NULL,
	`require_phone_verification` integer DEFAULT false NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	`created_by` text,
	`updated_by` text,
	FOREIGN KEY (`lab_id`) REFERENCES `labs`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `labs` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`code` text NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `labs_code_unique` ON `labs` (`code`);--> statement-breakpoint
CREATE TABLE `roles` (
	`id` text PRIMARY KEY NOT NULL,
	`lab_id` text,
	`key` text NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`permissions` text DEFAULT '[]' NOT NULL,
	`is_system` integer DEFAULT false NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`lab_id`) REFERENCES `labs`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`user_agent` text,
	`ip` text,
	`expires_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `sessions_user_idx` ON `sessions` (`user_id`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`lab_id` text NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`phone` text,
	`password_hash` text NOT NULL,
	`role_id` text NOT NULL,
	`role_key` text NOT NULL,
	`designation` text,
	`registration_no` text,
	`signature_asset_id` text,
	`is_active` integer DEFAULT true NOT NULL,
	`last_login_at` integer,
	`must_change_password` integer DEFAULT false NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	`created_by` text,
	`updated_by` text,
	FOREIGN KEY (`lab_id`) REFERENCES `labs`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`role_id`) REFERENCES `roles`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);--> statement-breakpoint
CREATE INDEX `users_lab_idx` ON `users` (`lab_id`);--> statement-breakpoint
CREATE INDEX `users_role_idx` ON `users` (`role_key`);--> statement-breakpoint
CREATE TABLE `departments` (
	`id` text PRIMARY KEY NOT NULL,
	`lab_id` text NOT NULL,
	`name` text NOT NULL,
	`display_order` integer DEFAULT 0 NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`lab_id`) REFERENCES `labs`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `payment_modes` (
	`id` text PRIMARY KEY NOT NULL,
	`lab_id` text NOT NULL,
	`name` text NOT NULL,
	`category` text DEFAULT 'other' NOT NULL,
	`display_order` integer DEFAULT 0 NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`lab_id`) REFERENCES `labs`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `sample_types` (
	`id` text PRIMARY KEY NOT NULL,
	`lab_id` text NOT NULL,
	`name` text NOT NULL,
	`color_hex` text,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`lab_id`) REFERENCES `labs`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `test_group_items` (
	`id` text PRIMARY KEY NOT NULL,
	`group_id` text NOT NULL,
	`test_id` text NOT NULL,
	`display_order` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`group_id`) REFERENCES `test_groups`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`test_id`) REFERENCES `tests`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `test_group_items_group_idx` ON `test_group_items` (`group_id`);--> statement-breakpoint
CREATE TABLE `test_groups` (
	`id` text PRIMARY KEY NOT NULL,
	`lab_id` text NOT NULL,
	`name` text NOT NULL,
	`short_code` text,
	`department_id` text,
	`pricing_mode` text DEFAULT 'fixed' NOT NULL,
	`group_price` real DEFAULT 0 NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	`created_by` text,
	`updated_by` text,
	FOREIGN KEY (`lab_id`) REFERENCES `labs`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`department_id`) REFERENCES `departments`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `test_parameters` (
	`id` text PRIMARY KEY NOT NULL,
	`test_id` text NOT NULL,
	`name` text NOT NULL,
	`unit` text,
	`result_type` text DEFAULT 'numeric' NOT NULL,
	`select_options` text,
	`ref_range_text` text,
	`ref_low` real,
	`ref_high` real,
	`critical_low` real,
	`critical_high` real,
	`ref_overrides` text,
	`default_remarks` text,
	`display_order` integer DEFAULT 0 NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`test_id`) REFERENCES `tests`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `test_parameters_test_idx` ON `test_parameters` (`test_id`);--> statement-breakpoint
CREATE TABLE `tests` (
	`id` text PRIMARY KEY NOT NULL,
	`lab_id` text NOT NULL,
	`name` text NOT NULL,
	`short_code` text NOT NULL,
	`department_id` text,
	`sample_type_id` text,
	`price` real DEFAULT 0 NOT NULL,
	`method` text,
	`unit` text,
	`result_type` text DEFAULT 'numeric' NOT NULL,
	`select_options` text,
	`ref_range_text` text,
	`ref_low` real,
	`ref_high` real,
	`critical_low` real,
	`critical_high` real,
	`default_remarks` text,
	`tat_hours` integer,
	`display_order` integer DEFAULT 0 NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	`created_by` text,
	`updated_by` text,
	FOREIGN KEY (`lab_id`) REFERENCES `labs`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`department_id`) REFERENCES `departments`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`sample_type_id`) REFERENCES `sample_types`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `tests_lab_name_idx` ON `tests` (`lab_id`,`name`);--> statement-breakpoint
CREATE INDEX `tests_code_idx` ON `tests` (`short_code`);--> statement-breakpoint
CREATE TABLE `patients` (
	`id` text PRIMARY KEY NOT NULL,
	`lab_id` text NOT NULL,
	`code` text NOT NULL,
	`full_name` text NOT NULL,
	`gender` text NOT NULL,
	`age_value` integer,
	`age_unit` text DEFAULT 'years',
	`dob` integer,
	`phone` text,
	`email` text,
	`address` text,
	`referred_by` text,
	`notes` text,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	`created_by` text,
	`updated_by` text,
	FOREIGN KEY (`lab_id`) REFERENCES `labs`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `patients_lab_code_idx` ON `patients` (`lab_id`,`code`);--> statement-breakpoint
CREATE INDEX `patients_phone_idx` ON `patients` (`phone`);--> statement-breakpoint
CREATE INDEX `patients_name_idx` ON `patients` (`full_name`);--> statement-breakpoint
CREATE TABLE `bill_items` (
	`id` text PRIMARY KEY NOT NULL,
	`bill_id` text NOT NULL,
	`visit_test_id` text,
	`label` text NOT NULL,
	`kind` text DEFAULT 'test' NOT NULL,
	`qty` integer DEFAULT 1 NOT NULL,
	`unit_price` real DEFAULT 0 NOT NULL,
	`line_total` real DEFAULT 0 NOT NULL,
	FOREIGN KEY (`bill_id`) REFERENCES `bills`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `bill_items_bill_idx` ON `bill_items` (`bill_id`);--> statement-breakpoint
CREATE TABLE `bills` (
	`id` text PRIMARY KEY NOT NULL,
	`lab_id` text NOT NULL,
	`code` text NOT NULL,
	`visit_id` text NOT NULL,
	`patient_id` text NOT NULL,
	`subtotal` real DEFAULT 0 NOT NULL,
	`discount_amount` real DEFAULT 0 NOT NULL,
	`discount_reason` text,
	`tax_percent` real DEFAULT 0 NOT NULL,
	`tax_amount` real DEFAULT 0 NOT NULL,
	`grand_total` real DEFAULT 0 NOT NULL,
	`paid_amount` real DEFAULT 0 NOT NULL,
	`due_amount` real DEFAULT 0 NOT NULL,
	`refunded_amount` real DEFAULT 0 NOT NULL,
	`payment_status` text DEFAULT 'unpaid' NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`cancelled_reason` text,
	`remarks` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	`created_by` text,
	`updated_by` text,
	FOREIGN KEY (`lab_id`) REFERENCES `labs`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`visit_id`) REFERENCES `visits`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`patient_id`) REFERENCES `patients`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `bills_lab_code_idx` ON `bills` (`lab_id`,`code`);--> statement-breakpoint
CREATE INDEX `bills_visit_idx` ON `bills` (`visit_id`);--> statement-breakpoint
CREATE INDEX `bills_pay_status_idx` ON `bills` (`payment_status`);--> statement-breakpoint
CREATE TABLE `payments` (
	`id` text PRIMARY KEY NOT NULL,
	`lab_id` text NOT NULL,
	`code` text NOT NULL,
	`bill_id` text NOT NULL,
	`patient_id` text NOT NULL,
	`amount` real NOT NULL,
	`mode_id` text,
	`mode` text DEFAULT 'Cash' NOT NULL,
	`kind` text DEFAULT 'payment' NOT NULL,
	`reference` text,
	`remarks` text,
	`received_by` text,
	`received_by_name` text,
	`paid_at` integer NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`lab_id`) REFERENCES `labs`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`bill_id`) REFERENCES `bills`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `payments_bill_idx` ON `payments` (`bill_id`);--> statement-breakpoint
CREATE INDEX `payments_paid_at_idx` ON `payments` (`paid_at`);--> statement-breakpoint
CREATE INDEX `payments_received_by_idx` ON `payments` (`received_by`);--> statement-breakpoint
CREATE TABLE `visit_tests` (
	`id` text PRIMARY KEY NOT NULL,
	`visit_id` text NOT NULL,
	`test_id` text NOT NULL,
	`test_name` text NOT NULL,
	`department_id` text,
	`sample_type_id` text,
	`group_id` text,
	`group_name` text,
	`price` real DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'ordered' NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`visit_id`) REFERENCES `visits`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `visit_tests_visit_idx` ON `visit_tests` (`visit_id`);--> statement-breakpoint
CREATE TABLE `visits` (
	`id` text PRIMARY KEY NOT NULL,
	`lab_id` text NOT NULL,
	`code` text NOT NULL,
	`patient_id` text NOT NULL,
	`referred_by` text,
	`priority` text DEFAULT 'normal' NOT NULL,
	`status` text DEFAULT 'registered' NOT NULL,
	`cancelled_reason` text,
	`cancelled_at` integer,
	`cancelled_by` text,
	`visit_date` integer NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	`created_by` text,
	`updated_by` text,
	FOREIGN KEY (`lab_id`) REFERENCES `labs`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`patient_id`) REFERENCES `patients`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `visits_lab_code_idx` ON `visits` (`lab_id`,`code`);--> statement-breakpoint
CREATE INDEX `visits_patient_idx` ON `visits` (`patient_id`);--> statement-breakpoint
CREATE INDEX `visits_status_idx` ON `visits` (`status`);--> statement-breakpoint
CREATE TABLE `result_approvals` (
	`id` text PRIMARY KEY NOT NULL,
	`result_entry_id` text NOT NULL,
	`action` text NOT NULL,
	`reason` text,
	`interpretation` text,
	`actor_id` text,
	`actor_name` text,
	`actor_designation` text,
	`signature_asset_id` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`result_entry_id`) REFERENCES `result_entries`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `result_approvals_entry_idx` ON `result_approvals` (`result_entry_id`);--> statement-breakpoint
CREATE TABLE `result_entries` (
	`id` text PRIMARY KEY NOT NULL,
	`lab_id` text NOT NULL,
	`visit_id` text NOT NULL,
	`visit_test_id` text NOT NULL,
	`test_id` text NOT NULL,
	`test_name` text NOT NULL,
	`sample_id` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`has_abnormal` integer DEFAULT false NOT NULL,
	`has_critical` integer DEFAULT false NOT NULL,
	`technician_remarks` text,
	`interpretation` text,
	`correction_note` text,
	`entered_by` text,
	`entered_by_name` text,
	`submitted_at` integer,
	`approved_by` text,
	`approved_by_name` text,
	`approved_by_designation` text,
	`approved_at` integer,
	`signature_asset_id` text,
	`version` integer DEFAULT 1 NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	`created_by` text,
	`updated_by` text,
	FOREIGN KEY (`lab_id`) REFERENCES `labs`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`visit_id`) REFERENCES `visits`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `result_entries_visit_idx` ON `result_entries` (`visit_id`);--> statement-breakpoint
CREATE INDEX `result_entries_status_idx` ON `result_entries` (`status`);--> statement-breakpoint
CREATE TABLE `result_values` (
	`id` text PRIMARY KEY NOT NULL,
	`result_entry_id` text NOT NULL,
	`parameter_id` text,
	`label` text NOT NULL,
	`value_text` text,
	`value_num` real,
	`unit` text,
	`ref_text` text,
	`ref_low` real,
	`ref_high` real,
	`flag` text DEFAULT 'normal' NOT NULL,
	`remarks` text,
	`display_order` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`result_entry_id`) REFERENCES `result_entries`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `result_values_entry_idx` ON `result_values` (`result_entry_id`);--> statement-breakpoint
CREATE TABLE `result_versions` (
	`id` text PRIMARY KEY NOT NULL,
	`result_entry_id` text NOT NULL,
	`version` integer NOT NULL,
	`snapshot` text NOT NULL,
	`reason` text,
	`actor_id` text,
	`actor_name` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`result_entry_id`) REFERENCES `result_entries`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `result_versions_entry_idx` ON `result_versions` (`result_entry_id`);--> statement-breakpoint
CREATE TABLE `sample_events` (
	`id` text PRIMARY KEY NOT NULL,
	`sample_id` text NOT NULL,
	`from_status` text,
	`to_status` text NOT NULL,
	`note` text,
	`actor_id` text,
	`actor_name` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`sample_id`) REFERENCES `samples`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `sample_events_sample_idx` ON `sample_events` (`sample_id`);--> statement-breakpoint
CREATE TABLE `samples` (
	`id` text PRIMARY KEY NOT NULL,
	`lab_id` text NOT NULL,
	`code` text NOT NULL,
	`visit_id` text NOT NULL,
	`sample_type_id` text,
	`sample_type_name` text,
	`status` text DEFAULT 'waiting' NOT NULL,
	`rejection_reason` text,
	`collected_at` integer,
	`collected_by` text,
	`collected_by_name` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	`created_by` text,
	`updated_by` text,
	FOREIGN KEY (`lab_id`) REFERENCES `labs`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`visit_id`) REFERENCES `visits`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `samples_lab_code_idx` ON `samples` (`lab_id`,`code`);--> statement-breakpoint
CREATE INDEX `samples_visit_idx` ON `samples` (`visit_id`);--> statement-breakpoint
CREATE INDEX `samples_status_idx` ON `samples` (`status`);--> statement-breakpoint
CREATE TABLE `report_access_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`report_link_id` text NOT NULL,
	`action` text NOT NULL,
	`reason` text,
	`ip` text,
	`user_agent` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`report_link_id`) REFERENCES `report_links`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `report_access_logs_link_idx` ON `report_access_logs` (`report_link_id`);--> statement-breakpoint
CREATE TABLE `report_dispatches` (
	`id` text PRIMARY KEY NOT NULL,
	`lab_id` text NOT NULL,
	`visit_id` text NOT NULL,
	`channel` text NOT NULL,
	`note` text,
	`actor_id` text,
	`actor_name` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`lab_id`) REFERENCES `labs`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`visit_id`) REFERENCES `visits`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `report_dispatches_visit_idx` ON `report_dispatches` (`visit_id`);--> statement-breakpoint
CREATE TABLE `report_links` (
	`id` text PRIMARY KEY NOT NULL,
	`lab_id` text NOT NULL,
	`visit_id` text NOT NULL,
	`token` text NOT NULL,
	`is_active` integer DEFAULT false NOT NULL,
	`activated_at` integer,
	`view_count` integer DEFAULT 0 NOT NULL,
	`last_viewed_at` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`lab_id`) REFERENCES `labs`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`visit_id`) REFERENCES `visits`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `report_links_token_unique` ON `report_links` (`token`);--> statement-breakpoint
CREATE INDEX `report_links_token_idx` ON `report_links` (`token`);--> statement-breakpoint
CREATE INDEX `report_links_visit_idx` ON `report_links` (`visit_id`);--> statement-breakpoint
CREATE TABLE `report_templates` (
	`id` text PRIMARY KEY NOT NULL,
	`lab_id` text NOT NULL,
	`name` text NOT NULL,
	`config` text,
	`is_default` integer DEFAULT false NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	`created_by` text,
	`updated_by` text,
	FOREIGN KEY (`lab_id`) REFERENCES `labs`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `activity_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`lab_id` text NOT NULL,
	`actor_id` text,
	`actor_name` text,
	`type` text NOT NULL,
	`message` text NOT NULL,
	`entity` text,
	`entity_id` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`lab_id`) REFERENCES `labs`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `activity_logs_lab_created_idx` ON `activity_logs` (`lab_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `app_settings` (
	`id` text PRIMARY KEY NOT NULL,
	`key` text NOT NULL,
	`value` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `app_settings_key_unique` ON `app_settings` (`key`);--> statement-breakpoint
CREATE TABLE `audit_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`lab_id` text,
	`actor_id` text,
	`actor_name` text,
	`action` text NOT NULL,
	`entity` text,
	`entity_id` text,
	`summary` text,
	`meta` text,
	`ip` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`lab_id`) REFERENCES `labs`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `audit_logs_entity_idx` ON `audit_logs` (`entity`,`entity_id`);--> statement-breakpoint
CREATE INDEX `audit_logs_actor_idx` ON `audit_logs` (`actor_id`);--> statement-breakpoint
CREATE INDEX `audit_logs_created_idx` ON `audit_logs` (`created_at`);--> statement-breakpoint
CREATE TABLE `counters` (
	`id` text PRIMARY KEY NOT NULL,
	`lab_id` text NOT NULL,
	`entity` text NOT NULL,
	`period` text DEFAULT 'all' NOT NULL,
	`value` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`lab_id`) REFERENCES `labs`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `counters_lab_entity_period_uniq` ON `counters` (`lab_id`,`entity`,`period`);--> statement-breakpoint
CREATE TABLE `sms_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`lab_id` text NOT NULL,
	`visit_id` text,
	`to_phone` text NOT NULL,
	`body` text NOT NULL,
	`purpose` text DEFAULT 'other' NOT NULL,
	`provider` text DEFAULT 'mock' NOT NULL,
	`status` text DEFAULT 'queued' NOT NULL,
	`provider_message_id` text,
	`error` text,
	`attempts` integer DEFAULT 0 NOT NULL,
	`sent_by` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`lab_id`) REFERENCES `labs`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `sms_logs_visit_idx` ON `sms_logs` (`visit_id`);--> statement-breakpoint
CREATE INDEX `sms_logs_status_idx` ON `sms_logs` (`status`);