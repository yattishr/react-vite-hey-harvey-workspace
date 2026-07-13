import type { RuntimeStreamEvent } from "./types";

export function normalizeRuntimeEvent(event: RuntimeStreamEvent) {
  switch (event.type) {
    case "model_started":
      return { type: "step_model_started", payload: {} };
    case "model_completed":
      return { type: "step_model_completed", payload: {} };
    case "model_progress":
      return {
        type: "step_progress",
        payload: {
          itemType:
            typeof event.payload.itemType === "string"
              ? event.payload.itemType
              : "update",
        },
      };
  }
}
