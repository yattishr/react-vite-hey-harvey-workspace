const activeRuns = new Map<number, AbortController>();

export function registerActiveRun(
  taskRunId: number,
  controller: AbortController
) {
  activeRuns.set(taskRunId, controller);
  return () => {
    if (activeRuns.get(taskRunId) === controller) activeRuns.delete(taskRunId);
  };
}

export function cancelActiveRun(taskRunId: number) {
  const controller = activeRuns.get(taskRunId);
  if (!controller) return false;
  controller.abort(new DOMException("Run cancelled", "AbortError"));
  return true;
}
