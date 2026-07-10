import { describe, expect, it } from "vitest";
import type { AgentTemplate, Task, TeamMember } from "../../drizzle/schema";
import { buildAgentTemplateSnapshot } from "./agentVersionService";
import { createAgentFingerprint } from "./agentFingerprint";
import { findBestAgentTemplateMatch, scoreAgentTemplate } from "./agentMatcher";
import { buildAgentRunInputContext } from "../execution/executionContextBuilder";

const baseTemplate: AgentTemplate = {
  id: 1,
  organizationId: 10,
  name: "Research Analyst",
  slug: "research-analyst",
  role: "Research Analyst",
  description: "Gather and synthesize company and market information.",
  goal: "Produce clear research summaries.",
  backstory: null,
  defaultInstructions: ["Separate facts from assumptions"],
  capabilities: ["market research", "source evaluation"],
  toolPermissions: [],
  status: "active",
  source: "generated",
  version: 1,
  fingerprint: "abc",
  usageCount: 12,
  successCount: 10,
  failureCount: 2,
  createdAt: new Date("2026-01-01T00:00:00Z"),
  updatedAt: new Date("2026-01-01T00:00:00Z"),
};

describe("reusable agent architecture", () => {
  it("creates stable fingerprints independent of punctuation and capability order", () => {
    const first = createAgentFingerprint({
      role: "Research Analyst!",
      capabilities: ["Source Evaluation", "Market Research"],
      defaultInstructions: ["Separate facts from assumptions."],
    });
    const second = createAgentFingerprint({
      role: "research analyst",
      capabilities: ["market research", "source evaluation"],
      defaultInstructions: ["separate facts from assumptions"],
    });

    expect(first).toBe(second);
  });

  it("matches compatible templates and respects the reuse threshold", () => {
    const input = {
      name: "Research Analyst",
      responsibility: "Gather and synthesize market information.",
      requiredCapabilities: ["market research", "source evaluation"],
      taskSpecificInstructions: ["Separate facts from assumptions"],
    };

    expect(scoreAgentTemplate(baseTemplate, input)).toBeGreaterThan(0.78);
    expect(findBestAgentTemplateMatch([baseTemplate], input, 0.78)?.template.id).toBe(1);
    expect(findBestAgentTemplateMatch([baseTemplate], input, 0.99)).toBeNull();
  });

  it("excludes usage counters from version snapshots", () => {
    const snapshot = buildAgentTemplateSnapshot(baseTemplate);

    expect(snapshot).toMatchObject({
      id: 1,
      version: 1,
      name: "Research Analyst",
    });
    expect(snapshot).not.toHaveProperty("usageCount");
    expect(snapshot).not.toHaveProperty("successCount");
    expect(snapshot).not.toHaveProperty("failureCount");
  });

  it("builds isolated run context from task and upstream artifact references only", () => {
    const task: Task = {
      id: 20,
      organizationId: 10,
      userId: 3,
      agentIds: [],
      title: "Assess an investment",
      description: "Assess Woolworths as an investment opportunity.",
      source: "custom",
      status: "team_ready",
      workflowType: "sequential",
      taskTeamId: 30,
      executionBlueprintId: 40,
      result: null,
      error: null,
      executionStartedAt: null,
      executionCompletedAt: null,
      createdAt: new Date("2026-01-01T00:00:00Z"),
      updatedAt: new Date("2026-01-01T00:00:00Z"),
    };
    const teamMember: TeamMember = {
      id: 50,
      organizationId: 10,
      taskTeamId: 30,
      taskId: 20,
      agentTemplateId: 1,
      agentTemplateVersion: 1,
      workflowOrder: 1,
      roleKey: "research_analyst",
      taskSpecificInstructions: ["Focus on public company information"],
      expectedOutput: "Research report",
      dependsOnTeamMemberIds: [],
      createdAt: new Date("2026-01-01T00:00:00Z"),
    };

    const context = buildAgentRunInputContext({
      task,
      teamMember,
      agentTemplate: baseTemplate,
      upstreamArtifacts: [{ artifactId: 70, artifactType: "research", title: "Prior step" }],
    });

    expect(context.workspaceContext).toEqual({
      organizationId: 10,
      taskId: 20,
      agentTemplateId: 1,
      agentTemplateVersion: 1,
    });
    expect(context.taskSummary).toContain("Woolworths");
    expect(context.upstreamArtifacts).toEqual([
      { artifactId: 70, artifactType: "research", title: "Prior step" },
    ]);
    expect(JSON.stringify(context)).not.toContain("unrelated");
  });
});
