import { sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { getDb } from "../db";
import { parseLogQuery, type LogInput, type LogEntry } from "../../shared/logs";

export function buildLogsQuery(organizationId: number, input: LogInput) {
  const clauses = parseLogQuery(input.query).map(({ field, value }) => {
    const column = sql.identifier(field);
    return field === "message"
      ? sql`strpos(lower(${column}), lower(${value})) > 0`
      : sql`${column}::text = ${value}`;
  });
  const filter = clauses.length ? sql.join(clauses, sql` AND `) : sql`true`;
  const cursor = input.cursor
    ? sql`(timestamp, id) < (${input.cursor.timestamp}::text, ${input.cursor.id}::text)`
    : sql`true`;
  return sql`
    WITH entries AS (
      SELECT 'runtime:' || e.id AS id,
        to_char(e."createdAt", 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS timestamp,
        CASE WHEN e.type ~ '(failed|error|timed_out)' THEN 'ERROR'
             WHEN e.type ~ '(retry|cancel|warning)' THEN 'WARNING' ELSE 'INFO' END AS severity,
        'runtime' AS source, e.type AS message, r."taskId", e."taskRunId", e."agentRunId",
        r."correlationId", r."openaiTraceId" AS "traceId",
        jsonb_strip_nulls(jsonb_build_object('sequence', e.sequence,
          'position', e.payload->'position', 'attempt', e.payload->'attempt',
          'artifactId', e.payload->'artifactId', 'errorCode', e.payload->'errorCode',
          'model', e.payload->'model', 'reasoningEffort', e.payload->'reasoningEffort')) AS payload
      FROM "runtimeEvents" e JOIN "taskRuns" r ON r.id = e."taskRunId" AND r."organizationId" = e."organizationId"
      WHERE e."organizationId" = ${organizationId}
        AND e."createdAt" >= ${input.start}::timestamp AND e."createdAt" < ${input.end}::timestamp
      UNION ALL
      SELECT 'execution:' || l.id,
        to_char(l."createdAt", 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
        CASE WHEN lower(l.action) ~ '(failed|error|timeout)' THEN 'ERROR'
             WHEN lower(l.action) ~ '(retry|cancel|warning)' THEN 'WARNING' ELSE 'INFO' END,
        'execution', l.action, l."taskId", NULL::integer, NULL::integer, NULL::text, NULL::text,
        jsonb_build_object('step', l.step, 'agentId', l."agentId")
      FROM "taskExecutionLogs" l JOIN tasks t ON t.id = l."taskId"
      WHERE t."organizationId" = ${organizationId}
        AND l."createdAt" >= ${input.start}::timestamp AND l."createdAt" < ${input.end}::timestamp
    ), filtered AS (SELECT * FROM entries WHERE ${filter}),
    page AS (SELECT * FROM filtered WHERE ${cursor} ORDER BY timestamp DESC, id DESC LIMIT 101),
    buckets AS (
      SELECT least(39, floor(extract(epoch FROM (timestamp::timestamp - ${input.start}::timestamp)) /
        (extract(epoch FROM (${input.end}::timestamp - ${input.start}::timestamp)) / 40)))::int AS bucket,
        count(*)::int AS count, count(*) FILTER (WHERE severity = 'ERROR')::int AS errors
      FROM filtered GROUP BY 1
    ), facets AS (SELECT severity, source, count(*)::int AS count FROM filtered GROUP BY severity, source)
    SELECT (SELECT count(*)::int FROM filtered) AS total,
      coalesce((SELECT jsonb_agg(to_jsonb(page) ORDER BY timestamp DESC, id DESC) FROM page), '[]'::jsonb) AS entries,
      coalesce((SELECT jsonb_agg(to_jsonb(buckets) ORDER BY bucket) FROM buckets), '[]'::jsonb) AS buckets,
      coalesce((SELECT jsonb_agg(to_jsonb(facets)) FROM facets), '[]'::jsonb) AS facets
  `;
}

export type LogsResult = {
  entries: LogEntry[];
  total: number;
  buckets: { bucket: number; count: number; errors: number }[];
  facets: { severity: string; source: string; count: number }[];
  nextCursor?: { timestamp: string; id: string };
};

export async function searchLogs(
  organizationId: number,
  input: LogInput
): Promise<LogsResult> {
  let query;
  try {
    query = buildLogsQuery(organizationId, input);
  } catch (error) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: (error as Error).message,
    });
  }
  const db = await getDb();
  if (!db)
    throw new TRPCError({
      code: "SERVICE_UNAVAILABLE",
      message: "Log storage is unavailable.",
    });
  const result = await db.transaction(async tx => {
    await tx.execute(sql`SET TRANSACTION READ ONLY`);
    await tx.execute(sql`SET LOCAL statement_timeout = '8s'`);
    return tx.execute(query);
  });
  const row = result[0] as unknown as LogsResult;
  const hasMore = row.entries.length > 100;
  row.entries = row.entries.slice(0, 100);
  const last = row.entries.at(-1);
  return {
    ...row,
    nextCursor:
      hasMore && last ? { timestamp: last.timestamp, id: last.id } : undefined,
  };
}
