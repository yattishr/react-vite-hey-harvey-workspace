export function logRuntimeEvent(
  level: "info" | "warn" | "error",
  message: string,
  metadata: Record<string, string | number | boolean | null | undefined>
) {
  const safeMetadata = Object.fromEntries(
    Object.entries(metadata).filter(([, value]) => value !== undefined)
  );
  console[level](`[AgentsRuntime] ${message}`, safeMetadata);
}
