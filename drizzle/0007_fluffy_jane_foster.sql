CREATE TABLE `specification_groups` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`name` text NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`created` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_specification_groups_project_name` ON `specification_groups` (`project_id`,`name`);--> statement-breakpoint
CREATE TABLE `specifications` (
	`id` text NOT NULL,
	`project_id` text NOT NULL,
	`data` text NOT NULL,
	`creator` text NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`created` text NOT NULL,
	`updated` text NOT NULL,
	PRIMARY KEY(`project_id`, `id`)
);
