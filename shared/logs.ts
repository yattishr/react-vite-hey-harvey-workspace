import { z } from "zod";

export const logInput = z
  .object({
    organizationId: z.number().int().positive().optional(),
    query: z.string().max(2000).default(""),
    start: z.string().datetime(),
    end: z.string().datetime(),
    cursor: z
      .object({
        timestamp: z.string().datetime(),
        id: z.string().regex(/^(runtime|execution):\d+$/),
      })
      .optional(),
  })
  .refine(
    v =>
      Date.parse(v.end) > Date.parse(v.start) &&
      Date.parse(v.end) - Date.parse(v.start) <= 31 * 86400000,
    {
      message: "Choose a time range between one millisecond and 31 days.",
    }
  );

export type LogInput = z.infer<typeof logInput>;
export type LogEntry = {
  id: string;
  timestamp: string;
  severity: "INFO" | "WARNING" | "ERROR";
  source: "runtime" | "execution";
  message: string;
  taskId: number;
  taskRunId: number | null;
  agentRunId: number | null;
  correlationId: string | null;
  traceId: string | null;
  payload: Record<string, unknown>;
};

export const logFields = [
  "severity",
  "source",
  "taskId",
  "taskRunId",
  "agentRunId",
  "correlationId",
  "traceId",
  "message",
] as const;
export type LogTerm = { field: (typeof logFields)[number]; value: string };

/** Deliberately small grammar: newline-separated field=value clauses joined by AND. */
export function parseLogQuery(query: string): LogTerm[] {
  const terms: LogTerm[] = [];
  let rest = query.trim();
  while (rest) {
    const match = /^([a-zA-Z]+)\s*=\s*("(?:[^"\\]|\\.)*"|[^\s"]+)/.exec(rest);
    if (!match || !logFields.includes(match[1] as LogTerm["field"])) {
      throw new Error(
        `Use field=value clauses. Fields: ${logFields.join(", ")}.`
      );
    }
    const field = match[1] as LogTerm["field"];
    let value: string;
    try {
      value = match[2].startsWith('"') ? JSON.parse(match[2]) : match[2];
    } catch {
      throw new Error("Invalid quoted value. Use JSON-style double quotes.");
    }
    if (!value || value.length > 500)
      throw new Error("Values must contain 1–500 characters.");
    if (
      field.endsWith("Id") &&
      ["taskId", "taskRunId", "agentRunId"].includes(field) &&
      !/^[1-9]\d{0,9}$/.test(value)
    )
      throw new Error(`${field} must be a positive integer.`);
    if (field === "severity" && !["INFO", "WARNING", "ERROR"].includes(value))
      throw new Error("Severity must be INFO, WARNING, or ERROR.");
    if (field === "source" && !["runtime", "execution"].includes(value))
      throw new Error("Source must be runtime or execution.");
    terms.push({ field, value });
    rest = rest.slice(match[0].length);
    if (!rest.trim()) break;
    const separator = /^(?:[ \t]+AND\s+|[ \t]*\r?\n\s*)/.exec(rest);
    if (!separator)
      throw new Error(
        "Separate clauses with AND or a new line. OR and other operators are not supported."
      );
    rest = rest.slice(separator[0].length);
    if (!rest.trim()) throw new Error("Add a clause after AND.");
    if (terms.length >= 20) throw new Error("Use at most 20 clauses.");
  }
  return terms;
}
