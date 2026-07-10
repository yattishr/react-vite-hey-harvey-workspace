import { and, asc, eq, inArray } from "drizzle-orm";
import { agentRuns, type InsertAgentRun } from "../../drizzle/schema";
import { getDb } from "../db";

export async function createAgentRun(input: InsertAgentRun) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.insert(agentRuns).values(input).returning();
  if (!result[0]) throw new Error("Failed to create agent run");
  return result[0];
}

export async function updateAgentRun(
  organizationId: number,
  agentRunId: number,
  updates: Partial<typeof agentRuns.$inferInsert>
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db
    .update(agentRuns)
    .set(updates)
    .where(and(eq(agentRuns.organizationId, organizationId), eq(agentRuns.id, agentRunId)));
}

export async function getAgentRunsByTaskTeam(organizationId: number, taskTeamId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return db
    .select()
    .from(agentRuns)
    .where(and(eq(agentRuns.organizationId, organizationId), eq(agentRuns.taskTeamId, taskTeamId)))
    .orderBy(asc(agentRuns.createdAt));
}

export async function getCompletedAgentRunsForTeamMembers(
  organizationId: number,
  teamMemberIds: number[]
) {
  if (teamMemberIds.length === 0) return [];

  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return db
    .select()
    .from(agentRuns)
    .where(
      and(
        eq(agentRuns.organizationId, organizationId),
        eq(agentRuns.status, "completed"),
        inArray(agentRuns.teamMemberId, teamMemberIds)
      )
    );
}
