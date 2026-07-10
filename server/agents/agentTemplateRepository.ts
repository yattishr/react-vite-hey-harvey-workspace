import { and, eq, sql } from "drizzle-orm";
import {
  agentTemplates,
  agentTemplateVersions,
  type AgentTemplate,
  type InsertAgentTemplate,
  type InsertAgentTemplateVersion,
} from "../../drizzle/schema";
import { getDb } from "../db";

export async function listActiveAgentTemplates(organizationId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return db
    .select()
    .from(agentTemplates)
    .where(and(eq(agentTemplates.organizationId, organizationId), eq(agentTemplates.status, "active")));
}

export async function listAgentTemplatesByStatus(
  organizationId: number,
  status: AgentTemplate["status"] = "active"
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return db
    .select()
    .from(agentTemplates)
    .where(and(eq(agentTemplates.organizationId, organizationId), eq(agentTemplates.status, status)));
}

export async function getAgentTemplateById(organizationId: number, id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db
    .select()
    .from(agentTemplates)
    .where(and(eq(agentTemplates.organizationId, organizationId), eq(agentTemplates.id, id)))
    .limit(1);

  return result[0] ?? null;
}

export async function getAgentTemplateByFingerprint(organizationId: number, fingerprint: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db
    .select()
    .from(agentTemplates)
    .where(and(eq(agentTemplates.organizationId, organizationId), eq(agentTemplates.fingerprint, fingerprint)))
    .limit(1);

  return result[0] ?? null;
}

export async function createAgentTemplate(input: InsertAgentTemplate) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.insert(agentTemplates).values(input).returning();
  if (!result[0]) throw new Error("Failed to create agent template");
  return result[0];
}

export async function updateAgentTemplateCounters(
  organizationId: number,
  id: number,
  counter: "usageCount" | "successCount" | "failureCount"
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db
    .update(agentTemplates)
    .set({
      [counter]: sql`${agentTemplates[counter]} + 1`,
      updatedAt: new Date(),
    })
    .where(and(eq(agentTemplates.organizationId, organizationId), eq(agentTemplates.id, id)));
}

export async function createAgentTemplateVersion(input: InsertAgentTemplateVersion) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.insert(agentTemplateVersions).values(input).returning();
  if (!result[0]) throw new Error("Failed to create agent template version");
  return result[0];
}
