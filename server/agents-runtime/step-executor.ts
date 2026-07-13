import { generateTraceId } from "@openai/agents";
import type {
  AgentTemplate,
  Task,
  TaskRun,
  TeamMember,
} from "../../drizzle/schema";
import {
  createTaskArtifact,
  toArtifactReference,
} from "../execution/artifactRepository";
import {
  createAgentRun,
  updateAgentRun,
} from "../execution/agentRunRepository";
import { compileAgent } from "./agent-compiler";
import { asRuntimeError, RuntimeError } from "./errors";
import { normalizeRuntimeEvent } from "./event-normalizer";
import { composeStepInput } from "./input-composer";
import { getOutputContract } from "./output-contracts";
import { publishRuntimeEvent } from "./repositories/event-repository";
import { combineSignals, createTimeoutSignal } from "./timeout";
import type { AgentsRunnerPort, WorkspaceStepOutput } from "./types";

export async function executeSdkStep(input: {
  task: Task;
  taskRun: TaskRun;
  member: TeamMember;
  template: AgentTemplate;
  upstreamArtifacts: Array<{
    id: number;
    title: string;
    content: unknown;
    contentText: string | null;
  }>;
  runner: AgentsRunnerPort;
  signal: AbortSignal;
  model: string;
  maxTurns: number;
  stepTimeoutMs: number;
  maxRetries: number;
}) {
  let lastError: RuntimeError | undefined;
  const outputContract = getOutputContract("workspace_step_v1");
  for (let attempt = 1; attempt <= input.maxRetries + 1; attempt += 1) {
    const traceId = generateTraceId();
    const run = await createAgentRun({
      organizationId: input.task.organizationId,
      taskId: input.task.id,
      taskTeamId: input.taskRun.taskTeamId!,
      taskRunId: input.taskRun.id,
      teamMemberId: input.member.id,
      agentTemplateId: input.template.id,
      agentTemplateVersion: input.member.agentTemplateVersion,
      attempt,
      status: "running",
      runtimeStatus: attempt === 1 ? "running" : "retrying",
      inputContext: {
        outputContractKey: "workspace_step_v1",
        upstreamArtifactIds: input.upstreamArtifacts.map(
          artifact => artifact.id
        ),
      },
      model: input.model,
      promptVersion: "v1.2",
      correlationId: input.taskRun.correlationId,
      openaiTraceId: traceId,
      startedAt: new Date(),
    });

    await publishRuntimeEvent({
      organizationId: input.task.organizationId,
      taskRunId: input.taskRun.id,
      agentRunId: run.id,
      type: attempt === 1 ? "step_started" : "step_retrying",
      payload: {
        position: input.member.workflowOrder,
        attempt,
        agentName: input.template.name,
      },
    });

    const timeout = createTimeoutSignal(input.stepTimeoutMs, "STEP_TIMEOUT");
    const signal = combineSignals([input.signal, timeout.signal]);
    try {
      const agent = compileAgent({
        template: input.template,
        outputSchema: outputContract,
        model: input.model,
      });
      const result = await input.runner.run<WorkspaceStepOutput>(
        agent,
        composeStepInput({
          task: input.task,
          member: input.member,
          template: input.template,
          upstreamArtifacts: input.upstreamArtifacts.map(artifact => ({
            title: artifact.title,
            contentText:
              artifact.contentText ??
              (typeof artifact.content === "string"
                ? artifact.content
                : JSON.stringify(artifact.content)),
          })),
          retryFeedback:
            lastError?.code === "OUTPUT_VALIDATION_FAILED"
              ? "The previous response did not match the required structured output. Return summary, content, and optional data only."
              : undefined,
        }),
        {
          context: {
            organizationId: input.task.organizationId,
            userId: input.task.userId,
            taskId: input.task.id,
            taskRunId: input.taskRun.id,
            taskTeamId: input.taskRun.taskTeamId!,
            teamMemberId: input.member.id,
            agentRunId: run.id,
            agentTemplateId: input.template.id,
            correlationId: input.taskRun.correlationId,
            abortSignal: signal,
          },
          maxTurns: input.maxTurns,
          signal,
          traceId,
          correlationId: input.taskRun.correlationId,
          onEvent: async event => {
            const normalized = normalizeRuntimeEvent(event);
            await publishRuntimeEvent({
              organizationId: input.task.organizationId,
              taskRunId: input.taskRun.id,
              agentRunId: run.id,
              ...normalized,
            });
          },
        }
      );
      const output = outputContract.parse(result.output);
      if (signal.aborted) throw signal.reason;

      const artifact = await createTaskArtifact({
        organizationId: input.task.organizationId,
        taskId: input.task.id,
        taskTeamId: input.taskRun.taskTeamId!,
        taskRunId: input.taskRun.id,
        agentRunId: run.id,
        artifactType: "structured_data",
        schemaVersion: 1,
        title: `${input.template.name} output`,
        content: output,
        contentText: output.content,
        mimeType: "application/json",
      });
      await updateAgentRun(input.task.organizationId, run.id, {
        status: "completed",
        runtimeStatus: "succeeded",
        runtimeIdentifier: result.runtimeIdentifier,
        openaiTraceId: result.openaiTraceId ?? traceId,
        output: {
          summary: output.summary,
          artifacts: [toArtifactReference(artifact)],
        },
        completedAt: new Date(),
      });
      await publishRuntimeEvent({
        organizationId: input.task.organizationId,
        taskRunId: input.taskRun.id,
        agentRunId: run.id,
        type: "step_succeeded",
        payload: {
          position: input.member.workflowOrder,
          attempt,
          artifactId: artifact.id,
        },
      });
      return { run, artifact, output, traceId };
    } catch (error) {
      const normalized =
        error instanceof Error && error.name === "ZodError"
          ? new RuntimeError(
              "OUTPUT_VALIDATION_FAILED",
              "The step returned invalid structured output",
              true,
              { cause: error }
            )
          : signal.aborted && signal.reason instanceof RuntimeError
            ? signal.reason
            : asRuntimeError(error);
      lastError = normalized;
      const terminalStatus =
        normalized.code === "STEP_TIMEOUT" || normalized.code === "RUN_TIMEOUT"
          ? "timed_out"
          : normalized.code === "RUN_CANCELLED"
            ? "cancelled"
            : "failed";
      await updateAgentRun(input.task.organizationId, run.id, {
        status: terminalStatus === "cancelled" ? "cancelled" : "failed",
        runtimeStatus: terminalStatus,
        error: { code: normalized.code, retryable: normalized.retryable },
        errorCode: normalized.code,
        errorMessage: normalized.message,
        completedAt: new Date(),
      });
      await publishRuntimeEvent({
        organizationId: input.task.organizationId,
        taskRunId: input.taskRun.id,
        agentRunId: run.id,
        type:
          terminalStatus === "failed" &&
          normalized.retryable &&
          attempt <= input.maxRetries
            ? "step_retry_scheduled"
            : `step_${terminalStatus}`,
        payload: {
          position: input.member.workflowOrder,
          attempt,
          errorCode: normalized.code,
        },
      });
      if (!normalized.retryable || attempt > input.maxRetries) throw normalized;
    } finally {
      timeout.clear();
    }
  }
  throw (
    lastError ??
    new RuntimeError("MODEL_REQUEST_FAILED", "The step failed", false)
  );
}
