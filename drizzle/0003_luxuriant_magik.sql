CREATE TABLE `workflowExecutionSteps` (
	`id` int AUTO_INCREMENT NOT NULL,
	`executionId` int NOT NULL,
	`stepId` int NOT NULL,
	`agentId` int,
	`status` enum('pending','running','completed','failed','skipped') NOT NULL DEFAULT 'pending',
	`result` text,
	`error` text,
	`startedAt` timestamp,
	`completedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `workflowExecutionSteps_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `workflowExecutions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`workflowId` int NOT NULL,
	`userId` int NOT NULL,
	`status` enum('queued','running','completed','failed','paused') NOT NULL DEFAULT 'queued',
	`result` text,
	`error` text,
	`startedAt` timestamp,
	`completedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `workflowExecutions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `workflowSteps` (
	`id` int AUTO_INCREMENT NOT NULL,
	`workflowId` int NOT NULL,
	`stepNumber` int NOT NULL,
	`agentIds` text,
	`taskDescription` text NOT NULL,
	`dependsOn` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `workflowSteps_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `workflows` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`description` text,
	`executionType` enum('sequential','parallel','conditional') NOT NULL DEFAULT 'sequential',
	`status` enum('draft','active','archived') NOT NULL DEFAULT 'draft',
	`config` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `workflows_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `agents` MODIFY COLUMN `tools` varchar(1000) DEFAULT '[]';