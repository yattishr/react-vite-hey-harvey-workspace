import { and, eq } from "drizzle-orm";
import { tasks, type Task, type TaskRun } from "../../drizzle/schema";
import { getAgentTemplateById } from "../agents/agentTemplateRepository";
import {
  incrementAgentTemplateFailure,
  incrementAgentTemplateSuccess,
} from "../agents/agentTemplateService";
import { getDb } from "../db";
import {
  getArtifactsByAgentRunIds,
  getArtifactsByTaskRun,
  toArtifactReference,
} from "../execution/artifactRepository";
import {
  getAgentRunsByTaskRun,
  getCompletedAgentRunsForTeamMembers,
} from "../execution/agentRunRepository";
import {
  getOrderedTeamMembers,
  updateTaskTeamStatus,
} from "../teams/taskTeamRepository";
import { registerActiveRun } from "./cancellation";
import { getAgentsRuntimeConfig } from "./config";
import { asRuntimeError, RuntimeError } from "./errors";
import { logRuntimeEvent } from "./logger";
import { OpenAIAgentsRunnerAdapter } from "./runner";
import { publishRuntimeEvent } from "./repositories/event-repository";
import { getTaskRun, updateTaskRun } from "./repositories/task-run-repository";
import { executeSdkStep } from "./step-executor";
import { combineSignals, createTimeoutSignal } from "./timeout";
import type { AgentsRunnerPort } from "./types";

async function updateTask(
  organizationId: number,
  taskId: number,
  updates: Partial<typeof tasks.$inferInsert>
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db
    .update(tasks)
    .set(updates)
    .where(and(eq(tasks.organizationId, organizationId), eq(tasks.id, taskId)));
}

