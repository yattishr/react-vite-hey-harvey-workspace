import type { AgentTemplate, Task, TeamMember } from "../../drizzle/schema";
import type { ArtifactReference } from "./artifactRepository";

export interface AgentRunInputContext {
  taskSummary: string;
  objective: string;
  taskSpecificInstructions: string[];
  workspaceContext: Record<string, unknown>;
  upstreamArtifacts: ArtifactReference[];
}

export function buildAgentRunInputContext(input: {
  task: Task;
  teamMember: TeamMember;
  agentTemplate: AgentTemplate;
  upstreamArtifacts: ArtifactReference[];
}): AgentRunInputContext {
  return {
    taskSummary: input.task.description,
    objective: input.agentTemplate.goal,
    taskSpecificInstructions: input.teamMember.taskSpecificInstructions,
    workspaceContext: {
      organizationId: input.task.organizationId,
      taskId: input.task.id,
      agentTemplateId: input.agentTemplate.id,
      agentTemplateVersion: input.teamMember.agentTemplateVersion,
    },
    upstreamArtifacts: input.upstreamArtifacts,
  };
}

export function buildAgentExecutionPrompt(input: {
  agentTemplate: AgentTemplate;
  teamMember: TeamMember;
  runContext: AgentRunInputContext;
  upstreamArtifactText: string;
}) {
  return `Agent template:
Name: ${input.agentTemplate.name}
Role: ${input.agentTemplate.role}
Goal: ${input.agentTemplate.goal}
Description: ${input.agentTemplate.description}
Default instructions:
${input.agentTemplate.defaultInstructions.map(instruction => `- ${instruction}`).join("\n") || "- None"}

Task:
${input.runContext.taskSummary}

Task-specific instructions:
${input.teamMember.taskSpecificInstructions.map(instruction => `- ${instruction}`).join("\n") || "- None"}

Expected output:
${input.teamMember.expectedOutput}

Upstream artifacts:
${input.upstreamArtifactText || "None"}

Return a concise, structured result for this workflow step.`;
}
