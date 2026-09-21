ALTER TABLE `project_members` ADD `account_role` text DEFAULT 'user' NOT NULL;--> statement-breakpoint
ALTER TABLE `project_members` ADD `enabled` integer DEFAULT 1 NOT NULL;