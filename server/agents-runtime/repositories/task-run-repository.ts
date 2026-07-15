import { and, desc, eq } from "drizzle-orm";
import {
  tasks,
  taskRuns,
  type InsertTask,
  type InsertTaskRun,
} from "../../../drizzle/schema";
import { getDb } from "../../db";

export async function createTaskAndRun(
  taskInput: InsertTask,
  runInput: Omit<InsertTaskRun, "taskId">
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return db.transaction(async tx => {
    const createdTasks = await tx.insert(tasks).values(taskInput).returning();
    const task = createdTasks[0];
    if (!task) throw new Error("Failed to create task");

    const createdRuns = await tx
      .insert(taskRuns)
      .values({ ...runInput, taskId: task.id })
      .returning();
    const taskRun = createdRuns[0];
    if (!taskRun) throw new Error("Failed to create task run");

    return { task, taskRun };
  });
}

export async function createTaskRun(input: InsertTaskRun) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const rows = await db.insert(taskRuns).values(input).returning();
  if (!rows[0]) throw new Error("Failed to create task run");
  return rows[0];
}

export async function updateTaskRun(
  organizationId: number,
  taskRunId: number,
  updates: Omit<
    Partial<typeof taskRuns.$inferInsert>,
    | "id"
    | "organizationId"
    | "userId"
    | "taskId"
    | "runtime"
    | "correlationId"
    | "createdAt"
  >
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const rows = await db
    .update(taskRuns)
    .set(updates)
    .where(
      and(
        eq(taskRuns.organizationId, organizationId),
        eq(taskRuns.id, taskRunId)
      )
    )
    .returning();
  return rows[0] ?? null;
}

export async function getTaskRun(organizationId: number, taskRunId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const rows = await db
    .select()
    .from(taskRuns)
    .where(
      and(
        eq(taskRuns.organizationId, organizationId),
        eq(taskRuns.id, taskRunId)
      )
    )
    .limit(1);
  return rows[0] ?? null;
}

export async function getLatestTaskRun(organizationId: number, taskId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const rows = await db
    .select()
    .from(taskRuns)
    .where(
      and(
        eq(taskRuns.organizationId, organizationId),
        eq(taskRuns.taskId, taskId)
      )
    )
    .orderBy(desc(taskRuns.createdAt))
    .limit(1);
  return rows[0] ?? null;
}
