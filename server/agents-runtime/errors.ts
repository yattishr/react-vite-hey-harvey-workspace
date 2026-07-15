export type RuntimeErrorCode =
  | "RUNTIME_CONFIGURATION_INVALID"
  | "RUNTIME_COMPILATION_FAILED"
  | "OUTPUT_VALIDATION_FAILED"
  | "STEP_TIMEOUT"
  | "RUN_TIMEOUT"
  | "RUN_CANCELLED"
  | "MAX_TURNS_EXCEEDED"
  | "TLS_CERTIFICATE_UNTRUSTED"
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

const TLS_CERTIFICATE_ERROR_CODES = new Set([
  "UNABLE_TO_VERIFY_LEAF_SIGNATURE",
  "SELF_SIGNED_CERT_IN_CHAIN",
  "DEPTH_ZERO_SELF_SIGNED_CERT",
  "UNABLE_TO_GET_ISSUER_CERT_LOCALLY",
]);

function findErrorCode(
  error: unknown,
  seen = new Set<unknown>()
): string | null {
  if (!error || typeof error !== "object" || seen.has(error)) return null;
  seen.add(error);

  const candidate = error as { code?: unknown; cause?: unknown };
  if (typeof candidate.code === "string") return candidate.code;
  return findErrorCode(candidate.cause, seen);
}

export function asRuntimeError(error: unknown): RuntimeError {
  if (error instanceof RuntimeError) return error;
  const causeCode = findErrorCode(error);
  if (causeCode && TLS_CERTIFICATE_ERROR_CODES.has(causeCode)) {
    return new RuntimeError(
      "TLS_CERTIFICATE_UNTRUSTED",
      "OpenAI TLS certificate validation failed. Start the server with system CA trust enabled.",
      false,
      { cause: error }
    );
  }
  if (error instanceof Error && error.name === "AbortError") {
    return new RuntimeError("RUN_CANCELLED", "The run was cancelled", false, {
      cause: error,
    });
  }
  const name = error instanceof Error ? error.constructor.name : "";
  if (name === "UserError") {
    return new RuntimeError(
      "RUNTIME_COMPILATION_FAILED",
      `The OpenAI agent configuration is invalid: ${error instanceof Error ? error.message : "unknown configuration error"}`,
      false,
      { cause: error }
    );
  }
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
