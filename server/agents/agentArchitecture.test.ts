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
  roleKey: "research_analyst",
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
      roleKey: "research_analyst",
      capabilities: ["Source Evaluation", "Market Research"],
      defaultInstructions: ["Separate facts from assumptions."],
    });
    const second = createAgentFingerprint({
      roleKey: "research_analyst",
      capabilities: ["market research", "source evaluation"],
      defaultInstructions: ["separate facts from assumptions"],
    });

    expect(first).toBe(second);
  });

  it("matches compatible templates and respects the reuse threshold", () => {
    const input = {
      roleKey: "research_analyst",
      name: "Research Analyst",
      responsibility: "Gather and synthesize market information.",
      requiredCapabilities: ["market research", "source evaluation"],
      taskSpecificInstructions: ["Separate facts from assumptions"],
    };

    expect(scoreAgentTemplate(baseTemplate, input)).toBeGreaterThan(0.78);
    expect(findBestAgentTemplateMatch([baseTemplate], input, 0.78)?.template.id).toBe(1);
    expect(
      findBestAgentTemplateMatch([baseTemplate], {
        ...input,
        requiredCapabilities: ["paid media planning", "campaign analytics"],
      })
    ).toBeNull();
  });

  it("reuses one Risk Analyst template across Woolworths and Standard Bank tasks", () => {
    const riskTemplate: AgentTemplate = {
      ...baseTemplate,
      id: 2,
      name: "Risk Analyst",
      role: "Risk Analyst",
      roleKey: "risk_analyst",
      capabilities: ["risk analysis", "investment risk assessment", "scenario analysis"],
      defaultInstructions: ["Separate evidence, assumptions, and recommendations."],
    };

    const woolworthsRisk = {
      roleKey: "riskAnalyst",
      name: "Woolworths Risk Analyst",
      responsibility: "Assess investment risks for Woolworths.",
      requiredCapabilities: ["risk analysis", "investment risk assessment"],
      taskSpecificInstructions: ["Focus on Woolworths-specific risks."],
    };
    const standardBankRisk = {
      roleKey: "risk_analyst",
      name: "Standard Bank Risk Analyst",
      responsibility: "Assess investment risks for Standard Bank.",
      requiredCapabilities: ["risk analysis", "investment risk assessment"],
      taskSpecificInstructions: ["Focus on Standard Bank-specific risks."],
    };

    expect(findBestAgentTemplateMatch([riskTemplate], woolworthsRisk)?.template.id).toBe(2);
    expect(findBestAgentTemplateMatch([riskTemplate], standardBankRisk)?.template.id).toBe(2);
  });

  it("reuses Investment Research Analyst across investment tasks", () => {
    const investmentTemplate: AgentTemplate = {
      ...baseTemplate,
      id: 3,
      name: "Investment Research Analyst",
      role: "Investment Research Analyst",
      roleKey: "investment_research_analyst",
      capabilities: ["investment research", "business analysis", "market research"],
    };

    const match = findBestAgentTemplateMatch([investmentTemplate], {
      roleKey: "equityResearchAnalyst",
      name: "Company Research Analyst",
      responsibility: "Research and assess a company as an investment opportunity.",
      requiredCapabilities: ["investment research", "business analysis"],
      taskSpecificInstructions: ["Focus on Standard Bank."],
    });

    expect(match?.template.id).toBe(3);
  });

  it("does not match Financial Analyst to Marketing Analyst", () => {
    const financialTemplate: AgentTemplate = {
      ...baseTemplate,
      id: 4,
      name: "Financial Analyst",
      role: "Financial Analyst",
      roleKey: "financial_analyst",
      capabilities: ["financial analysis", "ratio analysis", "valuation analysis"],
    };

    const match = findBestAgentTemplateMatch([financialTemplate], {
      roleKey: "marketing_analyst",
      name: "Marketing Analyst",
      responsibility: "Assess campaigns, channels, audiences, and positioning.",
      requiredCapabilities: ["marketing analysis", "channel strategy", "audience research"],
      taskSpecificInstructions: [],
    });

    expect(match).toBeNull();
  });

  it("does not match Research Analyst to Risk Analyst", () => {
    const match = findBestAgentTemplateMatch([baseTemplate], {
      roleKey: "risk_analyst",
      name: "Risk Analyst",
      responsibility: "Assess downside scenarios and risk controls.",
      requiredCapabilities: ["risk analysis", "scenario analysis"],
      taskSpecificInstructions: [],
    });

    expect(match).toBeNull();
  });

  it("keeps task-specific subject matter out of template fingerprints", () => {
    const woolworthsFingerprint = createAgentFingerprint({
      roleKey: "investment_research_analyst",
      capabilities: ["investment research", "financial analysis"],
      defaultInstructions: ["Use only task-provided context and upstream artifacts."],
    });
    const standardBankFingerprint = createAgentFingerprint({
      roleKey: "investment_research_analyst",
      capabilities: ["financial analysis", "investment research"],
      defaultInstructions: ["Use only task-provided context and upstream artifacts."],
    });

    expect(woolworthsFingerprint).toBe(standardBankFingerprint);
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
