CREATE TYPE "public"."taskRuntime" AS ENUM('legacy', 'openai_agents_sdk');
CREATE TYPE "public"."taskRunStatus" AS ENUM('queued', 'running', 'succeeded', 'failed', 'cancel_requested', 'cancelled', 'timed_out');
CREATE TYPE "public"."runtimeStepStatus" AS ENUM('pending', 'running', 'retrying', 'succeeded', 'failed', 'cancelled', 'timed_out');

CREATE TABLE "taskRuns" (
  "id" serial PRIMARY KEY NOT NULL,
  "organizationId" integer NOT NULL,
  "userId" integer NOT NULL,
  "taskId" integer NOT NULL,
  "taskTeamId" integer,
  "runtime" "taskRuntime" NOT NULL,
  "status" "taskRunStatus" DEFAULT 'queued' NOT NULL,
  "correlationId" varchar(64) NOT NULL,
  "eventSequence" integer DEFAULT 0 NOT NULL,
  "openaiTraceId" varchar(64),
  "currentTeamMemberId" integer,
  "finalArtifactId" integer,
  "errorCode" varchar(64),
  "errorMessage" text,
  "startedAt" timestamp,
  "completedAt" timestamp,
  "cancelledAt" timestamp,
  "failedAt" timestamp,
  "createdAt" timestamp DEFAULT now() NOT NULL,
  "updatedAt" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE "runtimeEvents" (
  "id" serial PRIMARY KEY NOT NULL,
  "organizationId" integer NOT NULL,
  "taskRunId" integer NOT NULL,
  "agentRunId" integer,
  "sequence" integer NOT NULL,
  "type" varchar(64) NOT NULL,
  "payload" json DEFAULT '{}'::json NOT NULL,
  "createdAt" timestamp DEFAULT now() NOT NULL
);

ALTER TABLE "agentRuns" ADD COLUMN "taskRunId" integer;
ALTER TABLE "agentRuns" ADD COLUMN "attempt" integer DEFAULT 1 NOT NULL;
ALTER TABLE "agentRuns" ADD COLUMN "runtimeStatus" "runtimeStepStatus" DEFAULT 'pending' NOT NULL;
ALTER TABLE "agentRuns" ADD COLUMN "runtimeIdentifier" varchar(255);
ALTER TABLE "agentRuns" ADD COLUMN "correlationId" varchar(64);
ALTER TABLE "agentRuns" ADD COLUMN "openaiTraceId" varchar(64);
ALTER TABLE "agentRuns" ADD COLUMN "errorCode" varchar(64);
ALTER TABLE "agentRuns" ADD COLUMN "errorMessage" text;
ALTER TABLE "taskArtifacts" ADD COLUMN "taskRunId" integer;
ALTER TABLE "taskArtifacts" ADD COLUMN "schemaVersion" integer DEFAULT 1 NOT NULL;
ALTER TABLE "taskArtifacts" ADD COLUMN "contentText" text;

CREATE INDEX "taskRuns_organizationId_id_idx" ON "taskRuns" USING btree ("organizationId", "id");
CREATE INDEX "taskRuns_organizationId_taskId_createdAt_idx" ON "taskRuns" USING btree ("organizationId", "taskId", "createdAt");
CREATE UNIQUE INDEX "runtimeEvents_taskRunId_sequence_unique" ON "runtimeEvents" USING btree ("taskRunId", "sequence");
CREATE INDEX "runtimeEvents_organizationId_taskRunId_sequence_idx" ON "runtimeEvents" USING btree ("organizationId", "taskRunId", "sequence");
CREATE INDEX "agentRuns_organizationId_taskRunId_idx" ON "agentRuns" USING btree ("organizationId", "taskRunId");
CREATE INDEX "taskArtifacts_organizationId_taskRunId_idx" ON "taskArtifacts" USING btree ("organizationId", "taskRunId");
