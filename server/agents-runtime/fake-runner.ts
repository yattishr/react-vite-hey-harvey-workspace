import type {
  AgentsRunnerPort,
  RuntimeRunOptions,
  RuntimeRunResult,
} from "./types";

export class FakeAgentsRunner implements AgentsRunnerPort {
  readonly calls: Array<{ input: string; options: RuntimeRunOptions }> = [];

  constructor(
    private readonly results: Array<RuntimeRunResult<unknown> | Error>
  ) {}

  async run<TOutput>(
    _agent: Parameters<AgentsRunnerPort["run"]>[0],
    input: string,
    options: RuntimeRunOptions
  ): Promise<RuntimeRunResult<TOutput>> {
    this.calls.push({ input, options });
    if (options.signal.aborted) throw options.signal.reason;
    await options.onEvent({ type: "model_started", payload: {} });
    const next = this.results.shift();
    if (!next) throw new Error("Fake runner has no queued result");
    if (next instanceof Error) throw next;
    await options.onEvent({ type: "model_completed", payload: {} });
    return next as RuntimeRunResult<TOutput>;
  }
}
