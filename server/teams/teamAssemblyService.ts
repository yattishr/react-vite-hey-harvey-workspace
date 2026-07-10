import { and, eq } from "drizzle-orm";
import { tasks, type ExecutionBlueprint } from "../../drizzle/schema";
import { resolveAgentTemplate } from "../agents/agentTemplateService";
import { getDb } from "../db";
import type { BlueprintStep, SuggestedRole } from "../planning/executionBlueprintSchema";
import { createTaskTeam, createTeamMember, updateTaskTeamStatus } from "./taskTeamRepository";

function asSuggestedRoles(value: unknown): SuggestedRole[] {
  return Array.isArray(value) ? (value as SuggestedRole[]) : [];
}

function asWorkflowSteps(value: unknown): BlueprintStep[] {
  return Array.isArray(value) ? (value as BlueprintStep[]) : [];
}

export async function assembleTaskTeam(taskId: number, blueprint: ExecutionBlueprint) {
  const roles = asSuggestedRoles(blueprint.suggestedRoles);
  const steps = asWorkflowSteps(blueprint.workflowSteps).sort((a, b) => a.order - b.order);
  if (roles.length === 0 || steps.length === 0) {
    throw new Error("Execution blueprint does not contain roles and workflow steps");
  }

  const roleByKey = new Map(roles.map(role => [role.roleKey, role]));
  const team = await createTaskTeam({
    organizationId: blueprint.organizationId,
    taskId,
    status: "assembling",
  });

  const stepKeyToMemberId = new Map<string, number>();
  const members = [];
  for (const step of steps) {
    const role = roleByKey.get(step.roleKey);
    if (!role) throw new Error(`Blueprint step references missing role ${step.roleKey}`);

    const resolved = await resolveAgentTemplate({
      organizationId: blueprint.organizationId,
      roleKey: role.roleKey,
      name: role.name,
      responsibility: role.responsibility,
      requiredCapabilities: role.requiredCapabilities,
      taskSpecificInstructions: role.taskSpecificInstructions,
      taskObjective: blueprint.objective,
    });

    const member = await createTeamMember({
      organizationId: blueprint.organizationId,
      taskTeamId: team.id,
      taskId,
      agentTemplateId: resolved.template.id,
      agentTemplateVersion: resolved.template.version,
      workflowOrder: step.order,
      roleKey: role.roleKey,
      taskSpecificInstructions: role.taskSpecificInstructions,
      expectedOutput: step.expectedOutput,
      dependsOnTeamMemberIds: step.dependsOn
        .map(stepKey => stepKeyToMemberId.get(stepKey))
        .filter((id): id is number => typeof id === "number"),
    });

    stepKeyToMemberId.set(step.stepKey, member.id);
    members.push({
      teamMemberId: member.id,
      agentTemplateId: resolved.template.id,
      agentName: resolved.template.name,
      reused: resolved.reused,
      workflowOrder: member.workflowOrder,
    });
  }

  await updateTaskTeamStatus(blueprint.organizationId, team.id, "ready");

  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db
    .update(tasks)
    .set({
      status: "team_ready",
      taskTeamId: team.id,
      executionBlueprintId: blueprint.id,
    })
    .where(and(eq(tasks.organizationId, blueprint.organizationId), eq(tasks.id, taskId)));

  return { taskTeamId: team.id, members };
}
