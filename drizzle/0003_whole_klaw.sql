CREATE TABLE `attachments` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`task_id` text NOT NULL,
	`name` text NOT NULL,
	`mime` text NOT NULL,
	`size` integer NOT NULL,
	`creator` text NOT NULL,
	`created` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_attachments_project_task` ON `attachments` (`project_id`,`task_id`);--> statement-breakpoint
CREATE TABLE `project_members` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`user_id` text,
	`email` text NOT NULL,
	`name` text NOT NULL,
	`profession` text NOT NULL,
	`access` text NOT NULL,
	`created` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_members_project_email` ON `project_members` (`project_id`,`email`);--> statement-breakpoint
CREATE INDEX `idx_members_user` ON `project_members` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_members_email` ON `project_members` (`email`);--> statement-breakpoint
ALTER TABLE `projects` ADD `owner_profession` text DEFAULT 'architect' NOT NULL;--> statement-breakpoint
ALTER TABLE `shares` ADD `profession` text DEFAULT 'owner' NOT NULL;