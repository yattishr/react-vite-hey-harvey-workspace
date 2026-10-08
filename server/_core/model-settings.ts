import { AsyncLocalStorage } from "node:async_hooks";
import { TRPCError } from "@trpc/server";
import type { ReasoningEffort } from "../../shared/model-settings";

const requestSettings = new AsyncLocalStorage<ReasoningEffort>();

export function getReasoningEffort(): ReasoningEffort {
  return requestSettings.getStore() ?? "none";
}

// Async context follows background tasks spawned by a request, without sharing
// mutable settings across users or altering a run when a later request toggles it.
export function withReasoningEffort<T>(
  effort: ReasoningEffort,
  run: () => T
): T {
  return requestSettings.run(effort, run);
}

export function withReasoningHeader<T>(
  header: string | string[] | undefined,
  run: () => T
): T {
  if (header !== undefined && header !== "none" && header !== "medium") {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Reasoning must be off (none) or on (medium).",
    });
  }
  return withReasoningEffort(header ?? "none", run);
}
