import { z } from "zod";

export const suggestedRoleSchema = z.object({
  roleKey: z.string().min(1).max(120),
  name: z.string().min(1).max(255),
  responsibility: z.string().min(1).max(1200),
  requiredCapabilities: z.array(z.string().min(1).max(120)).min(1).max(10),
  taskSpecificInstructions: z.array(z.string().min(1).max(400)).default([]),
});

export const blueprintStepSchema = z.object({
  stepKey: z.string().min(1).max(120),
  order: z.number().int().min(1).max(10),
  roleKey: z.string().min(1).max(120),
  objective: z.string().min(1).max(1200),
  expectedOutput: z.string().min(1).max(1200),
  dependsOn: z.array(z.string()).default([]),
});

export const executionBlueprintSchema = z.object({
  objective: z.string().min(1).max(1600),
  deliverables: z.array(z.string().min(1).max(255)).min(1).max(10),
  requiredCapabilities: z.array(z.string().min(1).max(120)).min(1).max(20),
  suggestedRoles: z.array(suggestedRoleSchema).min(1).max(6),
  workflowSteps: z.array(blueprintStepSchema).min(1).max(10),
  assumptions: z.array(z.string().max(400)).default([]),
  constraints: z.array(z.string().max(400)).default([]),
  risks: z.array(z.string().max(400)).default([]),
});

export type SuggestedRole = z.infer<typeof suggestedRoleSchema>;
export type BlueprintStep = z.infer<typeof blueprintStepSchema>;
export type ExecutionBlueprintPlan = z.infer<typeof executionBlueprintSchema>;
