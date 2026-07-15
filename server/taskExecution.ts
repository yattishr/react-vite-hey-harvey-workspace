import { TRPCError } from "@trpc/server";
import { randomUUID } from "node:crypto";
import type { Task, TaskRun } from "../drizzle/schema";
import { getAgentsRuntimeConfig } from "./agents-runtime/config";
import { publishRuntimeEvent } from "./agents-runtime/repositories/event-repository";
import {
  createTaskRun,
  updateTaskRun,
} from "./agents-runtime/repositories/task-run-repository";
import { executeSdkWorkflow } from "./agents-runtime/workflow-executor";
import { executeTaskWithAgents } from "./agentOrchestrator";
import {
  ensureTaskTeam,
  isAgentTeamReuseEnabled,
} from "./orchestration/agentOrchestrator";
import { executeTaskTeam } from "./execution/taskExecutor";
import * as db from "./db";

function parseAgentTools(tools: unknown): string[] {
  if (Array.isArray(tools))
    return tools.filter((tool): tool is string => typeof tool === "string");
  if (typeof tools !== "string" || !tools.trim()) return [];

  try {
    const parsed = JSON.parse(tools);
    return Array.isArray(parsed)
      ? parsed.filter((tool): tool is string => typeof tool === "string")
      : [];
  } catch {
    return [];
  }
}

export async function executeStoredTask(task: Task, preparedTaskRun?: TaskRun) {
  if (task.status === "running") {
    throw new TRPCError({
      code: "CONFLICT",
      message: "Task is already running",
    });
  }

  const runtime =
    preparedTaskRun?.runtime ??
    (getAgentsRuntimeConfig().OPENAI_AGENTS_RUNTIME_ENABLED
      ? "openai_agents_sdk"
      : "legacy");
  let taskRun = preparedTaskRun;
  let taskTeamId: number | null = null;
  try {
    taskTeamId =
      runtime === "openai_agents_sdk" || isAgentTeamReuseEnabled()
        ? await ensureTaskTeam(task)
        : null;

    if (!taskRun) {
      taskRun = await createTaskRun({
        organizationId: task.organizationId,
        userId: task.userId,
        taskId: task.id,
        taskTeamId,
        runtime,
        status: "queued",
        correlationId: randomUUID(),
      });
    } else if (taskRun.taskTeamId !== taskTeamId) {
      const updated = await updateTaskRun(task.organizationId, taskRun.id, {
        taskTeamId,
      });
      if (!updated)
        throw new Error("Failed to attach the task team to the run");
      taskRun = updated;
    }
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to prepare the task run";
    if (taskRun) {
      await updateTaskRun(task.organizationId, taskRun.id, {
        status: "failed",
        errorCode: "RUN_PREPARATION_FAILED",
        errorMessage: message,
        failedAt: new Date(),
        completedAt: new Date(),
      });
      await db.updateTask(task.id, {
        status: "failed",
        error: message,
        executionCompletedAt: new Date(),
      });
    }
    throw error;
  }

  if (runtime === "openai_agents_sdk") {
    try {
      return await executeSdkWorkflow(task, taskRun);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "The task run failed";
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message });
    }
  }

  await updateTaskRun(task.organizationId, taskRun.id, {
    status: "running",
    startedAt: new Date(),
  });
  await publishRuntimeEvent({
    organizationId: task.organizationId,
    taskRunId: taskRun.id,
    type: "run_started",
    payload: { runtime: "legacy" },
  });

  if (taskTeamId) {
    try {
      const execution = await executeTaskTeam(task, taskTeamId, taskRun.id);
      await updateTaskRun(task.organizationId, taskRun.id, {
        status: "succeeded",
        completedAt: new Date(),
      });
      await publishRuntimeEvent({
        organizationId: task.organizationId,
        taskRunId: taskRun.id,
        type: "run_succeeded",
      });
      const refreshedTask = await db.getTaskById(task.id);
      return {
        success: execution.status === "completed",
        result: refreshedTask?.result ?? null,
        taskId: task.id,
        taskTeamId: execution.taskTeamId,
        taskRunId: taskRun.id,
        runtime,
        status: execution.status,
        finalArtifacts: execution.finalArtifacts,
      };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "The task run failed";
      await updateTaskRun(task.organizationId, taskRun.id, {
        status: "failed",
        errorCode: "LEGACY_RUNTIME_FAILED",
        errorMessage: message,
        failedAt: new Date(),
        completedAt: new Date(),
      });
      throw error;
    }
  }

  await db.clearExecutionLogsByTaskId(task.id);

  await db.updateTask(task.id, {
    status: "running",
    result: null,
    error: null,
    executionStartedAt: new Date(),
    executionCompletedAt: null,
  });

  try {
    const agentIds = task.agentIds as number[];
    const agents = [];

    for (const agentId of agentIds) {
      const agent = await db.getAgentById(agentId);
      if (
        !agent ||
        agent.userId !== task.userId ||
        agent.organizationId !== task.organizationId
      ) {
        throw new Error(`Agent ${agentId} not found`);
      }

      agents.push({
        id: agent.id,
        name: agent.name,
        role: agent.role,
        goal: agent.goal,
        backstory: agent.backstory || "",
        tools: parseAgentTools(agent.tools),
      });
    }

    const result = await executeTaskWithAgents({
      description: task.description,
      agentIds,
      agents,
    });

    await db.updateTask(task.id, {
      status: result.success ? "completed" : "failed",
      result: result.result || null,
      error: result.error || null,
      executionCompletedAt: new Date(),
    });

    for (const step of result.steps) {
      await db.addExecutionLog({
        taskId: task.id,
        step: step.step,
        action: step.action,
        details: step.details,
      });
    }

    await updateTaskRun(task.organizationId, taskRun.id, {
      status: result.success ? "succeeded" : "failed",
      completedAt: new Date(),
      failedAt: result.success ? null : new Date(),
      errorCode: result.success ? null : "LEGACY_RUNTIME_FAILED",
      errorMessage: result.error || null,
    });
    await publishRuntimeEvent({
      organizationId: task.organizationId,
      taskRunId: taskRun.id,
      type: result.success ? "run_succeeded" : "run_failed",
    });
    return {
      success: result.success,
      result: result.result,
      taskId: task.id,
      taskRunId: taskRun.id,
      runtime,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    await db.updateTask(task.id, {
      status: "failed",
      error: errorMessage,
      executionCompletedAt: new Date(),
    });
    await updateTaskRun(task.organizationId, taskRun.id, {
      status: "failed",
      errorCode: "LEGACY_RUNTIME_FAILED",
      errorMessage,
      failedAt: new Date(),
      completedAt: new Date(),
    });
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: errorMessage,
    });
  }
}
