export const DEFAULT_OPENAI_MODEL = "gpt-6-luna";
export const REASONING_HEADER = "x-reasoning-effort";
export type ReasoningEffort = "none" | "medium";

export function supportsReasoningToggle(model: string) {
  return (
    model === DEFAULT_OPENAI_MODEL ||
    model.startsWith(`${DEFAULT_OPENAI_MODEL}-`)
  );
}
