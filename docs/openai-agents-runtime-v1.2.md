# OpenAI Agents SDK runtime V1.2

Hey Harvey keeps task, team, agent-template, artifact, audit, and tenant ownership in the Workspace database. The SDK is an additive execution engine selected once when a `taskRuns` record is created. Existing runs never change runtime.

## Repository discovery

This repository is React 19 + Vite on the client and Express + tRPC + Drizzle/Postgres on the server. `server/taskExecution.ts` is the shared task execution boundary; `server/execution/taskExecutor.ts` is the reusable-agent sequential executor; `server/_core/llm.ts` remains the legacy `invokeLLM` adapter. Agent Factory persists `agents`/`workflows`, while the current reusable execution model persists `agentTemplates`, `taskTeams`, ordered `teamMembers`, `agentRuns`, and `taskArtifacts`. Organization-aware tRPC middleware resolves tenant identity server-side. The application previously had no validated runtime environment schema or dedicated logger, so V1.2 contains those concerns inside the SDK adapter boundary.

## Setup

1. Use Node.js 22.19 or newer and install with `corepack pnpm install`.
2. Apply `drizzle/postgres/0004_openai_agents_runtime.sql` with the normal migration command.
3. Configure the variables documented in `.env.example`.
4. Start with `OPENAI_AGENTS_RUNTIME_ENABLED=false`, verify legacy runs, then enable the flag for the intended deployment.

The repository's `dev`, `start`, and database smoke-test scripts set `NODE_USE_SYSTEM_CA=1` before Node starts. This keeps TLS verification enabled while allowing Node to trust certificate authorities installed in the operating-system trust store, which is required on some managed Windows networks. Deployments that start `dist/index.js` directly must set the same process environment variable before Node launches, or configure a PEM bundle with `NODE_EXTRA_CA_CERTS`. Do not use `NODE_TLS_REJECT_UNAUTHORIZED=0`.

The deterministic test suite runs with `pnpm test`. The legacy database-mutating smoke suite is opt-in via `pnpm test:smoke` and must target a disposable fixture database.

When enabled, `OPENAI_API_KEY` is required. `OPENAI_AGENTS_TRACING_ENABLED` defaults to true outside tests. Trace input/output capture is disabled by the adapter; only identifiers and non-sensitive correlation metadata are attached.

## Migration

Migration `0004_openai_agents_runtime` adds:

- `taskRuns`, the immutable whole-run runtime selection and terminal state;
- `runtimeEvents`, a sanitized ordered product event stream;
- step-attempt runtime, attempt, correlation, trace, and error fields on `agentRuns`;
- run linkage, schema version, and safe text projection on `taskArtifacts`.

Existing rows remain readable because all new links on historical `agentRuns` and `taskArtifacts` are nullable. Historical artifacts are not rewritten.

## Runtime behavior

The SDK path assembles or reuses the existing task team, compiles persisted `agentTemplates`, and executes ordered `teamMembers` sequentially. The only registered V1.2 output contract is `workspace_step_v1`. The server-controlled tool registry is intentionally empty; unknown persisted tool keys fail compilation before model execution.

The UI polls durable run state and sanitized runtime events, so a refresh recovers the timeline. Cancellation updates durable state and aborts an active run in the current server process. A database status check also prevents the next step from starting after a cancellation request.

## Rollback

Set `OPENAI_AGENTS_RUNTIME_ENABLED=false`. New runs will use `legacy`; existing SDK runs keep their persisted runtime and are never switched. Do not remove migration fields or the legacy executor during the V1.2 rollout.

## Operational limitations

- Execution remains request-process based because this repository has no durable job queue.
- An active model request can only be immediately aborted by the server process that owns it; cross-process cancellation is observed between steps through the database.
- V1.2 exposes no external tools, connectors, handoffs, parallel branches, approvals, MCP, browser, shell, or sandbox capabilities.
- The output registry currently maps all generated task-team steps to `workspace_step_v1`; additional contracts must be explicitly registered before use.
- The older standalone Workflows-page executor remains a legacy-only surface in V1.2; the task-first Agent Factory execution path is the SDK migration boundary.
