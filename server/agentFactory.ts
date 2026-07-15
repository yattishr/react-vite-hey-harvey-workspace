import { TRPCError } from "@trpc/server";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { invokeLLM } from "./_core/llm";
import { organizationProcedure, router } from "./_core/trpc";
import { getAgentsRuntimeConfig } from "./agents-runtime/config";
import { createTaskAndRun } from "./agents-runtime/repositories/task-run-repository";
import * as db from "./db";
import { executeStoredTask } from "./taskExecution";
import { isAgentTeamReuseEnabled } from "./orchestration/agentOrchestrator";

export const agentFactoryAgentSchema = z.object({
  name: z.string().min(1).max(255),
  role: z.string().min(1).max(255),
  goal: z.string().min(1).max(1200),
  backstory: z.string().min(1).max(1200),
  responsibility: z.string().min(1).max(1200),
});

export const agentFactoryWorkflowStepSchema = z.object({
  stepNumber: z.number().int().min(1).max(5),
  agentIndex: z.number().int().min(1).max(5),
  taskDescription: z.string().min(1).max(1600),
});

export const agentFactoryPreviewSchema = z
  .object({
    taskTitle: z.string().min(1).max(120),
    taskSummary: z.string().min(1).max(1600),
    agents: z.array(agentFactoryAgentSchema).min(2).max(5),
    workflowSteps: z.array(agentFactoryWorkflowStepSchema).min(2).max(5),
  })
  .superRefine((preview, ctx) => {
    if (preview.workflowSteps.length !== preview.agents.length) {
      ctx.addIssue({
        code: "custom",
        message: "Workflow must include exactly one step per generated agent",
        path: ["workflowSteps"],
      });
    }

    const seenAgentIndexes = new Set<number>();
    preview.workflowSteps.forEach((step, index) => {
      if (step.stepNumber !== index + 1) {
        ctx.addIssue({
          code: "custom",
          message: "Workflow steps must be sequential and ordered",
          path: ["workflowSteps", index, "stepNumber"],
        });
      }

      if (step.agentIndex > preview.agents.length) {
        ctx.addIssue({
          code: "custom",
          message: "Workflow step references an agent that does not exist",
          path: ["workflowSteps", index, "agentIndex"],
        });
      }

      if (seenAgentIndexes.has(step.agentIndex)) {
        ctx.addIssue({
          code: "custom",
          message: "Each generated agent must appear in only one workflow step",
          path: ["workflowSteps", index, "agentIndex"],
        });
      }
      seenAgentIndexes.add(step.agentIndex);
    });
  });

const planInputSchema = z.object({
  description: z.string().min(10).max(8000),
  templateId: z.string().max(80).optional(),
});

const approveAndRunInputSchema = z.object({
  description: z.string().min(10).max(8000),
  preview: agentFactoryPreviewSchema,
});

export type AgentFactoryPreview = z.infer<typeof agentFactoryPreviewSchema>;

const plannerJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["taskTitle", "taskSummary", "agents", "workflowSteps"],
  properties: {
    taskTitle: { type: "string" },
    taskSummary: { type: "string" },
    agents: {
      type: "array",
      minItems: 2,
      maxItems: 5,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["name", "role", "goal", "backstory", "responsibility"],
        properties: {
          name: { type: "string" },
          role: { type: "string" },
          goal: { type: "string" },
          backstory: { type: "string" },
          responsibility: { type: "string" },
        },
      },
    },
    workflowSteps: {
      type: "array",
      minItems: 2,
      maxItems: 5,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["stepNumber", "agentIndex", "taskDescription"],
        properties: {
          stepNumber: { type: "integer" },
          agentIndex: { type: "integer" },
          taskDescription: { type: "string" },
        },
      },
    },
  },
};

function extractTextContent(content: unknown) {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";

  return content
    .map(part => {
      if (typeof part === "string") return part;
      if (part && typeof part === "object" && "text" in part) {
        return String((part as { text?: unknown }).text ?? "");
      }
      return "";
    })
    .join("\n");
}

function parsePlannerResponse(content: string) {
  try {
    return agentFactoryPreviewSchema.parse(JSON.parse(content));
  } catch (error) {
    console.error("[AgentFactory] Invalid planner response", error);
    throw new TRPCError({
      code: "BAD_REQUEST",
      message:
        "Harvey could not build a valid team plan. Please try regenerating.",
    });
  }
}

