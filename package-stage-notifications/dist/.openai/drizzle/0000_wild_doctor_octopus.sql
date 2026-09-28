CREATE TABLE `documents` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`pet_id` text NOT NULL,
	`name` text NOT NULL,
	`mime` text NOT NULL,
	`hash` text NOT NULL,
	`object_key` text NOT NULL,
	`purpose` text NOT NULL,
	`status` text NOT NULL,
	`data` text DEFAULT '{}' NOT NULL,
	`created` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `document_hash` ON `documents` (`owner`,`pet_id`,`hash`,`purpose`);--> statement-breakpoint
CREATE INDEX `documents_owner` ON `documents` (`owner`);--> statement-breakpoint
CREATE TABLE `instances` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`schedule_id` text NOT NULL,
	`at` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`override` text,
	`snooze` text,
	`updated` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `instance_occurrence` ON `instances` (`schedule_id`,`at`);--> statement-breakpoint
CREATE INDEX `instances_owner` ON `instances` (`owner`);--> statement-breakpoint
CREATE TABLE `notifications` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`schedule_id` text NOT NULL,
	`at` text NOT NULL,
	`due` text NOT NULL,
	`title` text NOT NULL,
	`state` text DEFAULT 'pending' NOT NULL,
	`device_claim` text,
	`version` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `notifications_due` ON `notifications` (`owner`,`state`,`due`);--> statement-breakpoint
CREATE TABLE `pets` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`data` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `pets_owner` ON `pets` (`owner`);--> statement-breakpoint
CREATE TABLE `profiles` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`timezone` text NOT NULL,
	`created` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `records` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`pet_id` text NOT NULL,
	`document_id` text NOT NULL,
	`data` text NOT NULL,
	`created` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `record_document` ON `records` (`owner`,`document_id`);--> statement-breakpoint
CREATE INDEX `records_owner` ON `records` (`owner`);--> statement-breakpoint
CREATE TABLE `schedules` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`pet_id` text NOT NULL,
	`data` text NOT NULL,
	`cutoff` text,
	`version` integer DEFAULT 1 NOT NULL,
	`deleted` integer DEFAULT 0 NOT NULL,
	`source_key` text
);
--> statement-breakpoint
CREATE INDEX `schedules_owner` ON `schedules` (`owner`);--> statement-breakpoint
CREATE UNIQUE INDEX `schedule_source` ON `schedules` (`owner`,`source_key`);