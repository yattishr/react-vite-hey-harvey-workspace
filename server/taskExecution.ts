import { TRPCError } from "@trpc/server";
import type { Task } from "../drizzle/schema";
import { executeTaskWithAgents } from "./agentOrchestrator";
import {
  executeStoredTaskWithReusableAgents,
  isAgentTeamReuseEnabled,
} from "./orchestration/agentOrchestrator";
import * as db from "./db";

function parseAgentTools(tools: unknown): string[] {
  if (Array.isArray(tools)) return tools.filter((tool): tool is string => typeof tool === "string");
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

export async function executeStoredTask(task: Task) {
  if (task.status === "running") {
    throw new TRPCError({
      code: "CONFLICT",
      message: "Task is already running",
    });
  }

  if (isAgentTeamReuseEnabled()) {
    const execution = await executeStoredTaskWithReusableAgents(task);
    const refreshedTask = await db.getTaskById(task.id);
    return {
      success: execution.status === "completed",
      result: refreshedTask?.result ?? null,
      taskId: task.id,
      taskTeamId: execution.taskTeamId,
      status: execution.status,
      finalArtifacts: execution.finalArtifacts,
    };
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
      if (!agent || agent.userId !== task.userId || agent.organizationId !== task.organizationId) {
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

    return { success: result.success, result: result.result, taskId: task.id };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    await db.updateTask(task.id, {
      status: "failed",
      error: errorMessage,
      executionCompletedAt: new Date(),
    });
    throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: errorMessage });
  }
}
