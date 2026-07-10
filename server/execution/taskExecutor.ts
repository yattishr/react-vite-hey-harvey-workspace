import { TRPCError } from "@trpc/server";
import { eq, and } from "drizzle-orm";
import { tasks, type Task } from "../../drizzle/schema";
import { ENV } from "../_core/env";
import { invokeLLM } from "../_core/llm";
import { getAgentTemplateById } from "../agents/agentTemplateRepository";
import {
  incrementAgentTemplateFailure,
  incrementAgentTemplateSuccess,
} from "../agents/agentTemplateService";
import { getDb } from "../db";
import { getTaskTeam, getOrderedTeamMembers, updateTaskTeamStatus } from "../teams/taskTeamRepository";
import {
  createAgentRun,
  getAgentRunsByTaskTeam,
  getCompletedAgentRunsForTeamMembers,
  updateAgentRun,
} from "./agentRunRepository";
import {
  createTaskArtifact,
  getArtifactsByAgentRunIds,
  getArtifactsByTaskTeam,
  toArtifactReference,
} from "./artifactRepository";
import { buildAgentExecutionPrompt, buildAgentRunInputContext } from "./executionContextBuilder";

function normalizeError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return {
    code: "AGENT_RUN_FAILED",
    message,
    retryable: true,
  };
}

function stringifyArtifactContent(content: unknown) {
  if (typeof content === "string") return content;
  try {
    return JSON.stringify(content, null, 2);
  } catch {
    return String(content);
  }
}

async function updateTaskStatus(
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

export async function executeTaskTeam(task: Task, taskTeamId: number) {
  const team = await getTaskTeam(task.organizationId, taskTeamId);
  if (!team || team.taskId !== task.id) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Task team not found" });
  }

  const members = await getOrderedTeamMembers(task.organizationId, taskTeamId);
  if (members.length === 0) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Task team has no members" });
  }

  await updateTaskTeamStatus(task.organizationId, team.id, "running");
  await updateTaskStatus(task.organizationId, task.id, {
    status: "running",
    result: null,
    error: null,
    executionStartedAt: new Date(),
    executionCompletedAt: null,
  });

  const completedRunIdsByTeamMember = new Map<number, number>();
  const finalArtifactRefs = [];

  try {
    for (const member of members) {
      const template = await getAgentTemplateById(task.organizationId, member.agentTemplateId);
      if (!template) {
        throw new Error(`Agent template ${member.agentTemplateId} not found`);
      }

      const dependencyRuns = await getCompletedAgentRunsForTeamMembers(
        task.organizationId,
        member.dependsOnTeamMemberIds
      );
      for (const dependencyRun of dependencyRuns) {
        completedRunIdsByTeamMember.set(dependencyRun.teamMemberId, dependencyRun.id);
      }

      const upstreamArtifacts = await getArtifactsByAgentRunIds(
        task.organizationId,
        Array.from(completedRunIdsByTeamMember.values())
      );
      const upstreamRefs = upstreamArtifacts.map(toArtifactReference);
      const runContext = buildAgentRunInputContext({
        task,
        teamMember: member,
        agentTemplate: template,
        upstreamArtifacts: upstreamRefs,
      });

      const run = await createAgentRun({
        organizationId: task.organizationId,
        taskId: task.id,
        taskTeamId: team.id,
        teamMemberId: member.id,
        agentTemplateId: template.id,
        agentTemplateVersion: member.agentTemplateVersion,
        status: "pending",
        inputContext: { ...runContext },
        model: ENV.llmModel,
        promptVersion: "v1.1",
      });

      await updateAgentRun(task.organizationId, run.id, {
        status: "running",
        startedAt: new Date(),
      });

      const upstreamArtifactText = upstreamArtifacts
        .map(artifact => `${artifact.title}\n${stringifyArtifactContent(artifact.content)}`)
        .join("\n\n");

      const response = await invokeLLM({
        messages: [
          {
            role: "system",
            content:
              "You are executing one isolated Hey Harvey task-team run. Use only the provided task context and upstream artifacts.",
          },
          {
            role: "user",
            content: buildAgentExecutionPrompt({
              agentTemplate: template,
              teamMember: member,
              runContext,
              upstreamArtifactText,
            }),
          },
        ],
      });

      const content =
        typeof response.choices[0]?.message?.content === "string"
          ? response.choices[0].message.content
          : "";

      const artifact = await createTaskArtifact({
        organizationId: task.organizationId,
        taskId: task.id,
        taskTeamId: team.id,
        agentRunId: run.id,
        artifactType: member.workflowOrder === members.length ? "report" : "analysis",
        title: `${template.name} output`,
        content,
        mimeType: "text/plain",
      });

      const output = {
        summary: content.slice(0, 500),
        content,
        artifacts: [toArtifactReference(artifact)],
      };

      await updateAgentRun(task.organizationId, run.id, {
        status: "completed",
        output,
        completedAt: new Date(),
      });
      await incrementAgentTemplateSuccess(task.organizationId, template.id);
      completedRunIdsByTeamMember.set(member.id, run.id);
      finalArtifactRefs.push(toArtifactReference(artifact));
    }

    const artifacts = await getArtifactsByTaskTeam(task.organizationId, team.id);
    const finalResult = artifacts
      .map(artifact => `## ${artifact.title}\n\n${stringifyArtifactContent(artifact.content)}`)
      .join("\n\n");

    await updateTaskTeamStatus(task.organizationId, team.id, "completed");
    await updateTaskStatus(task.organizationId, task.id, {
      status: "completed",
      result: finalResult,
      error: null,
      executionCompletedAt: new Date(),
    });

    return {
      taskId: task.id,
      taskTeamId: team.id,
      status: "completed" as const,
      finalArtifacts: finalArtifactRefs,
    };
  } catch (error) {
    const normalized = normalizeError(error);
    const runs = await getAgentRunsByTaskTeam(task.organizationId, team.id);
    const activeRun = runs.find(run => run.status === "pending" || run.status === "running");
    if (activeRun) {
      await updateAgentRun(task.organizationId, activeRun.id, {
        status: "failed",
        error: normalized,
        completedAt: new Date(),
      });
      await incrementAgentTemplateFailure(task.organizationId, activeRun.agentTemplateId);
    }

    await updateTaskTeamStatus(task.organizationId, team.id, "failed");
    await updateTaskStatus(task.organizationId, task.id, {
      status: "failed",
      error: normalized.message,
      executionCompletedAt: new Date(),
    });
    throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: normalized.message });
  }
}
