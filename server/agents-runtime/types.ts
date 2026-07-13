import type { Agent } from "@openai/agents";

export type TaskRuntime = "legacy" | "openai_agents_sdk";
export type RuntimeRunStatus =
  | "queued"
  | "running"
  | "succeeded"
  | "failed"
  | "cancel_requested"
  | "cancelled"
  | "timed_out";

export type RuntimeStepStatus =
  | "pending"
  | "running"
  | "retrying"
  | "succeeded"
  | "failed"
  | "cancelled"
  | "timed_out";

export interface RuntimeExecutionContext {
  organizationId: number;
  userId: number;
  taskId: number;
  taskRunId: number;
  taskTeamId: number;
  teamMemberId: number;
  agentRunId: number;
  agentTemplateId: number;
  correlationId: string;
  abortSignal: AbortSignal;
}

export interface RuntimeStreamEvent {
  type: "model_started" | "model_progress" | "model_completed";
  payload: Record<string, unknown>;
}

export interface RuntimeRunOptions {
  context: RuntimeExecutionContext;
  maxTurns: number;
  signal: AbortSignal;
  traceId: string;
  correlationId: string;
  onEvent: (event: RuntimeStreamEvent) => Promise<void>;
}

export interface RuntimeRunResult<TOutput> {
  output: TOutput;
  runtimeIdentifier?: string;
  openaiTraceId?: string;
}

export interface AgentsRunnerPort {
  run<TOutput>(
    agent: Agent<RuntimeExecutionContext, any>,
    input: string,
    options: RuntimeRunOptions
  ): Promise<RuntimeRunResult<TOutput>>;
}

export interface WorkspaceStepOutput {
  summary: string;
  content: string;
  data?: Record<string, unknown>;
}
