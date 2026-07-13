import { beforeEach, describe, expect, it, vi } from "vitest";
import type {
  AgentTemplate,
  Task,
  TaskRun,
  TeamMember,
} from "../../drizzle/schema";
import { FakeAgentsRunner } from "./fake-runner";

const mocks = vi.hoisted(() => ({
  createAgentRun: vi.fn(),
  updateAgentRun: vi.fn(),
  createTaskArtifact: vi.fn(),
  publishRuntimeEvent: vi.fn(),
}));

vi.mock("../execution/agentRunRepository", () => ({
  createAgentRun: mocks.createAgentRun,
  updateAgentRun: mocks.updateAgentRun,
}));
vi.mock("../execution/artifactRepository", () => ({
  createTaskArtifact: mocks.createTaskArtifact,
  toArtifactReference: (artifact: {
    id: number;
    artifactType: string;
    title: string;
  }) => ({
    artifactId: artifact.id,
    artifactType: artifact.artifactType,
    title: artifact.title,
  }),
}));
vi.mock("./repositories/event-repository", () => ({
  publishRuntimeEvent: mocks.publishRuntimeEvent,
}));

const { executeSdkStep } = await import("./step-executor");

describe("executeSdkStep", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.createAgentRun.mockImplementation(async input => ({
      id: mocks.createAgentRun.mock.calls.length,
      ...input,
    }));
    mocks.createTaskArtifact.mockImplementation(async input => ({
      id: 50,
      ...input,
    }));
  });

  it("audits an invalid attempt, retries once, and persists the validated artifact", async () => {
    const runner = new FakeAgentsRunner([
      { output: { bad: true } },
      {
        output: { summary: "Validated", content: "Structured result" },
        runtimeIdentifier: "resp_2",
      },
    ]);
    const result = await executeSdkStep({
      task: {
        id: 1,
        organizationId: 10,
        userId: 20,
        description: "Task",
      } as Task,
      taskRun: {
        id: 30,
        taskTeamId: 40,
        correlationId: "correlation",
      } as TaskRun,
      member: {
        id: 2,
        workflowOrder: 1,
        agentTemplateVersion: 1,
        taskSpecificInstructions: [],
        expectedOutput: "Report",
      } as TeamMember,
      template: {
        id: 3,
        name: "Analyst",
        role: "Analyst",
        goal: "Analyze",
        backstory: null,
        defaultInstructions: [],
        toolPermissions: [],
      } as AgentTemplate,
      upstreamArtifacts: [],
      runner,
      signal: new AbortController().signal,
      model: "gpt-4o-mini",
      maxTurns: 2,
      stepTimeoutMs: 5_000,
      maxRetries: 1,
    });

    expect(runner.calls).toHaveLength(2);
    expect(mocks.createAgentRun).toHaveBeenCalledTimes(2);
    expect(mocks.updateAgentRun).toHaveBeenCalledWith(
      10,
      1,
      expect.objectContaining({ errorCode: "OUTPUT_VALIDATION_FAILED" })
    );
    expect(mocks.createTaskArtifact).toHaveBeenCalledWith(
      expect.objectContaining({
        taskRunId: 30,
        contentText: "Structured result",
      })
    );
    expect(result.output.summary).toBe("Validated");
  });
});
