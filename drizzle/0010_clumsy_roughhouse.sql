CREATE TABLE `document_drawings` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`source` text NOT NULL,
	`target_id` text NOT NULL,
	`meeting_id` text,
	`page` integer NOT NULL,
	`data` text NOT NULL,
	`creator` text NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`created` text NOT NULL,
	`updated` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_document_drawings_target_page` ON `document_drawings` (`project_id`,`source`,`target_id`,`page`);