import type { ReasoningEffort } from "@shared/model-settings";

const key = "harvey-reasoning-effort";
const changed = "harvey-reasoning-changed";

export function getReasoningEffort(): ReasoningEffort {
  try {
    return localStorage.getItem(key) === "medium" ? "medium" : "none";
  } catch {
    return "none";
  }
}

export function setReasoningEffort(effort: ReasoningEffort) {
  localStorage.setItem(key, effort);
  window.dispatchEvent(new Event(changed));
}

export function subscribeReasoning(listener: () => void) {
  window.addEventListener(changed, listener);
  window.addEventListener("storage", listener);
  return () => {
    window.removeEventListener(changed, listener);
    window.removeEventListener("storage", listener);
  };
}
