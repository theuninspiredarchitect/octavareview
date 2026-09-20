CREATE TABLE `files` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`name` text NOT NULL,
	`created` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_files_project` ON `files` (`project_id`);--> statement-breakpoint
CREATE TABLE `projects` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`name` text NOT NULL,
	`created` text NOT NULL,
	`next_task` integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_projects_owner` ON `projects` (`owner`);--> statement-breakpoint
CREATE TABLE `records` (
	`id` text NOT NULL,
	`project_id` text NOT NULL,
	`type` text NOT NULL,
	`sheet_id` text,
	`data` text NOT NULL,
	`creator` text NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`created` text NOT NULL,
	PRIMARY KEY(`project_id`, `id`)
);
--> statement-breakpoint
CREATE INDEX `idx_records_project_sheet` ON `records` (`project_id`,`sheet_id`);--> statement-breakpoint
CREATE TABLE `shares` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`token_hash` text NOT NULL,
	`role` text NOT NULL,
	`sheet_ids` text NOT NULL,
	`label` text NOT NULL,
	`created` text NOT NULL,
	`revoked` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_shares_token` ON `shares` (`token_hash`);--> statement-breakpoint
CREATE INDEX `idx_shares_project` ON `shares` (`project_id`);