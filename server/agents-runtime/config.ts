import { z } from "zod";

const booleanFromEnv = z
  .enum(["true", "false"])
  .default("false")
  .transform(value => value === "true");

const positiveInteger = (defaultValue: string, max: number) =>
  z.coerce.number().int().positive().max(max).default(Number(defaultValue));

const agentsRuntimeEnvironmentSchema = z.object({
  OPENAI_AGENTS_RUNTIME_ENABLED: booleanFromEnv,
  OPENAI_AGENTS_TRACING_ENABLED: z
    .enum(["true", "false"])
    .default(process.env.NODE_ENV === "test" ? "false" : "true")
    .transform(value => value === "true"),
  OPENAI_AGENTS_DEFAULT_MODEL: z.string().trim().min(1).default("gpt-4o-mini"),
  OPENAI_AGENTS_MAX_TURNS: positiveInteger("8", 50),
  OPENAI_AGENTS_STEP_TIMEOUT_MS: positiveInteger("90000", 900_000),
  OPENAI_AGENTS_RUN_TIMEOUT_MS: positiveInteger("300000", 3_600_000),
  OPENAI_AGENTS_MAX_STEP_RETRIES: z.coerce
    .number()
    .int()
    .min(0)
    .max(3)
    .default(1),
});

export type AgentsRuntimeConfig = ReturnType<typeof getAgentsRuntimeConfig>;

let cachedConfig: z.infer<typeof agentsRuntimeEnvironmentSchema> | undefined;

export function getAgentsRuntimeConfig() {
  cachedConfig ??= agentsRuntimeEnvironmentSchema.parse(process.env);
  return cachedConfig;
}

export function validateAgentsRuntimeEnvironment() {
  const config = getAgentsRuntimeConfig();
  if (
    config.OPENAI_AGENTS_RUNTIME_ENABLED &&
    !process.env.OPENAI_API_KEY?.trim()
  ) {
    throw new Error(
      "OPENAI_API_KEY is required when OPENAI_AGENTS_RUNTIME_ENABLED=true"
    );
  }
  return config;
}

export function resetAgentsRuntimeConfigForTests() {
  cachedConfig = undefined;
}
