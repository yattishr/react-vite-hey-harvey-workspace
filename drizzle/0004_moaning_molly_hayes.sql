CREATE TABLE `organizationMembers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`userId` int NOT NULL,
	`role` enum('owner','admin','member') NOT NULL DEFAULT 'member',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `organizationMembers_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `organizations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`slug` varchar(255) NOT NULL,
	`createdByUserId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `organizations_id` PRIMARY KEY(`id`),
	CONSTRAINT `organizations_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
ALTER TABLE `users` RENAME COLUMN `openId` TO `supabaseUserId`;--> statement-breakpoint
ALTER TABLE `users` DROP INDEX `users_openId_unique`;--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `supabaseUserId` varchar(36) NOT NULL;--> statement-breakpoint
INSERT INTO `organizations` (`name`, `slug`, `createdByUserId`)
SELECT COALESCE(NULLIF(`name`, ''), `email`, CONCAT('User ', `id`)), CONCAT('user-', `id`), `id`
FROM `users`;--> statement-breakpoint
INSERT INTO `organizationMembers` (`organizationId`, `userId`, `role`)
SELECT `organizations`.`id`, `users`.`id`, 'owner'
FROM `users`
INNER JOIN `organizations` ON `organizations`.`createdByUserId` = `users`.`id`
WHERE `organizations`.`slug` = CONCAT('user-', `users`.`id`);--> statement-breakpoint
ALTER TABLE `agents` ADD `organizationId` int;--> statement-breakpoint
ALTER TABLE `conversations` ADD `organizationId` int;--> statement-breakpoint
ALTER TABLE `tasks` ADD `organizationId` int;--> statement-breakpoint
ALTER TABLE `workflowExecutions` ADD `organizationId` int;--> statement-breakpoint
ALTER TABLE `workflows` ADD `organizationId` int;--> statement-breakpoint
UPDATE `agents`
INNER JOIN `organizations` ON `organizations`.`createdByUserId` = `agents`.`userId`
SET `agents`.`organizationId` = `organizations`.`id`;--> statement-breakpoint
UPDATE `conversations`
INNER JOIN `organizations` ON `organizations`.`createdByUserId` = `conversations`.`userId`
SET `conversations`.`organizationId` = `organizations`.`id`;--> statement-breakpoint
UPDATE `tasks`
INNER JOIN `organizations` ON `organizations`.`createdByUserId` = `tasks`.`userId`
SET `tasks`.`organizationId` = `organizations`.`id`;--> statement-breakpoint
UPDATE `workflows`
INNER JOIN `organizations` ON `organizations`.`createdByUserId` = `workflows`.`userId`
SET `workflows`.`organizationId` = `organizations`.`id`;--> statement-breakpoint
UPDATE `workflowExecutions`
INNER JOIN `organizations` ON `organizations`.`createdByUserId` = `workflowExecutions`.`userId`
SET `workflowExecutions`.`organizationId` = `organizations`.`id`;--> statement-breakpoint
ALTER TABLE `agents` MODIFY COLUMN `organizationId` int NOT NULL;--> statement-breakpoint
ALTER TABLE `conversations` MODIFY COLUMN `organizationId` int NOT NULL;--> statement-breakpoint
ALTER TABLE `tasks` MODIFY COLUMN `organizationId` int NOT NULL;--> statement-breakpoint
ALTER TABLE `workflowExecutions` MODIFY COLUMN `organizationId` int NOT NULL;--> statement-breakpoint
ALTER TABLE `workflows` MODIFY COLUMN `organizationId` int NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD CONSTRAINT `users_supabaseUserId_unique` UNIQUE(`supabaseUserId`);
