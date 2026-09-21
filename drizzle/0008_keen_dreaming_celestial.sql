CREATE TABLE `account_links` (
	`token_hash` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`member_id` text NOT NULL,
	`email` text NOT NULL,
	`purpose` text NOT NULL,
	`auth_hash` text NOT NULL,
	`creator` text NOT NULL,
	`created` integer NOT NULL,
	`expires` integer NOT NULL,
	`used` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_account_links_creator_created` ON `account_links` (`creator`,`created`);--> statement-breakpoint
CREATE INDEX `idx_account_links_email` ON `account_links` (`email`);