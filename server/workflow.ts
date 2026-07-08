import { invokeLLM } from "./_core/llm";
import { getDb } from "./db";
import { workflowExecutions, workflowExecutionSteps, workflowSteps } from "../drizzle/schema";
import { eq } from "drizzle-orm";

export interface WorkflowStepResult {
  stepId: number;
  agentId: number;
  result: string;
  error?: string;
}

export interface WorkflowExecutionResult {
  executionId: number;
  status: "completed" | "failed";
  results: WorkflowStepResult[];
  aggregatedResult: string;
}

/**
 * Execute a workflow with multiple agents collaborating
 */
export async function executeWorkflow(
  workflowId: number,
  executionId: number,
  userId: number
): Promise<WorkflowExecutionResult> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  try {
    // Get workflow steps
    const steps = await db
      .select()
      .from(workflowSteps)
      .where(eq(workflowSteps.workflowId, workflowId))
      .orderBy(workflowSteps.stepNumber);

    if (steps.length === 0) {
      throw new Error("No steps found in workflow");
    }

    const results: WorkflowStepResult[] = [];
    const stepResults: Map<number, string> = new Map();

    // Execute steps sequentially (can be extended for parallel/conditional)
    for (const step of steps) {
      try {
        // Parse agent IDs
        const agentIds = step.agentIds ? JSON.parse(step.agentIds) : [];
        if (agentIds.length === 0) {
          throw new Error(`No agents assigned to step ${step.stepNumber}`);
        }

        // Get previous step results for context
        const previousResults = Array.from(stepResults.values()).join("\n");
        const context = previousResults
          ? `\n\nPrevious results:\n${previousResults}`
          : "";

        // Execute step with primary agent
        const primaryAgentId = agentIds[0];
        const prompt = `${step.taskDescription}${context}`;

        const response = await invokeLLM({
          messages: [
            {
              role: "system",
              content:
                "You are a helpful AI agent working as part of a multi-agent workflow. Provide clear, structured responses.",
            },
            {
              role: "user",
              content: prompt,
            },
          ],
        });

        const responseContent = response.choices[0]?.message?.content;
        const stepResult =
          typeof responseContent === "string" ? responseContent : "No response";
        stepResults.set(step.id, stepResult);

        results.push({
          stepId: step.id,
          agentId: primaryAgentId,
          result: stepResult,
        });

        // Update execution step status
        const execStepData: any = {
          executionId,
          stepId: step.id,
          agentId: primaryAgentId,
          status: "completed",
          result: stepResult,
          startedAt: new Date(),
          completedAt: new Date(),
        };
        await db.insert(workflowExecutionSteps).values(execStepData);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        results.push({
          stepId: step.id,
          agentId: 0,
          result: "",
          error: errorMessage,
        });

        // Update execution step status
        const execStepData: any = {
          executionId,
          stepId: step.id,
          status: "failed",
          error: errorMessage,
          startedAt: new Date(),
          completedAt: new Date(),
        };
        await db.insert(workflowExecutionSteps).values(execStepData);
      }
    }

    // Aggregate results
    const aggregatedResult = results
      .map((r) => `Step ${r.stepId}: ${r.result}`)
      .join("\n\n");

    // Check if any step failed
    const hasFailed = results.some((r) => r.error);

    // Update workflow execution
    await db
      .update(workflowExecutions)
      .set({
        status: hasFailed ? "failed" : "completed",
        result: aggregatedResult,
        completedAt: new Date(),
      })
      .where(eq(workflowExecutions.id, executionId));

    return {
      executionId,
      status: hasFailed ? "failed" : "completed",
      results,
      aggregatedResult,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    // Update workflow execution with error
    await db
      .update(workflowExecutions)
      .set({
        status: "failed",
        error: errorMessage,
        completedAt: new Date(),
      })
      .where(eq(workflowExecutions.id, executionId));

    throw error;
  }
}

/**
 * Delegate a task to an agent within a workflow
 */
export async function delegateTaskToAgent(
  agentId: number,
  taskDescription: string,
  context?: string
): Promise<string> {
  const prompt = `${taskDescription}${context ? `\n\nContext:\n${context}` : ""}`;

  const response = await invokeLLM({
    messages: [
      {
        role: "system",
        content:
          "You are an AI agent executing a delegated task within a multi-agent workflow. Provide clear, actionable results.",
      },
      {
        role: "user",
        content: prompt,
      },
    ],
  });

  const responseContent = response.choices[0]?.message?.content;
  return typeof responseContent === "string" ? responseContent : "No response";
}

/**
 * Aggregate results from multiple agents
 */
export function aggregateResults(results: WorkflowStepResult[]): string {
  const successResults = results.filter((r) => !r.error);
  const failedResults = results.filter((r) => r.error);

  let aggregated = "=== Workflow Results ===\n\n";

  if (successResults.length > 0) {
    aggregated += "✓ Completed Steps:\n";
    successResults.forEach((r) => {
      aggregated += `\nStep ${r.stepId} (Agent ${r.agentId}):\n${r.result}\n`;
    });
  }

  if (failedResults.length > 0) {
    aggregated += "\n✗ Failed Steps:\n";
    failedResults.forEach((r) => {
      aggregated += `\nStep ${r.stepId}: ${r.error}\n`;
    });
  }

  return aggregated;
}
