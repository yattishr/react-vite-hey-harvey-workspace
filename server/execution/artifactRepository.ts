import { and, asc, eq, inArray } from "drizzle-orm";
import { taskArtifacts, type InsertTaskArtifact } from "../../drizzle/schema";
import { getDb } from "../db";

export interface ArtifactReference {
  artifactId: number;
  artifactType: string;
  title: string;
}

export async function createTaskArtifact(input: InsertTaskArtifact) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.insert(taskArtifacts).values(input).returning();
  if (!result[0]) throw new Error("Failed to create task artifact");
  return result[0];
}

export async function getArtifactsByTaskTeam(
  organizationId: number,
  taskTeamId: number
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return db
    .select()
    .from(taskArtifacts)
    .where(
      and(
        eq(taskArtifacts.organizationId, organizationId),
        eq(taskArtifacts.taskTeamId, taskTeamId)
      )
    )
    .orderBy(asc(taskArtifacts.createdAt));
}

export async function getArtifactsByTaskRun(
  organizationId: number,
  taskRunId: number
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return db
    .select()
    .from(taskArtifacts)
    .where(
      and(
        eq(taskArtifacts.organizationId, organizationId),
        eq(taskArtifacts.taskRunId, taskRunId)
      )
    )
    .orderBy(asc(taskArtifacts.createdAt));
}

export async function getArtifactsByAgentRunIds(
  organizationId: number,
  agentRunIds: number[]
) {
  if (agentRunIds.length === 0) return [];

  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return db
    .select()
    .from(taskArtifacts)
    .where(
      and(
        eq(taskArtifacts.organizationId, organizationId),
        inArray(taskArtifacts.agentRunId, agentRunIds)
      )
    )
    .orderBy(asc(taskArtifacts.createdAt));
}

export function toArtifactReference(artifact: {
  id: number;
  artifactType: string;
  title: string;
}): ArtifactReference {
  return {
    artifactId: artifact.id,
    artifactType: artifact.artifactType,
    title: artifact.title,
  };
}
