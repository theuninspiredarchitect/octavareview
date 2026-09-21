CREATE TABLE `meeting_reports` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`meeting_id` text NOT NULL,
	`revision` integer NOT NULL,
	`data` text NOT NULL,
	`created` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_meeting_reports_revision` ON `meeting_reports` (`project_id`,`meeting_id`,`revision`);--> statement-breakpoint
CREATE TABLE `meetings` (
	`id` text NOT NULL,
	`project_id` text NOT NULL,
	`data` text NOT NULL,
	`creator` text NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`created` text NOT NULL,
	`updated` text NOT NULL,
	PRIMARY KEY(`project_id`, `id`)
);
