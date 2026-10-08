import { describe, expect, it, vi, beforeEach } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";
import { logInput, logErrorMessage, parseLogQuery } from "../../shared/logs";
import { buildLogsQuery } from "./service";
import { logsRouter } from "./router";
import type { TrpcContext } from "../_core/context";

vi.mock("../db", () => ({ getDb: vi.fn() }));
import { getDb } from "../db";

const input = {
  query: "",
  start: "2026-10-01T00:00:00.000Z",
  end: "2026-10-02T00:00:00.000Z",
};
const context = {
  user: { id: 7 },
  organization: { id: 12 },
  membership: { organizationId: 12, userId: 7 },
} as TrpcContext;

describe("log query validation", () => {
  it("supports quoted values, AND, newlines, and literal punctuation", () => {
    expect(
      parseLogQuery(
        'severity=ERROR AND message="tool AND retry"\nsource=runtime'
      )
    ).toEqual([
      { field: "severity", value: "ERROR" },
      { field: "message", value: "tool AND retry" },
      { field: "source", value: "runtime" },
    ]);
  });
  it.each([
    "severity>=ERROR",
    "source=unknown",
    "taskId=-1",
    'message="unfinished',
    "severity=ERROR OR source=runtime",
    "source=runtime AND",
    "password=secret",
  ])("rejects unsupported query %s", query => {
    expect(() => parseLogQuery(query)).toThrow();
  });
  it("rejects reversed, unbounded, and malformed time windows", () => {
    expect(logInput.safeParse({ ...input, end: input.start }).success).toBe(
      false
    );
    expect(
      logInput.safeParse({ ...input, end: "2027-02-01T00:00:00Z" }).success
    ).toBe(false);
    expect(
      logInput.safeParse({
        ...input,
        cursor: { timestamp: input.start, id: "injected" },
      }).success
    ).toBe(false);
  });
  it("accepts the reported July–August range and the exact 93-day boundary", () => {
    expect(
      logInput.safeParse({
        ...input,
        start: "2026-07-01T12:05:00.000Z",
        end: "2026-08-31T13:00:00.000Z",
      }).success
    ).toBe(true);
    const end = new Date(Date.parse(input.start) + 93 * 86400000);
    expect(
      logInput.safeParse({ ...input, end: end.toISOString() }).success
    ).toBe(true);
    end.setMilliseconds(end.getMilliseconds() + 1);
    const result = logInput.safeParse({ ...input, end: end.toISOString() });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(logErrorMessage(result.error)).toBe(
        "Choose a time range of 93 days or less."
      );
      expect(logErrorMessage(new Error(result.error.message))).toBe(
        "Choose a time range of 93 days or less."
      );
    }
  });
  it("shows a readable error for reversed times and preserves ordinary errors", () => {
    const result = logInput.safeParse({ ...input, end: input.start });
    if (result.success) throw new Error("Expected invalid range");
    expect(logErrorMessage(result.error)).toBe(
      "End time must be after start time."
    );
    expect(logErrorMessage(new Error("Storage unavailable"))).toBe(
      "Storage unavailable"
    );
  });
  it("parameterizes values and scopes both event sources", () => {
    const value = "%' OR 1=1 --";
    const query = new PgDialect().sqlToQuery(
      buildLogsQuery(12, {
        ...input,
        query: `message=${JSON.stringify(value)}`,
      })
    );
    expect(query.sql).not.toContain(value);
    expect(query.params).toContain(value);
    expect(query.params.filter(p => p === 12)).toHaveLength(2);
    expect(query.sql).toContain('r."organizationId" = e."organizationId"');
    expect(query.sql).not.toContain("l.details");
    expect(query.sql).not.toContain("e.payload AS");
  });
});

describe("Logs Explorer authorization", () => {
  beforeEach(() => vi.mocked(getDb).mockReset());
  it("blocks anonymous users before accessing storage", async () => {
    const caller = logsRouter.createCaller({ ...context, user: null });
    await expect(caller.search(input)).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
    expect(getDb).not.toHaveBeenCalled();
  });
  it("blocks absent membership and a mismatched organization", async () => {
    await expect(
      logsRouter.createCaller({ ...context, membership: null }).search(input)
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      logsRouter.createCaller(context).search({ ...input, organizationId: 99 })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(getDb).not.toHaveBeenCalled();
  });
  it("rejects invalid syntax before accessing storage", async () => {
    await expect(
      logsRouter
        .createCaller(context)
        .search({ ...input, query: "DROP TABLE tasks" })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(getDb).not.toHaveBeenCalled();
  });
  it("returns an actionable failure when storage is unavailable", async () => {
    vi.mocked(getDb).mockResolvedValue(null);
    await expect(
      logsRouter.createCaller(context).search(input)
    ).rejects.toMatchObject({ code: "SERVICE_UNAVAILABLE" });
  });
});
