import { eq, and } from "drizzle-orm";
import { executionBlueprints, tasks, type ExecutionBlueprint, type Task } from "../../drizzle/schema";
import { invokeLLM } from "../_core/llm";
import { getDb } from "../db";
import { buildExecutionBlueprintPrompt, executionBlueprintJsonSchema } from "./executionBlueprintPrompt";
import { executionBlueprintSchema, type ExecutionBlueprintPlan } from "./executionBlueprintSchema";

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

export function buildFallbackBlueprint(task: Task): ExecutionBlueprintPlan {
  return {
    objective: task.description,
    deliverables: ["Completed task output"],
    requiredCapabilities: ["research", "analysis", "writing"],
    suggestedRoles: [
      {
        roleKey: "research_analyst",
        name: "Research Analyst",
        responsibility: "Gather and analyse task-relevant information.",
        requiredCapabilities: ["research", "analysis"],
        taskSpecificInstructions: ["Separate facts from assumptions."],
      },
      {
        roleKey: "output_writer",
        name: "Output Writer",
        responsibility: "Synthesize the analysis into the requested final output.",
        requiredCapabilities: ["writing", "synthesis"],
        taskSpecificInstructions: ["Use upstream artifacts as the source of truth."],
      },
    ],
    workflowSteps: [
      {
        stepKey: "research",
        order: 1,
        roleKey: "research_analyst",
        objective: "Research and analyse the task.",
        expectedOutput: "Research summary with key findings.",
        dependsOn: [],
      },
      {
        stepKey: "write_output",
        order: 2,
        roleKey: "output_writer",
        objective: "Create the final task output.",
        expectedOutput: "Final response ready for the user.",
        dependsOn: ["research"],
      },
    ],
    assumptions: [],
    constraints: ["Sequential execution only."],
    risks: [],
  };
}

export async function createExecutionBlueprint(task: Task) {
  let plan: ExecutionBlueprintPlan;

  try {
    const response = await invokeLLM({
      responseFormat: {
        type: "json_schema",
        json_schema: {
          name: "hey_harvey_execution_blueprint",
          strict: true,
          schema: executionBlueprintJsonSchema,
        },
      },
      messages: [
        {
          role: "system",
          content:
            "You are Harvey's task planner. Return structured reusable roles, capabilities, and sequential workflow steps. Do not create permanent agents.",
        },
        {
          role: "user",
          content: buildExecutionBlueprintPrompt({
            title: task.title,
            description: task.description,
          }),
        },
      ],
    });

    const content = extractTextContent(response.choices[0]?.message?.content);
    plan = executionBlueprintSchema.parse(JSON.parse(content));
  } catch (error) {
    console.warn("[ExecutionBlueprint] Falling back to deterministic blueprint", error);
    plan = buildFallbackBlueprint(task);
  }

  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db
    .insert(executionBlueprints)
    .values({
      organizationId: task.organizationId,
      taskId: task.id,
      ...plan,
    })
    .returning();

  if (!result[0]) throw new Error("Failed to create execution blueprint");

  await db
    .update(tasks)
    .set({
      status: "planning",
      executionBlueprintId: result[0].id,
    })
    .where(and(eq(tasks.organizationId, task.organizationId), eq(tasks.id, task.id)));

  return result[0];
}

export async function getExecutionBlueprint(organizationId: number, blueprintId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db
    .select()
    .from(executionBlueprints)
    .where(and(eq(executionBlueprints.organizationId, organizationId), eq(executionBlueprints.id, blueprintId)))
    .limit(1);

  return (result[0] as ExecutionBlueprint | undefined) ?? null;
}
