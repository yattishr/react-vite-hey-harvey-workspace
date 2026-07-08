import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { organizationProcedure, publicProcedure, router } from "./_core/trpc";
import { z } from "zod";
import * as db from "./db";
import { executeTaskWithAgents, agentConversation, initializeBuiltInTools } from "./crewai";
import { executeWorkflow } from "./workflow";
import { TRPCError } from "@trpc/server";

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts =>
      opts.ctx.user
        ? {
            user: opts.ctx.user,
            organization: opts.ctx.organization,
            membership: opts.ctx.membership,
          }
        : null
    ),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),

  // ============ Agent Management ============
  agents: router({
    create: organizationProcedure
      .input(
        z.object({
          name: z.string().min(1).max(255),
          role: z.string().min(1).max(255),
          goal: z.string().min(1),
          backstory: z.string().optional(),
          tools: z.array(z.string()).default([]),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const result = await db.createAgent({
          organizationId: ctx.organization.id,
          userId: ctx.user.id,
          name: input.name,
          role: input.role,
          goal: input.goal,
          backstory: input.backstory || null,
          tools: JSON.stringify(input.tools),
          isActive: true,
        });
        return result;
      }),

    list: organizationProcedure.query(async ({ ctx }) => {
      return await db.getAgentsByUserId(ctx.user.id);
    }),

    get: organizationProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ ctx, input }) => {
        const agent = await db.getAgentById(input.id);
        if (!agent || agent.userId !== ctx.user.id || agent.organizationId !== ctx.organization.id) {
          throw new TRPCError({ code: "NOT_FOUND" });
        }
        return agent;
      }),

    update: organizationProcedure
      .input(
        z.object({
          id: z.number(),
          name: z.string().min(1).max(255).optional(),
          role: z.string().min(1).max(255).optional(),
          goal: z.string().min(1).optional(),
          backstory: z.string().optional(),
          tools: z.array(z.string()).optional(),
          isActive: z.boolean().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const agent = await db.getAgentById(input.id);
        if (!agent || agent.userId !== ctx.user.id || agent.organizationId !== ctx.organization.id) {
          throw new TRPCError({ code: "NOT_FOUND" });
        }

        const updates: Record<string, any> = {};
        if (input.name !== undefined) updates.name = input.name;
        if (input.role !== undefined) updates.role = input.role;
        if (input.goal !== undefined) updates.goal = input.goal;
        if (input.backstory !== undefined) updates.backstory = input.backstory;
        if (input.tools !== undefined) updates.tools = input.tools;
        if (input.isActive !== undefined) updates.isActive = input.isActive;

        return await db.updateAgent(input.id, updates);
      }),

    delete: organizationProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const agent = await db.getAgentById(input.id);
        if (!agent || agent.userId !== ctx.user.id || agent.organizationId !== ctx.organization.id) {
          throw new TRPCError({ code: "NOT_FOUND" });
        }
        return await db.deleteAgent(input.id);
      }),
  }),

  // ============ Task Management ============
  tasks: router({
    create: organizationProcedure
      .input(
        z.object({
          title: z.string().min(1).max(255),
          description: z.string().min(1),
          agentIds: z.array(z.number()).min(1),
        })
      )
      .mutation(async ({ ctx, input }) => {
        // Verify all agents belong to user
        for (const agentId of input.agentIds) {
          const agent = await db.getAgentById(agentId);
          if (!agent || agent.userId !== ctx.user.id || agent.organizationId !== ctx.organization.id) {
            throw new TRPCError({ code: "NOT_FOUND", message: `Agent ${agentId} not found` });
          }
        }

        const result = await db.createTask({
          organizationId: ctx.organization.id,
          userId: ctx.user.id,
          title: input.title,
          description: input.description,
          agentIds: input.agentIds,
          status: "queued",
        });

        return result;
      }),

    list: organizationProcedure.query(async ({ ctx }) => {
      return await db.getTasksByUserId(ctx.user.id);
    }),

    get: organizationProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ ctx, input }) => {
        const task = await db.getTaskById(input.id);
        if (!task || task.userId !== ctx.user.id || task.organizationId !== ctx.organization.id) {
          throw new TRPCError({ code: "NOT_FOUND" });
        }
        return task;
      }),

    execute: organizationProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const task = await db.getTaskById(input.id);
        if (!task || task.userId !== ctx.user.id || task.organizationId !== ctx.organization.id) {
          throw new TRPCError({ code: "NOT_FOUND" });
        }

        // Update task status to running
        await db.updateTask(input.id, {
          status: "running",
          executionStartedAt: new Date(),
        });

        try {
          // Get agent details
          const agentIds = task.agentIds as number[];
          const agents = [];
          for (const agentId of agentIds) {
            const agent = await db.getAgentById(agentId);
            if (agent) {
              agents.push({
                id: agent.id,
                name: agent.name,
                role: agent.role,
                goal: agent.goal,
                backstory: agent.backstory || "",
                tools: typeof agent.tools === 'string' ? JSON.parse(agent.tools) : agent.tools || [],
              });
            }
          }

          // Execute task with agents
          const result = await executeTaskWithAgents({
            description: task.description,
            agentIds: agentIds,
            agents: agents,
          });

          // Update task with result
          await db.updateTask(input.id, {
            status: result.success ? "completed" : "failed",
            result: result.result || null,
            error: result.error || null,
            executionCompletedAt: new Date(),
          });

          // Store execution logs
          for (const step of result.steps) {
            await db.addExecutionLog({
              taskId: input.id,
              step: step.step,
              action: step.action,
              details: step.details,
            });
          }

          return { success: result.success, result: result.result };
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          await db.updateTask(input.id, {
            status: "failed",
            error: errorMessage,
            executionCompletedAt: new Date(),
          });
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: errorMessage });
        }
      }),

    getExecutionLogs: organizationProcedure
      .input(z.object({ taskId: z.number() }))
      .query(async ({ ctx, input }) => {
        const task = await db.getTaskById(input.taskId);
        if (!task || task.userId !== ctx.user.id || task.organizationId !== ctx.organization.id) {
          throw new TRPCError({ code: "NOT_FOUND" });
        }
        return await db.getExecutionLogsByTaskId(input.taskId);
      }),
  }),

  // ============ Conversation Management ============
  conversations: router({
    create: organizationProcedure
      .input(
        z.object({
          title: z.string().min(1).max(255),
          taskId: z.number().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        return await db.createConversation({
          organizationId: ctx.organization.id,
          userId: ctx.user.id,
          title: input.title,
          taskId: input.taskId || null,
        });
      }),

    list: organizationProcedure.query(async ({ ctx }) => {
      return await db.getConversationsByUserId(ctx.user.id);
    }),

    get: organizationProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ ctx, input }) => {
        const conversation = await db.getConversationById(input.id);
        if (!conversation || conversation.userId !== ctx.user.id || conversation.organizationId !== ctx.organization.id) {
          throw new TRPCError({ code: "NOT_FOUND" });
        }
        return conversation;
      }),

    addMessage: organizationProcedure
      .input(
        z.object({
          conversationId: z.number(),
          role: z.enum(["user", "agent", "system"]),
          content: z.string().min(1),
          agentId: z.number().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const conversation = await db.getConversationById(input.conversationId);
        if (!conversation || conversation.userId !== ctx.user.id || conversation.organizationId !== ctx.organization.id) {
          throw new TRPCError({ code: "NOT_FOUND" });
        }

        return await db.addMessage({
          conversationId: input.conversationId,
          role: input.role,
          content: input.content,
          agentId: input.agentId || null,
        });
      }),

    getMessages: organizationProcedure
      .input(z.object({ conversationId: z.number() }))
      .query(async ({ ctx, input }) => {
        const conversation = await db.getConversationById(input.conversationId);
        if (!conversation || conversation.userId !== ctx.user.id || conversation.organizationId !== ctx.organization.id) {
          throw new TRPCError({ code: "NOT_FOUND" });
        }
        return await db.getMessagesByConversationId(input.conversationId);
      }),

    agentResponse: organizationProcedure
      .input(
        z.object({
          conversationId: z.number(),
          agentIds: z.array(z.number()),
          userMessage: z.string().min(1),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const conversation = await db.getConversationById(input.conversationId);
        if (!conversation || conversation.userId !== ctx.user.id || conversation.organizationId !== ctx.organization.id) {
          throw new TRPCError({ code: "NOT_FOUND" });
        }

        // Get agent details
        const agents = [];
        for (const agentId of input.agentIds) {
          const agent = await db.getAgentById(agentId);
          if (agent && agent.userId === ctx.user.id && agent.organizationId === ctx.organization.id) {
            agents.push({
              id: agent.id,
              name: agent.name,
              role: agent.role,
              goal: agent.goal,
              backstory: agent.backstory || "",
                tools: typeof agent.tools === 'string' ? JSON.parse(agent.tools) : agent.tools || [],
            });
          }
        }

        if (agents.length === 0) {
          throw new TRPCError({ code: "NOT_FOUND", message: "No valid agents found" });
        }

        // Get conversation history
        const messages = await db.getMessagesByConversationId(input.conversationId);
        const history = messages.map((msg) => ({
          role: msg.role,
          content: msg.content,
        }));

        // Get agent response
        const response = await agentConversation(agents, input.userMessage, history);

        // Store user message
        await db.addMessage({
          conversationId: input.conversationId,
          role: "user",
          content: input.userMessage,
        });

        // Store agent response
        await db.addMessage({
          conversationId: input.conversationId,
          role: "agent",
          content: response,
        });

        return { response };
      }),
  }),

  // ============ Tools Management ============
  tools: router({
    list: organizationProcedure.query(async () => {
      return await db.getAllTools();
    }),

    getByCategory: organizationProcedure
      .input(z.object({ category: z.string() }))
      .query(async ({ input }) => {
        return await db.getToolsByCategory(input.category);
      }),
  }),

  workflows: router({
    create: organizationProcedure
      .input(
        z.object({
          name: z.string().min(1).max(255),
          description: z.string().optional(),
          executionType: z.enum(["sequential", "parallel", "conditional"]).default("sequential"),
          steps: z.array(
            z.object({
              stepNumber: z.number(),
              agentIds: z.array(z.number()),
              taskDescription: z.string().min(1),
              dependsOn: z.array(z.number()).optional(),
            })
          ),
        })
      )
      .mutation(async ({ ctx, input }) => {
        try {
          const workflow = await db.createWorkflow({
            organizationId: ctx.organization.id,
            userId: ctx.user.id,
            name: input.name,
            description: input.description || null,
            executionType: input.executionType,
            status: "draft",
            config: JSON.stringify({ steps: input.steps }),
          });

          for (const step of input.steps) {
            await db.createWorkflowStep({
              workflowId: (workflow as any).id,
              stepNumber: step.stepNumber,
              agentIds: JSON.stringify(step.agentIds),
              taskDescription: step.taskDescription,
              dependsOn: step.dependsOn ? JSON.stringify(step.dependsOn) : null,
            });
          }

          return workflow;
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: errorMessage });
        }
      }),

    list: organizationProcedure.query(async ({ ctx }) => {
      return await db.getWorkflowsByUserId(ctx.user.id);
    }),

    get: organizationProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ ctx, input }) => {
        const workflow = await db.getWorkflowById(input.id);
        if (!workflow || (workflow as any).userId !== ctx.user.id || (workflow as any).organizationId !== ctx.organization.id) {
          throw new TRPCError({ code: "NOT_FOUND" });
        }
        return workflow;
      }),

    execute: organizationProcedure
      .input(z.object({ workflowId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        try {
          const workflow = await db.getWorkflowById(input.workflowId);
          if (!workflow || (workflow as any).userId !== ctx.user.id || (workflow as any).organizationId !== ctx.organization.id) {
            throw new TRPCError({ code: "NOT_FOUND" });
          }

          const execution = await db.createWorkflowExecution({
            workflowId: input.workflowId,
            organizationId: ctx.organization.id,
            userId: ctx.user.id,
            status: "running",
          });

          executeWorkflow(input.workflowId, (execution as any).id, ctx.user.id).catch((error) => {
            console.error("Workflow execution error:", error);
          });

          return execution;
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: errorMessage });
        }
      }),

    getExecution: organizationProcedure
      .input(z.object({ executionId: z.number() }))
      .query(async ({ ctx, input }) => {
        const execution = await db.getWorkflowExecutionById(input.executionId);
        if (!execution || (execution as any).userId !== ctx.user.id || (execution as any).organizationId !== ctx.organization.id) {
          throw new TRPCError({ code: "NOT_FOUND" });
        }
        return execution;
      }),

    getExecutionSteps: organizationProcedure
      .input(z.object({ executionId: z.number() }))
      .query(async ({ ctx, input }) => {
        const execution = await db.getWorkflowExecutionById(input.executionId);
        if (!execution || (execution as any).userId !== ctx.user.id || (execution as any).organizationId !== ctx.organization.id) {
          throw new TRPCError({ code: "NOT_FOUND" });
        }
        return await db.getWorkflowExecutionStepsByExecutionId(input.executionId);
      }),

    listExecutions: organizationProcedure
      .input(z.object({ workflowId: z.number() }))
      .query(async ({ ctx, input }) => {
        const workflow = await db.getWorkflowById(input.workflowId);
        if (!workflow || (workflow as any).userId !== ctx.user.id || (workflow as any).organizationId !== ctx.organization.id) {
          throw new TRPCError({ code: "NOT_FOUND" });
        }
        return await db.getWorkflowExecutionsByWorkflowId(input.workflowId);
      }),
  }),
});

export type AppRouter = typeof appRouter;


