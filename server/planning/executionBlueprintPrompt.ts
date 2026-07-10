export const executionBlueprintJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "objective",
    "deliverables",
    "requiredCapabilities",
    "suggestedRoles",
    "workflowSteps",
    "assumptions",
    "constraints",
    "risks",
  ],
  properties: {
    objective: { type: "string" },
    deliverables: { type: "array", items: { type: "string" } },
    requiredCapabilities: { type: "array", items: { type: "string" } },
    suggestedRoles: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "roleKey",
          "name",
          "responsibility",
          "requiredCapabilities",
          "taskSpecificInstructions",
        ],
        properties: {
          roleKey: { type: "string" },
          name: { type: "string" },
          responsibility: { type: "string" },
          requiredCapabilities: { type: "array", items: { type: "string" } },
          taskSpecificInstructions: { type: "array", items: { type: "string" } },
        },
      },
    },
    workflowSteps: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["stepKey", "order", "roleKey", "objective", "expectedOutput", "dependsOn"],
        properties: {
          stepKey: { type: "string" },
          order: { type: "integer" },
          roleKey: { type: "string" },
          objective: { type: "string" },
          expectedOutput: { type: "string" },
          dependsOn: { type: "array", items: { type: "string" } },
        },
      },
    },
    assumptions: { type: "array", items: { type: "string" } },
    constraints: { type: "array", items: { type: "string" } },
    risks: { type: "array", items: { type: "string" } },
  },
} as const;

export function buildExecutionBlueprintPrompt(input: { title: string; description: string }) {
  return `Task title:
${input.title}

Task description:
${input.description}

Create a sequential execution blueprint. Generate reusable specialist roles and capabilities, not persisted agents. Keep the workflow to the smallest useful team.

Use canonical roleKey values. Prefer these when appropriate:
- research_analyst
- investment_research_analyst
- financial_analyst
- risk_analyst
- valuation_analyst
- report_writer
- qa_reviewer
- marketing_analyst
- operations_analyst
- technology_consultant
- project_manager
- workflow_designer

Keep company names, products, industries, and task subjects out of roleKey values. Put task-specific subject matter in taskSpecificInstructions only.

Avoid duplicate workflow steps for the same roleKey unless the same reusable specialist intentionally performs distinct sequential stages. If the same roleKey is used more than once, make each step objective materially different.`;
}
