import { RuntimeError } from "./errors";

export function createTimeoutSignal(
  milliseconds: number,
  code: "STEP_TIMEOUT" | "RUN_TIMEOUT"
) {
  const controller = new AbortController();
  const timer = setTimeout(() => {
    controller.abort(
      new RuntimeError(
        code,
        code === "STEP_TIMEOUT" ? "The step timed out" : "The run timed out"
      )
    );
  }, milliseconds);
  timer.unref?.();
  return { signal: controller.signal, clear: () => clearTimeout(timer) };
}

export function combineSignals(signals: AbortSignal[]) {
  const controller = new AbortController();
  const abort = (signal: AbortSignal) => {
    if (!controller.signal.aborted) controller.abort(signal.reason);
  };
  for (const signal of signals) {
    if (signal.aborted) abort(signal);
    else signal.addEventListener("abort", () => abort(signal), { once: true });
  }
  return controller.signal;
}
