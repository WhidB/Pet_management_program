CREATE TABLE `runtime_status` (
	`id` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `subscriptions` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`endpoint` text NOT NULL,
	`created` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `subscriptions_endpoint` ON `subscriptions` (`endpoint`);--> statement-breakpoint
CREATE INDEX `subscriptions_owner` ON `subscriptions` (`owner`);