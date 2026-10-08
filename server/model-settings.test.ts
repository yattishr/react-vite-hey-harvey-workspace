import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import {
  getReasoningEffort,
  withReasoningEffort,
  withReasoningHeader,
} from "./_core/model-settings";
import { publicProcedure, router } from "./_core/trpc";
import { invokeLLM } from "./_core/llm";
import { compileAgent } from "./agents-runtime/agent-compiler";
import type { AgentTemplate } from "../drizzle/schema";
import type { TrpcContext } from "./_core/context";

vi.mock("./_core/env", () => ({
  ENV: {
    llmApiKey: "test-only-key",
    llmApiUrl: "https://api.openai.com/v1",
    llmModel: "gpt-6-luna",
  },
}));

afterEach(() => vi.unstubAllGlobals());

function mockFetch() {
  const fetch = vi
    .fn()
    .mockResolvedValue(
      new Response(
        JSON.stringify({
          id: "test",
          choices: [{ message: { content: "OK" } }],
        }),
        { status: 200 }
      )
    );
  vi.stubGlobal("fetch", fetch);
  return fetch;
}

describe("reasoning request settings", () => {
  it("defaults off and rejects unsupported header values", () => {
    expect(getReasoningEffort()).toBe("none");
    expect(withReasoningHeader(undefined, getReasoningEffort)).toBe("none");
    expect(() => withReasoningHeader("high", getReasoningEffort)).toThrow(
      "Reasoning must be off"
    );
    expect(() => withReasoningHeader(["medium"], getReasoningEffort)).toThrow();
  });

  it("isolates concurrent requests and retains the setting in detached work", async () => {
    let resolveBackground!: (value: string) => void;
    const background = new Promise<string>(resolve => {
      resolveBackground = resolve;
    });
    const values = await Promise.all([
      withReasoningEffort("medium", async () => {
        setTimeout(() => resolveBackground(getReasoningEffort()), 20);
        await new Promise(resolve => setTimeout(resolve, 5));
        return getReasoningEffort();
      }),
      withReasoningEffort("none", async () => {
        await Promise.resolve();
        return getReasoningEffort();
      }),
    ]);
    expect(values).toEqual(["medium", "none"]);
    expect(getReasoningEffort()).toBe("none");
    expect(await background).toBe("medium");
  });

  it("propagates the real tRPC header into downstream work", async () => {
    const testRouter = router({
      read: publicProcedure.query(() => getReasoningEffort()),
    });
    const ctx = {
      req: { headers: { "x-reasoning-effort": "medium" } },
    } as unknown as TrpcContext;
    expect(await testRouter.createCaller(ctx).read()).toBe("medium");
    expect(
      await testRouter
        .createCaller({ req: { headers: {} } } as TrpcContext)
        .read()
    ).toBe("none");
  });
});

describe("GPT-6 Luna API compatibility", () => {
  it.each(["none", "medium"] as const)(
    "sends Chat Completions effort=%s and the compatible token budget",
    async effort => {
      const fetch = mockFetch();
      await withReasoningEffort(effort, () =>
        invokeLLM({
          messages: [{ role: "user", content: "Hello" }],
          maxTokens: 100,
        })
      );
      const [url, init] = fetch.mock.calls[0];
      const payload = JSON.parse(init.body);
      expect(url).toBe("https://api.openai.com/v1/chat/completions");
      expect(payload.model).toBe("gpt-6-luna");
      expect(payload.reasoning_effort).toBe(effort);
      expect(payload.max_completion_tokens).toBe(100);
      expect(payload).not.toHaveProperty("max_tokens");
      expect(payload).not.toHaveProperty("reasoning");
      expect(payload).not.toHaveProperty("temperature");
    }
  );

  it("rejects reasoning plus Chat Completions tools before sending an invalid request", async () => {
    const fetch = mockFetch();
    await expect(
      withReasoningEffort("medium", () =>
        invokeLLM({
          messages: [],
          tools: [{ type: "function", function: { name: "example" } }],
        })
      )
    ).rejects.toThrow("Responses API");
    expect(fetch).not.toHaveBeenCalled();
  });

  it("preserves explicitly selected older models", async () => {
    const fetch = mockFetch();
    await invokeLLM({ messages: [], model: "gpt-4o-mini", maxTokens: 10 });
    const payload = JSON.parse(fetch.mock.calls[0][1].body);
    expect(payload.model).toBe("gpt-4o-mini");
    expect(payload.max_tokens).toBe(10);
    expect(payload).not.toHaveProperty("reasoning_effort");
  });

  it.each(["none", "medium"] as const)(
    "sets SDK Responses reasoning effort=%s",
    effort => {
      const template = {
        name: "Test",
        role: "Analyst",
        goal: "Test",
        backstory: null,
        defaultInstructions: [],
        toolPermissions: [],
      } as unknown as AgentTemplate;
      const agent = withReasoningEffort(effort, () =>
        compileAgent({
          template,
          model: "gpt-6-luna",
          outputSchema: z.object({ answer: z.string() }),
        })
      );
      expect(agent.modelSettings.reasoning?.effort).toBe(effort);
    }
  );
});
