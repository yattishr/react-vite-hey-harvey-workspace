import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

/**
 * Smoke Tests for CrewAI Agent Platform
 * Tests core functionality: agent creation, task execution, and status tracking
 */

// Mock authenticated user context
function createMockContext(): TrpcContext {
  const user = {
    id: 1,
    supabaseUserId: "00000000-0000-4000-8000-000000000001",
    email: "test@example.com",
    name: "Test User",
    loginMethod: "supabase",
    role: "user" as const,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  return {
    user,
    organization: {
      id: 1,
      name: "Test Organization",
      slug: "test-organization",
      createdByUserId: user.id,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    membership: {
      id: 1,
      organizationId: 1,
      userId: user.id,
      role: "owner" as const,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: () => {},
    } as TrpcContext["res"],
  };
}

describe("CrewAI Agent Platform - Smoke Tests", () => {
  let caller: ReturnType<typeof appRouter.createCaller>;
  let testAgentId: number;
  let testTaskId: number;

  beforeAll(() => {
    const ctx = createMockContext();
    caller = appRouter.createCaller(ctx);
  });

  describe("Agent Management", () => {
    it("should create an agent successfully", async () => {
      const result = await caller.agents.create({
        name: "Research Agent",
        role: "Market Researcher",
        goal: "Analyze market trends",
        backstory: "Expert in market analysis",
        tools: [],
      });

      expect(result).toBeDefined();
      expect(result.id).toBeDefined();
      expect(result.name).toBe("Research Agent");
      expect(result.role).toBe("Market Researcher");
      testAgentId = result.id;
    });

    it("should list agents", async () => {
      const agents = await caller.agents.list();

      expect(Array.isArray(agents)).toBe(true);
      expect(agents.length).toBeGreaterThan(0);
      expect(agents.some((a) => a.id === testAgentId)).toBe(true);
    });

    it("should get agent by ID", async () => {
      const agent = await caller.agents.get({ id: testAgentId });

      expect(agent).toBeDefined();
      expect(agent?.id).toBe(testAgentId);
      expect(agent?.name).toBe("Research Agent");
    });

    it("should update agent", async () => {
      const updated = await caller.agents.update({
        id: testAgentId,
        goal: "Analyze emerging market trends",
      });

      expect(updated.goal).toBe("Analyze emerging market trends");
    });

    it("should not allow updating another user's agent", async () => {
      const otherCtx = createMockContext();
      otherCtx.user.id = 999;
      otherCtx.user.supabaseUserId = "00000000-0000-4000-8000-000000000999";
      otherCtx.organization.id = 999;
      otherCtx.membership.organizationId = 999;
      otherCtx.membership.userId = 999;
      const otherCaller = appRouter.createCaller(otherCtx);

      try {
        await otherCaller.agents.update({
          id: testAgentId,
          name: "Hacked Agent",
        });
        expect.fail("Should have thrown an error");
      } catch (error: any) {
        expect(error.code).toBe("NOT_FOUND");
      }
    });
  });

  describe("Task Management", () => {
    it("should create a task", async () => {
      const result = await caller.tasks.create({
        title: "Analyze Q3 Market Data",
        description: "Analyze quarterly market trends",
        agentIds: [testAgentId],
        status: "pending",
      });

      expect(result).toBeDefined();
      expect(result.id).toBeDefined();
      expect(result.title).toBe("Analyze Q3 Market Data");
      expect(result.status).toBe("pending");
      testTaskId = result.id;
    });

    it("should list tasks", async () => {
      const tasks = await caller.tasks.list();

      expect(Array.isArray(tasks)).toBe(true);
      expect(tasks.length).toBeGreaterThan(0);
      expect(tasks.some((t) => t.id === testTaskId)).toBe(true);
    });

    it("should get task by ID", async () => {
      const task = await caller.tasks.get({ id: testTaskId });

      expect(task).toBeDefined();
      expect(task?.id).toBe(testTaskId);
      expect(task?.title).toBe("Analyze Q3 Market Data");
    });

    it("should update task status", async () => {
      const updated = await caller.tasks.update({
        id: testTaskId,
        status: "running",
      });

      expect(updated.status).toBe("running");
    });

    it("should execute task and generate execution log", async () => {
      const result = await caller.tasks.execute({
        id: testTaskId,
      });

      expect(result).toBeDefined();
      expect(result.status).toBe("completed");
      expect(result.result).toBeDefined();
    });

    it("should get task execution logs", async () => {
      const logs = await caller.tasks.getLogs({
        taskId: testTaskId,
      });

      expect(Array.isArray(logs)).toBe(true);
      expect(logs.length).toBeGreaterThan(0);
      expect(logs[0].taskId).toBe(testTaskId);
    });
  });

  describe("Conversation Management", () => {
    let conversationId: number;

    it("should create a conversation", async () => {
      const result = await caller.conversations.create({
        agentId: testAgentId,
        title: "Market Analysis Discussion",
      });

      expect(result).toBeDefined();
      expect(result.id).toBeDefined();
      expect(result.agentId).toBe(testAgentId);
      conversationId = result.id;
    });

    it("should list conversations", async () => {
      const conversations = await caller.conversations.list();

      expect(Array.isArray(conversations)).toBe(true);
      expect(conversations.length).toBeGreaterThan(0);
    });

    it("should add message to conversation", async () => {
      const result = await caller.conversations.addMessage({
        conversationId,
        role: "user",
        content: "What are the key market trends?",
      });

      expect(result).toBeDefined();
      expect(result.id).toBeDefined();
      expect(result.role).toBe("user");
      expect(result.content).toBe("What are the key market trends?");
    });

    it("should get conversation messages", async () => {
      const messages = await caller.conversations.getMessages({
        conversationId,
      });

      expect(Array.isArray(messages)).toBe(true);
      expect(messages.length).toBeGreaterThan(0);
      expect(messages.some((m) => m.role === "user")).toBe(true);
    });
  });

  describe("Tool Management", () => {
    it("should list available tools", async () => {
      const tools = await caller.tools.list();

      expect(Array.isArray(tools)).toBe(true);
      expect(tools.length).toBeGreaterThan(0);
      expect(tools.some((t) => t.name === "web_search")).toBe(true);
    });

    it("should get tool by ID", async () => {
      const tools = await caller.tools.list();
      const webSearchTool = tools.find((t) => t.name === "web_search");

      if (webSearchTool) {
        const tool = await caller.tools.get({ id: webSearchTool.id });
        expect(tool).toBeDefined();
        expect(tool?.name).toBe("web_search");
      }
    });
  });

  describe("Error Handling", () => {
    it("should return 404 for non-existent agent", async () => {
      try {
        await caller.agents.get({ id: 99999 });
        expect.fail("Should have thrown an error");
      } catch (error: any) {
        expect(error.code).toBe("NOT_FOUND");
      }
    });

    it("should return 404 for non-existent task", async () => {
      try {
        await caller.tasks.get({ id: 99999 });
        expect.fail("Should have thrown an error");
      } catch (error: any) {
        expect(error.code).toBe("NOT_FOUND");
      }
    });

    it("should validate required fields on agent creation", async () => {
      try {
        await caller.agents.create({
          name: "",
          role: "Test",
          goal: "Test",
          backstory: "",
          tools: [],
        });
        expect.fail("Should have thrown validation error");
      } catch (error: any) {
        // Zod validation errors have code "BAD_REQUEST" or similar
        expect(error.code).toBeDefined();
      }
    });
  });

  describe("Data Integrity", () => {
    it("should maintain referential integrity for task-agent relationship", async () => {
      const task = await caller.tasks.getById({ id: testTaskId });
      expect(task?.agentIds).toContain(testAgentId);
    });

    it("should maintain user isolation", async () => {
      const otherCtx = createMockContext();
      otherCtx.user.id = 999;
      otherCtx.user.supabaseUserId = "00000000-0000-4000-8000-000000000999";
      otherCtx.organization.id = 999;
      otherCtx.membership.organizationId = 999;
      otherCtx.membership.userId = 999;
      const otherCaller = appRouter.createCaller(otherCtx);

      const otherUserAgents = await otherCaller.agents.list();
      expect(otherUserAgents.some((a) => a.id === testAgentId)).toBe(false);
    });
  });

  afterAll(async () => {
    // Cleanup: delete test data
    try {
      await caller.agents.delete({ id: testAgentId });
    } catch (error) {
      // Ignore cleanup errors
    }
  });
});
