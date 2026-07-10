ALTER TYPE "taskStatus" ADD VALUE IF NOT EXISTS 'draft';
--> statement-breakpoint
ALTER TYPE "taskStatus" ADD VALUE IF NOT EXISTS 'planning';
--> statement-breakpoint
ALTER TYPE "taskStatus" ADD VALUE IF NOT EXISTS 'team_ready';
--> statement-breakpoint
ALTER TYPE "taskStatus" ADD VALUE IF NOT EXISTS 'cancelled';
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "taskSource" AS ENUM('predefined', 'custom');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "taskWorkflowType" AS ENUM('sequential');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "agentTemplateStatus" AS ENUM('active', 'inactive', 'archived');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "agentTemplateSource" AS ENUM('system', 'generated', 'user_created', 'migrated');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "taskTeamStatus" AS ENUM('assembling', 'ready', 'running', 'completed', 'failed', 'cancelled');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "agentRunStatus" AS ENUM('pending', 'queued', 'running', 'completed', 'failed', 'cancelled');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "taskArtifactType" AS ENUM('research', 'analysis', 'strategy', 'draft', 'review', 'report', 'structured_data', 'other');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "source" "taskSource" DEFAULT 'custom' NOT NULL;
--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "workflowType" "taskWorkflowType" DEFAULT 'sequential' NOT NULL;
--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "taskTeamId" integer;
--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "executionBlueprintId" integer;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "agentTemplates" (
	"id" serial PRIMARY KEY NOT NULL,
	"organizationId" integer NOT NULL,
	"name" varchar(255) NOT NULL,
	"slug" varchar(255) NOT NULL,
	"role" varchar(255) NOT NULL,
	"description" text NOT NULL,
	"goal" text NOT NULL,
	"backstory" text,
	"defaultInstructions" json DEFAULT '[]'::json NOT NULL,
	"capabilities" json DEFAULT '[]'::json NOT NULL,
	"toolPermissions" json DEFAULT '[]'::json NOT NULL,
	"status" "agentTemplateStatus" DEFAULT 'active' NOT NULL,
	"source" "agentTemplateSource" DEFAULT 'generated' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"fingerprint" varchar(128) NOT NULL,
	"usageCount" integer DEFAULT 0 NOT NULL,
	"successCount" integer DEFAULT 0 NOT NULL,
	"failureCount" integer DEFAULT 0 NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "agentTemplates_organizationId_fingerprint_unique" ON "agentTemplates" ("organizationId","fingerprint");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "agentTemplates_organizationId_slug_unique" ON "agentTemplates" ("organizationId","slug");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "agentTemplateVersions" (
	"id" serial PRIMARY KEY NOT NULL,
	"organizationId" integer NOT NULL,
	"agentTemplateId" integer NOT NULL,
	"version" integer NOT NULL,
	"snapshot" json NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "agentTemplateVersions_template_version_unique" ON "agentTemplateVersions" ("agentTemplateId","version");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "agentTemplateVersions_organizationId_idx" ON "agentTemplateVersions" ("organizationId");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "executionBlueprints" (
	"id" serial PRIMARY KEY NOT NULL,
	"organizationId" integer NOT NULL,
	"taskId" integer NOT NULL,
	"objective" text NOT NULL,
	"deliverables" json DEFAULT '[]'::json NOT NULL,
	"requiredCapabilities" json DEFAULT '[]'::json NOT NULL,
	"suggestedRoles" json DEFAULT '[]'::json NOT NULL,
	"workflowSteps" json DEFAULT '[]'::json NOT NULL,
	"assumptions" json DEFAULT '[]'::json NOT NULL,
	"constraints" json DEFAULT '[]'::json NOT NULL,
	"risks" json DEFAULT '[]'::json NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "executionBlueprints_organizationId_taskId_idx" ON "executionBlueprints" ("organizationId","taskId");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "taskTeams" (
	"id" serial PRIMARY KEY NOT NULL,
	"organizationId" integer NOT NULL,
	"taskId" integer NOT NULL,
	"status" "taskTeamStatus" DEFAULT 'assembling' NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"completedAt" timestamp
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "taskTeams_organizationId_taskId_idx" ON "taskTeams" ("organizationId","taskId");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "teamMembers" (
	"id" serial PRIMARY KEY NOT NULL,
	"organizationId" integer NOT NULL,
	"taskTeamId" integer NOT NULL,
	"taskId" integer NOT NULL,
	"agentTemplateId" integer NOT NULL,
	"agentTemplateVersion" integer NOT NULL,
	"workflowOrder" integer NOT NULL,
	"roleKey" varchar(255) NOT NULL,
	"taskSpecificInstructions" json DEFAULT '[]'::json NOT NULL,
	"expectedOutput" text NOT NULL,
	"dependsOnTeamMemberIds" json DEFAULT '[]'::json NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "teamMembers_organizationId_taskTeamId_idx" ON "teamMembers" ("organizationId","taskTeamId");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "agentRuns" (
	"id" serial PRIMARY KEY NOT NULL,
	"organizationId" integer NOT NULL,
	"taskId" integer NOT NULL,
	"taskTeamId" integer NOT NULL,
	"teamMemberId" integer NOT NULL,
	"agentTemplateId" integer NOT NULL,
	"agentTemplateVersion" integer NOT NULL,
	"status" "agentRunStatus" DEFAULT 'pending' NOT NULL,
	"inputContext" json NOT NULL,
	"output" json,
	"error" json,
	"model" varchar(255),
	"promptVersion" varchar(64),
	"tokenUsage" json,
	"estimatedCost" integer,
	"startedAt" timestamp,
	"completedAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "agentRuns_organizationId_taskTeamId_idx" ON "agentRuns" ("organizationId","taskTeamId");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "taskArtifacts" (
	"id" serial PRIMARY KEY NOT NULL,
	"organizationId" integer NOT NULL,
	"taskId" integer NOT NULL,
	"taskTeamId" integer NOT NULL,
	"agentRunId" integer NOT NULL,
	"artifactType" "taskArtifactType" DEFAULT 'other' NOT NULL,
	"title" varchar(255) NOT NULL,
	"content" json NOT NULL,
	"mimeType" varchar(255),
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "taskArtifacts_organizationId_taskTeamId_idx" ON "taskArtifacts" ("organizationId","taskTeamId");
