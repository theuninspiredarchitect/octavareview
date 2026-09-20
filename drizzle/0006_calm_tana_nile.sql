CREATE TABLE `backups` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`creator` text NOT NULL,
	`created` text NOT NULL,
	`status` text NOT NULL,
	`cursor` integer DEFAULT 0 NOT NULL,
	`total` integer DEFAULT 0 NOT NULL,
	`manifest_key` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_backups_project` ON `backups` (`project_id`);--> statement-breakpoint
CREATE TABLE `photo_group_items` (
	`project_id` text NOT NULL,
	`photo_id` text NOT NULL,
	`group_id` text NOT NULL,
	PRIMARY KEY(`project_id`, `photo_id`)
);
--> statement-breakpoint
CREATE INDEX `idx_photo_group_items_group` ON `photo_group_items` (`project_id`,`group_id`);--> statement-breakpoint
CREATE TABLE `photo_groups` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`name` text NOT NULL,
	`created` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_photo_groups_project_name` ON `photo_groups` (`project_id`,`name`);--> statement-breakpoint
CREATE TABLE `restores` (
	`id` text PRIMARY KEY NOT NULL,
	`backup_id` text NOT NULL,
	`project_id` text NOT NULL,
	`creator` text NOT NULL,
	`mapping` text NOT NULL,
	`cursor` integer DEFAULT 0 NOT NULL,
	`status` text NOT NULL,
	`created` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `thumbnails` (
	`project_id` text NOT NULL,
	`asset_id` text NOT NULL,
	`created` text NOT NULL,
	PRIMARY KEY(`project_id`, `asset_id`)
);
--> statement-breakpoint
CREATE TABLE `upload_parts` (
	`upload_id` text NOT NULL,
	`part` integer NOT NULL,
	`etag` text NOT NULL,
	`size` integer NOT NULL,
	PRIMARY KEY(`upload_id`, `part`)
);
--> statement-breakpoint
CREATE TABLE `uploads` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`creator` text NOT NULL,
	`upload_id` text NOT NULL,
	`object_key` text NOT NULL,
	`category` text NOT NULL,
	`metadata` text NOT NULL,
	`size` integer NOT NULL,
	`mime` text,
	`result` text,
	`expires` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_uploads_project_creator` ON `uploads` (`project_id`,`creator`);--> statement-breakpoint
ALTER TABLE `shares` ADD `scope` text DEFAULT 'sheets' NOT NULL;