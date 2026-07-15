import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

const mocks = vi.hoisted(() => ({
  invokeLLM: vi.fn(),
  createAgent: vi.fn(),
  createTask: vi.fn(),
  createWorkflow: vi.fn(),
  createWorkflowStep: vi.fn(),
  createTaskAndRun: vi.fn(),
  executeStoredTask: vi.fn(),
}));

vi.mock("./_core/llm", () => ({
  invokeLLM: mocks.invokeLLM,
}));

vi.mock("./db", () => ({
  createAgent: mocks.createAgent,
  createTask: mocks.createTask,
  createWorkflow: mocks.createWorkflow,
  createWorkflowStep: mocks.createWorkflowStep,
}));

vi.mock("./taskExecution", () => ({
  executeStoredTask: mocks.executeStoredTask,
}));

vi.mock("./agents-runtime/repositories/task-run-repository", () => ({
  createTaskAndRun: mocks.createTaskAndRun,
}));

const validPreview = {
  taskTitle: "Market Entry Plan",
  taskSummary: "Assess the opportunity and produce a practical entry plan.",
  agents: [
    {
      name: "Market Analyst",
      role: "Research Lead",
      goal: "Assess customer segments and market dynamics.",
      backstory:
        "A concise commercial researcher with strong synthesis skills.",
      responsibility: "Research market size, segments, and customer needs.",
    },
    {
      name: "Competitive Strategist",
      role: "Strategy Lead",
      goal: "Identify competitors, risks, and positioning options.",
      backstory:
        "A pragmatic strategist focused on actionable differentiation.",
      responsibility: "Map competitors and recommend positioning.",
    },
  ],
  workflowSteps: [
    {
      stepNumber: 1,
      agentIndex: 1,
      taskDescription:
        "Research market size, customer segments, and demand signals.",
    },
    {
      stepNumber: 2,
      agentIndex: 2,
      taskDescription:
        "Use the research to create positioning and entry recommendations.",
    },
  ],
};

const { agentFactoryRouter } = await import("./agentFactory");

