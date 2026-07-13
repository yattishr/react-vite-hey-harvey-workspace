import type { Tool } from "@openai/agents";
import { RuntimeError } from "../errors";
import type { RuntimeExecutionContext } from "../types";

const registry = new Map<string, Tool<RuntimeExecutionContext>>();

export function resolveRuntimeTools(toolKeys: string[]) {
  return toolKeys.map(key => {
    const tool = registry.get(key);
    if (!tool) {
      throw new RuntimeError(
        "RUNTIME_COMPILATION_FAILED",
        `Tool is not available in the V1.2 server registry: ${key}`
      );
    }
    return tool;
  });
}

export function listRuntimeToolKeys() {
  return Array.from(registry.keys());
}
