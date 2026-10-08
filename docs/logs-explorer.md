# Logs Explorer

Open **Logs Explorer** in the workspace sidebar, or **Explore logs** from a task.

The explorer reads existing `runtimeEvents` joined to `taskRuns`, and legacy `taskExecutionLogs` joined to `tasks`. No schema migration or new credentials are needed. New events written by the existing execution system appear on the next refresh. This is application execution observability, not an infrastructure log collector or a complete Google Cloud Logging implementation.

## Querying

Select a time window (at most 93 days), then run a query. The window is inclusive at the start and exclusive at the end. Display timestamps use the browser's local time; custom inputs are labeled UTC. Empty queries match all entries in the selected window.

```text
severity=ERROR
source=runtime
```

Supported fields: `severity`, `source`, `taskId`, `taskRunId`, `agentRunId`, `correlationId`, `traceId`, and `message`. Clauses use `=` and are joined by a newline or `AND`. Values containing spaces require JSON-style double quotes. `message` performs a literal, case-insensitive substring search over the event name; other fields match exactly. Unsupported fields and operators return validation errors. This is a small application query language, not SQL or the full Google Cloud query language.

Severity is inferred from the event name: failures/errors/timeouts are ERROR, retry/cancellation/warning events are WARNING, and other events are INFO.

## Exploration

- The histogram and field counts cover all matches in the window, not just the current page. Select a histogram bar to narrow the window.
- Expand an entry for identifiers and structured metadata. **Show related events** filters by correlation ID (or task ID for legacy entries) within the current time window.
- Results use cursor pagination, 100 entries per page. Export downloads only the displayed page as JSON.
- Live refresh polls every 10 seconds and displays the latest page in a moving relative window. It is not a durable streaming subscription. Paging or choosing a custom time window pauses live refresh.
- Saved queries are scoped to the current user and organization in browser storage. They save the expression, not the time range. They do not sync across devices.
- Shared links include the applied expression and absolute time range. They do not grant access to data.

## Access and data handling

The tRPC endpoint requires an authenticated organization member. The organization is taken from the server session; a client organization mismatch is rejected. Both SQL branches restrict the organization before returning data, including the run/event join. SQL values are parameterized, and field identifiers come from a fixed allowlist. Client cache keys include the organization ID.

Only selected runtime metadata (`sequence`, `position`, `attempt`, `artifactId`, `errorCode`) and legacy step/agent identifiers are returned. Raw prompts, model outputs, and legacy free-form `details` are excluded from this endpoint and its export. Existing event names remain visible. Database queries are read-only with an eight-second statement timeout. This feature does not change retention or existing Data API/RLS policies.

At high volume, evaluate query plans and add organization/time indexes through the repository's migration process. The existing indexes prioritize per-task runtime retrieval; a 93-day organization-wide scan can time out on large datasets. Narrow the time window if that happens. Alerts, log sinks, infrastructure ingestion, full-text payload search, and persistent server-side saved queries are outside this version.

## Validation

```powershell
npm run check
npx vitest run server/observability/logs.test.ts
$env:NODE_USE_SYSTEM_CA='1'
$env:RUN_LOGS_DATABASE_TESTS='true'
npx vitest run server/observability/logs.integration.test.ts
npm run build
```

Database integration tests create temporary tables on a single transaction connection. They leave production tables untouched and cover tenant isolation, inconsistent cross-tenant joins, redaction, filtering, histogram counts, and cursor pagination with tied timestamps.