export const agentFactoryRouter = router({
  plan: organizationProcedure
    .input(planInputSchema)
    .mutation(async ({ input }) => {
      try {
        const response = await invokeLLM({
          responseFormat: {
            type: "json_schema",
            json_schema: {
              name: "task_first_agent_factory_plan",
              strict: true,
              schema: plannerJsonSchema,
            },
          },
          messages: [
            {
              role: "system",
              content:
                "You are Harvey, an expert task-first agent factory planner. Generate a simple team and sequential workflow for the user's desired outcome. Keep V1 simple: no external integrations, no marketplace, no scheduled work, no human approval chains, no advanced memory, and no complex branching workflows.",
            },
            {
              role: "user",
              content: `Task description:\n${input.description}\n\nTemplate id: ${input.templateId ?? "custom"}\n\nReturn 2 to 5 concise business-friendly agents. Each agent needs name, role, goal, concise backstory, and one suggested responsibility. Return one ordered workflow step per agent. Use 1-based agentIndex values matching the agents array.`,
            },
          ],
        });

        const content = extractTextContent(
          response.choices[0]?.message?.content
        );
        if (!content) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Harvey did not return a team plan. Please try again.",
          });
        }

        return parsePlannerResponse(content);
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        const message =
          error instanceof Error ? error.message : "Planner unavailable";
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Unable to build team: ${message}`,
        });
      }
    }),

  approveAndRun: organizationProcedure
    .input(approveAndRunInputSchema)
    .mutation(async ({ ctx, input }) => {
      const preview = input.preview;

      if (isAgentTeamReuseEnabled()) {
        const runtime = getAgentsRuntimeConfig().OPENAI_AGENTS_RUNTIME_ENABLED
          ? "openai_agents_sdk"
          : "legacy";
        const { task, taskRun } = await createTaskAndRun(
          {
            organizationId: ctx.organization.id,
            userId: ctx.user.id,
            title: preview.taskTitle,
            description: `${input.description}\n\nGenerated task summary:\n${preview.taskSummary}`,
            agentIds: [],
            source: "custom",
            workflowType: "sequential",
            status: "queued",
          },
          {
            organizationId: ctx.organization.id,
            userId: ctx.user.id,
            taskTeamId: null,
            runtime,
            status: "queued",
            correlationId: randomUUID(),
          }
        );

        const execution = await executeStoredTask(task, taskRun);

        return {
          task,
          agents: [],
          workflow: null,
          execution,
        };
      }

      const createdAgents = [];
      for (const agent of preview.agents) {
        createdAgents.push(
          await db.createAgent({
            organizationId: ctx.organization.id,
            userId: ctx.user.id,
            name: agent.name,
            role: agent.role,
            goal: agent.goal,
            backstory: agent.backstory,
            tools: JSON.stringify([]),
            isActive: true,
          })
        );
      }

      const agentIds = createdAgents.map(agent => agent.id);
      const task = await db.createTask({
        organizationId: ctx.organization.id,
        userId: ctx.user.id,
        title: preview.taskTitle,
        description: `${input.description}\n\nGenerated task summary:\n${preview.taskSummary}`,
        agentIds,
        status: "queued",
      });

      const workflowSteps = preview.workflowSteps.map(step => ({
        stepNumber: step.stepNumber,
        agentIds: [agentIds[step.agentIndex - 1]],
        taskDescription: step.taskDescription,
      }));

      const workflow = await db.createWorkflow({
        organizationId: ctx.organization.id,
        userId: ctx.user.id,
        name: `${preview.taskTitle} Workflow`,
        description: preview.taskSummary,
        executionType: "sequential",
        status: "draft",
        config: JSON.stringify({
          source: "agentFactory",
          taskId: task.id,
          steps: workflowSteps,
        }),
      });

      for (const step of workflowSteps) {
        await db.createWorkflowStep({
          workflowId: workflow.id,
          stepNumber: step.stepNumber,
          agentIds: JSON.stringify(step.agentIds),
          taskDescription: step.taskDescription,
          dependsOn:
            step.stepNumber > 1 ? JSON.stringify([step.stepNumber - 1]) : null,
        });
      }

      const execution = await executeStoredTask(task);

      return {
        task,
        agents: createdAgents,
        workflow,
        execution,
      };
    }),
});