function createMockContext(overrides: Partial<TrpcContext> = {}): TrpcContext {
  const user = {
    id: 7,
    supabaseUserId: "00000000-0000-4000-8000-000000000007",
    email: "owner@example.com",
    name: "Owner",
    loginMethod: "supabase",
    role: "user" as const,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  return {
    user,
    organization: {
      id: 11,
      name: "Owner Org",
      slug: "owner-org",
      createdByUserId: user.id,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    membership: {
      id: 13,
      organizationId: 11,
      userId: user.id,
      role: "owner",
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: () => {} } as unknown as TrpcContext["res"],
    ...overrides,
  };
}

describe("agentFactoryRouter", () => {
  let nextAgentId: number;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.AGENT_TEAM_REUSE_ENABLED = "false";
    nextAgentId = 100;
    mocks.invokeLLM.mockResolvedValue({
      choices: [{ message: { content: JSON.stringify(validPreview) } }],
    });
    mocks.createAgent.mockImplementation(async input => ({
      id: nextAgentId++,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...input,
    }));
    mocks.createTask.mockImplementation(async input => ({
      id: 200,
      createdAt: new Date(),
      updatedAt: new Date(),
      result: null,
      error: null,
      executionStartedAt: null,
      executionCompletedAt: null,
      ...input,
    }));
    mocks.createWorkflow.mockImplementation(async input => ({
      id: 300,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...input,
    }));
    mocks.createWorkflowStep.mockImplementation(async input => ({
      id: mocks.createWorkflowStep.mock.calls.length + 400,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...input,
    }));
    mocks.executeStoredTask.mockResolvedValue({
      success: true,
      result: "Final synthesized output",
      taskId: 200,
    });
    mocks.createTaskAndRun.mockImplementation(async taskInput => ({
      task: {
        id: 200,
        createdAt: new Date(),
        updatedAt: new Date(),
        result: null,
        error: null,
        executionStartedAt: null,
        executionCompletedAt: null,
        taskTeamId: null,
        executionBlueprintId: null,
        ...taskInput,
      },
      taskRun: {
        id: 500,
        organizationId: 11,
        userId: 7,
        taskId: 200,
        taskTeamId: null,
        runtime: "legacy",
        status: "queued",
        correlationId: "test-correlation",
        eventSequence: 0,
        openaiTraceId: null,
        currentTeamMemberId: null,
        finalArtifactId: null,
        errorCode: null,
        errorMessage: null,
        startedAt: null,
        completedAt: null,
        cancelledAt: null,
        failedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    }));
  });

  it("returns a validated planner preview from the LLM response", async () => {
    const caller = agentFactoryRouter.createCaller(createMockContext());

    const result = await caller.plan({
      description:
        "Research a new market opportunity for a legal operations product.",
      templateId: "market-opportunity",
    });

    expect(result).toEqual(validPreview);
    expect(mocks.invokeLLM).toHaveBeenCalledWith(
      expect.objectContaining({
        responseFormat: expect.objectContaining({
          type: "json_schema",
        }),
      })
    );
  });

  it("rejects invalid planner JSON", async () => {
    const caller = agentFactoryRouter.createCaller(createMockContext());
    mocks.invokeLLM.mockResolvedValueOnce({
      choices: [{ message: { content: '{"taskTitle":"Incomplete"}' } }],
    });

    await expect(
      caller.plan({
        description:
          "Research a new market opportunity for a legal operations product.",
      })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("creates tenant-owned agents, task, workflow steps, and runs the task", async () => {
    const caller = agentFactoryRouter.createCaller(createMockContext());

    const result = await caller.approveAndRun({
      description:
        "Research a new market opportunity for a legal operations product.",
      preview: validPreview,
    });

    expect(mocks.createAgent).toHaveBeenCalledTimes(2);
    expect(mocks.createAgent).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        organizationId: 11,
        userId: 7,
        name: "Market Analyst",
        tools: "[]",
        isActive: true,
      })
    );
    expect(mocks.createTask).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: 11,
        userId: 7,
        title: "Market Entry Plan",
        agentIds: [100, 101],
        status: "queued",
      })
    );
    expect(mocks.createWorkflow).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: 11,
        userId: 7,
        executionType: "sequential",
      })
    );
    expect(mocks.createWorkflowStep).toHaveBeenCalledTimes(2);
    expect(mocks.createWorkflowStep).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        workflowId: 300,
        stepNumber: 1,
        agentIds: "[100]",
      })
    );
    expect(mocks.executeStoredTask).toHaveBeenCalledWith(
      expect.objectContaining({ id: 200, agentIds: [100, 101] })
    );
    expect(result.execution.result).toBe("Final synthesized output");
  });

  it("atomically creates the reusable task and initial run before execution", async () => {
    process.env.AGENT_TEAM_REUSE_ENABLED = "true";
    const caller = agentFactoryRouter.createCaller(createMockContext());

    await caller.approveAndRun({
      description:
        "Research a new market opportunity for a legal operations product.",
      preview: validPreview,
    });

    expect(mocks.createTaskAndRun).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: 11,
        userId: 7,
        agentIds: [],
        status: "queued",
      }),
      expect.objectContaining({
        organizationId: 11,
        userId: 7,
        runtime: "legacy",
        status: "queued",
      })
    );
    expect(mocks.executeStoredTask).toHaveBeenCalledWith(
      expect.objectContaining({ id: 200 }),
      expect.objectContaining({ id: 500, taskId: 200 })
    );
    expect(mocks.createTask).not.toHaveBeenCalled();
  });

  it("rejects empty approval previews", async () => {
    const caller = agentFactoryRouter.createCaller(createMockContext());

    await expect(
      caller.approveAndRun({
        description:
          "Research a new market opportunity for a legal operations product.",
        preview: {
          taskTitle: "",
          taskSummary: "",
          agents: [],
          workflowSteps: [],
        },
      })
    ).rejects.toBeDefined();
  });

  it("requires an active organization membership", async () => {
    const caller = agentFactoryRouter.createCaller(
      createMockContext({ organization: null, membership: null })
    );

    await expect(
      caller.approveAndRun({
        description:
          "Research a new market opportunity for a legal operations product.",
        preview: validPreview,
      })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
