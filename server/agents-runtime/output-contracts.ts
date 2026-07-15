import { z } from "zod";
import { RuntimeError } from "./errors";

export const workspaceStepOutputSchema = z
  .object({
    summary: z.string().min(1).max(1_000),
    content: z.string().min(1).max(100_000),
  })
  .strict();

const contracts = new Map<string, z.ZodObject<any>>([
  ["workspace_step_v1", workspaceStepOutputSchema],
]);

export function getOutputContract(
  key: "workspace_step_v1"
): typeof workspaceStepOutputSchema;
export function getOutputContract(key: string): z.ZodObject<any>;
export function getOutputContract(key: string) {
  const contract = contracts.get(key);
  if (!contract) {
    throw new RuntimeError(
      "RUNTIME_COMPILATION_FAILED",
      `Unsupported output contract: ${key}`
    );
  }
  return contract;
}

export function registerOutputContract(key: string, schema: z.ZodObject<any>) {
  if (contracts.has(key))
    throw new Error(`Output contract already registered: ${key}`);
  contracts.set(key, schema);
}
