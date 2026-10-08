import "dotenv/config";
import { describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { getDb } from "../db";
import { buildLogsQuery, type LogsResult } from "./service";

describe.skipIf(process.env.RUN_LOGS_DATABASE_TESTS !== "true")(
  "Logs SQL integration (temporary fixtures)",
  () => {
    it("isolates tenants and paginates tied timestamps without missing entries", async () => {
      const db = await getDb();
      if (!db) throw new Error("Database required");
      await db.transaction(async tx => {
        // Temporary tables shadow public names only on this connection; production data is untouched.
        await tx.execute(
          sql`CREATE TEMP TABLE "taskRuns" (id int, "organizationId" int, "taskId" int, "correlationId" text, "openaiTraceId" text) ON COMMIT DROP`
        );
        await tx.execute(
          sql`CREATE TEMP TABLE "runtimeEvents" (id int, "organizationId" int, "taskRunId" int, "agentRunId" int, sequence int, type text, payload jsonb, "createdAt" timestamp) ON COMMIT DROP`
        );
        await tx.execute(
          sql`CREATE TEMP TABLE tasks (id int, "organizationId" int) ON COMMIT DROP`
        );
        await tx.execute(
          sql`CREATE TEMP TABLE "taskExecutionLogs" (id int, "taskId" int, "agentId" int, step int, action text, details text, "createdAt" timestamp) ON COMMIT DROP`
        );
        await tx.execute(
          sql`INSERT INTO "taskRuns" VALUES (1, 12, 1, 'corr-one', 'trace-one'), (2, 99, 2, 'secret-correlation', NULL)`
        );
        await tx.execute(sql`INSERT INTO tasks VALUES (1, 12), (2, 99)`);
        await tx.execute(
          sql`INSERT INTO "runtimeEvents" SELECT n, 12, 1, NULL, n, 'step_failed', '{"attempt":1,"secret":"never-return"}', '2026-10-01T12:00:00.123456'::timestamp FROM generate_series(1, 105) n`
        );
        await tx.execute(
          sql`INSERT INTO "runtimeEvents" VALUES (106, 99, 2, NULL, 1, 'private_event', '{}', '2026-10-01T12:00:00'), (107, 12, 2, NULL, 2, 'broken_tenant_join', '{}', '2026-10-01T12:00:00')`
        );
        await tx.execute(
          sql`INSERT INTO "taskExecutionLogs" VALUES (1, 1, 5, 1, 'thinking', 'private prompt', '2026-10-01T11:00:00'), (2, 2, 6, 1, 'secret_action', 'secret', '2026-10-01T11:00:00')`
        );
        const input = {
          query: "",
          start: "2026-10-01T00:00:00.000Z",
          end: "2026-10-02T00:00:00.000Z",
        };
        const search = async (
          query = "",
          cursor?: { timestamp: string; id: string }
        ) =>
          (
            await tx.execute(buildLogsQuery(12, { ...input, query, cursor }))
          )[0] as unknown as LogsResult;
        const first = await search();
        expect(first.total).toBe(106);
        expect(first.entries.length).toBe(101);
        expect(first.buckets.reduce((s, b) => s + b.count, 0)).toBe(106);
        expect(JSON.stringify(first)).not.toMatch(
          /never-return|private prompt|secret-correlation|secret_action|broken_tenant_join/
        );
        const last = first.entries[99];
        const second = await search("", {
          timestamp: last.timestamp,
          id: last.id,
        });
        expect(second.entries).toHaveLength(6);
        expect(
          new Set(
            [...first.entries.slice(0, 100), ...second.entries].map(e => e.id)
          ).size
        ).toBe(106);
        expect((await search("severity=ERROR")).total).toBe(105);
        expect((await search("source=execution")).total).toBe(1);
        expect((await search('correlationId="corr-one"')).total).toBe(105);
        expect((await search('message="%\' OR 1=1 --"')).total).toBe(0);
        expect((await tx.execute(buildLogsQuery(999, input)))[0].total).toBe(0);
      });
    }, 30000);
  }
);
