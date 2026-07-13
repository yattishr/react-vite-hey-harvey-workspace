import { Runner, withTrace } from "@openai/agents";
import { getAgentsRuntimeConfig } from "./config";
import type {
  AgentsRunnerPort,
  RuntimeRunOptions,
  RuntimeRunResult,
} from "./types";

let singletonRunner: Runner | undefined;

export function getAgentsRunner() {
  const config = getAgentsRuntimeConfig();
  singletonRunner ??= new Runner({
    tracingDisabled: !config.OPENAI_AGENTS_TRACING_ENABLED,
    traceIncludeSensitiveData: false,
    workflowName: "Hey Harvey Workspace sequential task run",
  });
  return singletonRunner;
}

export class OpenAIAgentsRunnerAdapter implements AgentsRunnerPort {
  async run<TOutput>(
    agent: Parameters<AgentsRunnerPort["run"]>[0],
    input: string,
    options: RuntimeRunOptions
  ): Promise<RuntimeRunResult<TOutput>> {
    return withTrace(
      "Hey Harvey Workspace step",
      async trace => {
        await options.onEvent({ type: "model_started", payload: {} });
        const streamed = await getAgentsRunner().run(agent, input, {
          stream: true,
          context: options.context,
          maxTurns: options.maxTurns,
          signal: options.signal,
        });

        for await (const event of streamed) {
          if (event.type === "run_item_stream_event") {
            await options.onEvent({
              type: "model_progress",
              payload: { itemType: event.name },
            });
          }
        }
        await streamed.completed;
        if (streamed.error) throw streamed.error;
        if (streamed.finalOutput === undefined)
          throw new Error("SDK run produced no final output");

        await options.onEvent({ type: "model_completed", payload: {} });
        return {
          output: streamed.finalOutput as TOutput,
          runtimeIdentifier: streamed.lastResponseId,
          openaiTraceId: trace.traceId,
        };
      },
      {
        traceId: options.traceId,
        groupId: options.correlationId,
        metadata: { correlationId: options.correlationId },
      }
    );
  }
}

export function resetAgentsRunnerForTests() {
  singletonRunner = undefined;
}
