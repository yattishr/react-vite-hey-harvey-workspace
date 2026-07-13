import { beforeEach, describe, expect, it, vi } from "vitest";
import type {
  AgentTemplate,
  Task,
  TaskRun,
  TeamMember,
} from "../../drizzle/schema";
import { FakeAgentsRunner } from "./fake-runner";

const state = vi.hoisted(() => ({
  taskRun: {} as Record<string, unknown>,
  members: [] as Array<Record<string, unknown>>,
  templates: new Map<number, Record<string, unknown>>(),
  runs: [] as Array<Record<string, unknown>>,
  artifacts: [] as Array<Record<string, unknown>>,
  events: [] as Array<Record<string, unknown>>,
}));

vi.mock("../db", () => ({
  getDb: async () => ({
    update: () => ({ set: () => ({ where: async () => [] }) }),
  }),
}));
vi.mock("../teams/taskTeamRepository", () => ({
  getOrderedTeamMembers: async () => state.members,
  updateTaskTeamStatus: async () => undefined,
}));
vi.mock("../agents/agentTemplateRepository", () => ({
  getAgentTemplateById: async (_organizationId: number, id: number) =>
    state.templates.get(id) ?? null,
}));
vi.mock("../agents/agentTemplateService", () => ({
  incrementAgentTemplateFailure: async () => undefined,
  incrementAgentTemplateSuccess: async () => undefined,
}));
vi.mock("../execution/agentRunRepository", () => ({
  createAgentRun: async (input: Record<string, unknown>) => {
    const run = { id: state.runs.length + 1, ...input };
    state.runs.push(run);
    return run;
  },
  updateAgentRun: async (
    _organizationId: number,
    id: number,
    updates: Record<string, unknown>
  ) => {
    Object.assign(state.runs.find(run => run.id === id)!, updates);
  },
  getCompletedAgentRunsForTeamMembers: async (
    _organizationId: number,
    memberIds: number[],
    taskRunId: number
  ) =>
    state.runs.filter(
      run =>
        memberIds.includes(run.teamMemberId as number) &&
        run.taskRunId === taskRunId &&
        run.status === "completed"
    ),
  getAgentRunsByTaskRun: async () => state.runs,
}));
vi.mock("../execution/artifactRepository", () => ({
  createTaskArtifact: async (input: Record<string, unknown>) => {
    const artifact = { id: state.artifacts.length + 100, ...input };
    state.artifacts.push(artifact);
    return artifact;
  },
  getArtifactsByAgentRunIds: async (_organizationId: number, ids: number[]) =>
    state.artifacts.filter(artifact =>
      ids.includes(artifact.agentRunId as number)
    ),
  getArtifactsByTaskRun: async () => state.artifacts,
  toArtifactReference: (artifact: Record<string, unknown>) => ({
    artifactId: artifact.id,
    artifactType: artifact.artifactType,
    title: artifact.title,
  }),
}));
vi.mock("./repositories/task-run-repository", () => ({
  getTaskRun: async () => state.taskRun,
  updateTaskRun: async (
    _organizationId: number,
    _id: number,
    updates: Record<string, unknown>
  ) => {
    Object.assign(state.taskRun, updates);
    return state.taskRun;
  },
}));
vi.mock("./repositories/event-repository", () => ({
  publishRuntimeEvent: async (event: Record<string, unknown>) => {
    state.events.push({
      id: state.events.length + 1,
      sequence: state.events.length + 1,
      ...event,
    });
  },
}));

const { resetAgentsRuntimeConfigForTests } = await import("./config");
const { executeSdkWorkflow } = await import("./workflow-executor");

describe("OpenAI Agents SDK workflow end to end", () => {
  beforeEach(() => {
    state.runs.length = 0;
    state.artifacts.length = 0;
    state.events.length = 0;
    state.templates.clear();
    state.taskRun = {
      id: 30,
      organizationId: 10,
      userId: 20,
      taskId: 1,
      taskTeamId: 40,
      runtime: "openai_agents_sdk",
      status: "queued",
      correlationId: "correlation-id",
    };
    state.members = [1, 2, 3].map(position => ({
      id: position,
      organizationId: 10,
      taskTeamId: 40,
      taskId: 1,
      agentTemplateId: position,
      agentTemplateVersion: 1,
      workflowOrder: position,
      roleKey: `role_${position}`,
      taskSpecificInstructions: [],
      expectedOutput: `Output ${position}`,
      dependsOnTeamMemberIds: position === 1 ? [] : [position - 1],
      createdAt: new Date(),
    }));
    for (let id = 1; id <= 3; id += 1) {
      state.templates.set(id, {
        id,
        organizationId: 10,
        name: `Agent ${id}`,
        slug: `agent-${id}`,
        roleKey: `role_${id}`,
        role: `Role ${id}`,
        description: `Step ${id}`,
        goal: `Complete step ${id}`,
        backstory: null,
        defaultInstructions: [],
        capabilities: [],
        toolPermissions: [],
        status: "active",
        source: "generated",
        version: 1,
        fingerprint: `fingerprint-${id}`,
        usageCount: 0,
        successCount: 0,
        failureCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }
    process.env.OPENAI_AGENTS_DEFAULT_MODEL = "gpt-4o-mini";
    process.env.OPENAI_AGENTS_MAX_STEP_RETRIES = "0";
    resetAgentsRuntimeConfigForTests();
  });

  it("executes three persisted agents sequentially and persists terminal state", async () => {
    const runner = new FakeAgentsRunner(
      [1, 2, 3].map(step => ({
        output: { summary: `Summary ${step}`, content: `Content ${step}` },
        runtimeIdentifier: `response-${step}`,
      }))
    );
    const result = await executeSdkWorkflow(
      { id: 1, organizationId: 10, userId: 20, description: "Task" } as Task,
      state.taskRun as unknown as TaskRun,
      runner
    );

    expect(runner.calls).toHaveLength(3);
    expect(runner.calls[1]?.input).toContain("Content 1");
    expect(state.artifacts).toHaveLength(3);
    expect(state.taskRun.status).toBe("succeeded");
    expect(result.status).toBe("completed");
    expect(state.events.map(event => event.type)).toContain("run_succeeded");
    expect(state.runs.every(run => run.runtimeStatus === "succeeded")).toBe(
      true
    );
  });
});
