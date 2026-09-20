CREATE TABLE `photo_likes` (
	`project_id` text NOT NULL,
	`photo_id` text NOT NULL,
	`user_id` text NOT NULL,
	`created` text NOT NULL,
	PRIMARY KEY(`project_id`, `photo_id`, `user_id`)
);
--> statement-breakpoint
CREATE INDEX `idx_photo_likes_user` ON `photo_likes` (`project_id`,`user_id`);--> statement-breakpoint
CREATE TABLE `project_documents` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`kind` text NOT NULL,
	`name` text NOT NULL,
	`mime` text NOT NULL,
	`size` integer NOT NULL,
	`creator` text NOT NULL,
	`author` text NOT NULL,
	`author_role` text NOT NULL,
	`created` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_documents_project_kind` ON `project_documents` (`project_id`,`kind`);