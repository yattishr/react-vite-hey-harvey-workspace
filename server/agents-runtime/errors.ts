export type RuntimeErrorCode =
  | "RUNTIME_CONFIGURATION_INVALID"
  | "RUNTIME_COMPILATION_FAILED"
  | "OUTPUT_VALIDATION_FAILED"
  | "STEP_TIMEOUT"
  | "RUN_TIMEOUT"
  | "RUN_CANCELLED"
  | "MAX_TURNS_EXCEEDED"
  | "MODEL_REQUEST_FAILED";

export class RuntimeError extends Error {
  constructor(
    public readonly code: RuntimeErrorCode,
    message: string,
    public readonly retryable = false,
    options?: ErrorOptions
  ) {
    super(message, options);
    this.name = "RuntimeError";
  }
}

export function asRuntimeError(error: unknown): RuntimeError {
  if (error instanceof RuntimeError) return error;
  if (error instanceof Error && error.name === "AbortError") {
    return new RuntimeError("RUN_CANCELLED", "The run was cancelled", false, {
      cause: error,
    });
  }
  const name = error instanceof Error ? error.constructor.name : "";
  if (name === "MaxTurnsExceededError") {
    return new RuntimeError(
      "MAX_TURNS_EXCEEDED",
      "The step exceeded its turn limit",
      false,
      {
        cause: error,
      }
    );
  }
  return new RuntimeError(
    "MODEL_REQUEST_FAILED",
    "The model request failed",
    true,
    {
      cause: error,
    }
  );
}