export async function executeSdkWorkflow(
  task: Task,
  initialTaskRun: TaskRun,
  runner: AgentsRunnerPort = new OpenAIAgentsRunnerAdapter()
) {
  if (!initialTaskRun.taskTeamId)
    throw new Error("SDK task run requires a task team");
  const config = getAgentsRuntimeConfig();
  const controller = new AbortController();
  const runTimeout = createTimeoutSignal(
    config.OPENAI_AGENTS_RUN_TIMEOUT_MS,
    "RUN_TIMEOUT"
  );
  const signal = combineSignals([controller.signal, runTimeout.signal]);
  const unregister = registerActiveRun(initialTaskRun.id, controller);
  const members = await getOrderedTeamMembers(
    task.organizationId,
    initialTaskRun.taskTeamId
  );
  if (members.length === 0) throw new Error("Task team has no members");

  await updateTaskRun(task.organizationId, initialTaskRun.id, {
    status: "running",
    startedAt: new Date(),
  });
  await updateTaskTeamStatus(
    task.organizationId,
    initialTaskRun.taskTeamId,
    "running"
  );
  await updateTask(task.organizationId, task.id, {
    status: "running",
    result: null,
    error: null,
    executionStartedAt: new Date(),
    executionCompletedAt: null,
  });
  await publishRuntimeEvent({
    organizationId: task.organizationId,
    taskRunId: initialTaskRun.id,
    type: "run_started",
    payload: { runtime: initialTaskRun.runtime, stepCount: members.length },
  });

  try {
    for (const member of members) {
      const persistedRun = await getTaskRun(
        task.organizationId,
        initialTaskRun.id
      );
      if (persistedRun?.status === "cancel_requested") {
        throw new RuntimeError("RUN_CANCELLED", "The run was cancelled");
      }
      if (signal.aborted) throw signal.reason;

      const template = await getAgentTemplateById(
        task.organizationId,
        member.agentTemplateId
      );
      if (!template)
        throw new RuntimeError(
          "RUNTIME_COMPILATION_FAILED",
          "Agent template not found"
        );
      await updateTaskRun(task.organizationId, initialTaskRun.id, {
        currentTeamMemberId: member.id,
      });

      const dependencyRuns = await getCompletedAgentRunsForTeamMembers(
        task.organizationId,
        member.dependsOnTeamMemberIds,
        initialTaskRun.id
      );
      const upstreamArtifacts = await getArtifactsByAgentRunIds(
        task.organizationId,
        dependencyRuns.map(run => run.id)
      );
      try {
        await executeSdkStep({
          task,
          taskRun: initialTaskRun,
          member,
          template,
          upstreamArtifacts,
          runner,
          signal,
          model: config.OPENAI_AGENTS_DEFAULT_MODEL,
          maxTurns: config.OPENAI_AGENTS_MAX_TURNS,
          stepTimeoutMs: config.OPENAI_AGENTS_STEP_TIMEOUT_MS,
          maxRetries: config.OPENAI_AGENTS_MAX_STEP_RETRIES,
        });
        await incrementAgentTemplateSuccess(task.organizationId, template.id);
      } catch (error) {
        await incrementAgentTemplateFailure(task.organizationId, template.id);
        throw error;
      }
    }

    const artifacts = await getArtifactsByTaskRun(
      task.organizationId,
      initialTaskRun.id
    );
    const finalResult = artifacts
      .map(artifact => `## ${artifact.title}\n\n${artifact.contentText ?? ""}`)
      .join("\n\n");
    const finalArtifact = artifacts.at(-1);
    const stepRuns = await getAgentRunsByTaskRun(
      task.organizationId,
      initialTaskRun.id
    );
    const finalStepRun = stepRuns
      .filter(run => run.runtimeStatus === "succeeded")
      .at(-1);
    await updateTaskRun(task.organizationId, initialTaskRun.id, {
      status: "succeeded",
      currentTeamMemberId: null,
      finalArtifactId: finalArtifact?.id,
      openaiTraceId: finalStepRun?.openaiTraceId,
      completedAt: new Date(),
    });
    await updateTaskTeamStatus(
      task.organizationId,
      initialTaskRun.taskTeamId,
      "completed"
    );
    await updateTask(task.organizationId, task.id, {
      status: "completed",
      result: finalResult,
      error: null,
      executionCompletedAt: new Date(),
    });
    await publishRuntimeEvent({
      organizationId: task.organizationId,
      taskRunId: initialTaskRun.id,
      type: "run_succeeded",
      payload: { artifactCount: artifacts.length },
    });
    return {
      taskId: task.id,
      taskTeamId: initialTaskRun.taskTeamId,
      taskRunId: initialTaskRun.id,
      runtime: initialTaskRun.runtime,
      status: "completed" as const,
      finalArtifacts: artifacts.map(toArtifactReference),
    };
  } catch (error) {
    const normalized =
      signal.aborted && signal.reason instanceof RuntimeError
        ? signal.reason
        : asRuntimeError(error);
    const cancelled = normalized.code === "RUN_CANCELLED";
    const timedOut =
      normalized.code === "RUN_TIMEOUT" || normalized.code === "STEP_TIMEOUT";
    const status = cancelled ? "cancelled" : timedOut ? "timed_out" : "failed";
    await updateTaskRun(task.organizationId, initialTaskRun.id, {
      status,
      currentTeamMemberId: null,
      errorCode: normalized.code,
      errorMessage: normalized.message,
      completedAt: new Date(),
      cancelledAt: cancelled ? new Date() : null,
      failedAt: !cancelled ? new Date() : null,
    });
    await updateTaskTeamStatus(
      task.organizationId,
      initialTaskRun.taskTeamId,
      cancelled ? "cancelled" : "failed"
    );
    await updateTask(task.organizationId, task.id, {
      status: cancelled ? "cancelled" : "failed",
      error: normalized.message,
      executionCompletedAt: new Date(),
    });
    await publishRuntimeEvent({
      organizationId: task.organizationId,
      taskRunId: initialTaskRun.id,
      type: `run_${status}`,
      payload: { errorCode: normalized.code },
    });
    logRuntimeEvent("error", "run terminated", {
      organizationId: task.organizationId,
      taskRunId: initialTaskRun.id,
      correlationId: initialTaskRun.correlationId,
      errorCode: normalized.code,
    });
    throw normalized;
  } finally {
    unregister();
    runTimeout.clear();
  }
}
