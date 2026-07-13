import { and, asc, eq, sql } from "drizzle-orm";
import { runtimeEvents, taskRuns } from "../../../drizzle/schema";
import { getDb } from "../../db";

export async function publishRuntimeEvent(input: {
  organizationId: number;
  taskRunId: number;
  agentRunId?: number | null;
  type: string;
  payload?: Record<string, unknown>;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.transaction(async tx => {
    const updatedRun = await tx
      .update(taskRuns)
      .set({ eventSequence: sql`${taskRuns.eventSequence} + 1` })
      .where(
        and(
          eq(taskRuns.organizationId, input.organizationId),
          eq(taskRuns.id, input.taskRunId)
        )
      )
      .returning({ sequence: taskRuns.eventSequence });
    const sequence = updatedRun[0]?.sequence;
    if (!sequence) throw new Error("Task run not found while publishing event");
    const rows = await tx
      .insert(runtimeEvents)
      .values({ ...input, sequence, payload: input.payload ?? {} })
      .returning();
    return rows[0];
  });
}

export async function getRuntimeEvents(
  organizationId: number,
  taskRunId: number
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db
    .select()
    .from(runtimeEvents)
    .where(
      and(
        eq(runtimeEvents.organizationId, organizationId),
        eq(runtimeEvents.taskRunId, taskRunId)
      )
    )
    .orderBy(asc(runtimeEvents.sequence));
}
