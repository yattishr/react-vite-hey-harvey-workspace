import type { Task } from "../../drizzle/schema";
import { createExecutionBlueprint, getExecutionBlueprint } from "../planning/executionBlueprintService";
import { assembleTaskTeam } from "../teams/teamAssemblyService";
import { getTaskTeamByTaskId } from "../teams/taskTeamRepository";
import { executeTaskTeam } from "../execution/taskExecutor";

export function isAgentTeamReuseEnabled() {
  return process.env.AGENT_TEAM_REUSE_ENABLED === "true";
}

export async function ensureTaskTeam(task: Task) {
  const existingTeam = await getTaskTeamByTaskId(task.organizationId, task.id);
  if (existingTeam) return existingTeam.id;

  const blueprintId = task.executionBlueprintId;
  const blueprint = blueprintId
    ? await getExecutionBlueprint(task.organizationId, blueprintId)
    : await createExecutionBlueprint(task);

  if (!blueprint) throw new Error("Failed to create execution blueprint");
  const assembled = await assembleTaskTeam(task.id, blueprint);
  return assembled.taskTeamId;
}

export async function executeStoredTaskWithReusableAgents(task: Task) {
  const taskTeamId = await ensureTaskTeam(task);
  return executeTaskTeam(task, taskTeamId);
}
