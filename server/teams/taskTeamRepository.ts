import { and, eq, asc } from "drizzle-orm";
import { taskTeams, teamMembers, type InsertTaskTeam, type InsertTeamMember } from "../../drizzle/schema";
import { getDb } from "../db";

export async function createTaskTeam(input: InsertTaskTeam) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.insert(taskTeams).values(input).returning();
  if (!result[0]) throw new Error("Failed to create task team");
  return result[0];
}

export async function updateTaskTeamStatus(
  organizationId: number,
  taskTeamId: number,
  status: "assembling" | "ready" | "running" | "completed" | "failed" | "cancelled"
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db
    .update(taskTeams)
    .set({
      status,
      completedAt: status === "completed" || status === "failed" || status === "cancelled" ? new Date() : null,
    })
    .where(and(eq(taskTeams.organizationId, organizationId), eq(taskTeams.id, taskTeamId)));
}

export async function getTaskTeam(organizationId: number, taskTeamId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db
    .select()
    .from(taskTeams)
    .where(and(eq(taskTeams.organizationId, organizationId), eq(taskTeams.id, taskTeamId)))
    .limit(1);

  return result[0] ?? null;
}

export async function getTaskTeamByTaskId(organizationId: number, taskId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db
    .select()
    .from(taskTeams)
    .where(and(eq(taskTeams.organizationId, organizationId), eq(taskTeams.taskId, taskId)))
    .limit(1);

  return result[0] ?? null;
}

export async function createTeamMember(input: InsertTeamMember) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.insert(teamMembers).values(input).returning();
  if (!result[0]) throw new Error("Failed to create team member");
  return result[0];
}

export async function getOrderedTeamMembers(organizationId: number, taskTeamId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return db
    .select()
    .from(teamMembers)
    .where(and(eq(teamMembers.organizationId, organizationId), eq(teamMembers.taskTeamId, taskTeamId)))
    .orderBy(asc(teamMembers.workflowOrder));
}
