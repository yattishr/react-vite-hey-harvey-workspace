import { eq, and, desc } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, users, agents, tasks, conversations, messages, taskExecutionLogs, tools, workflows, workflowSteps, workflowExecutions, workflowExecutionSteps, organizations, organizationMembers } from "../drizzle/schema";

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

function slugifyOrganizationName(name: string) {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return base || "organization";
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.supabaseUserId) {
    throw new Error("User supabaseUserId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      supabaseUserId: user.supabaseUserId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserBySupabaseUserId(supabaseUserId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.supabaseUserId, supabaseUserId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

export async function upsertSupabaseUser(input: {
  supabaseUserId: string;
  email?: string | null;
  name?: string | null;
  loginMethod?: string | null;
}) {
  await upsertUser({
    supabaseUserId: input.supabaseUserId,
    email: input.email ?? null,
    name: input.name ?? null,
    loginMethod: input.loginMethod ?? "supabase",
    lastSignedIn: new Date(),
  });

  return getUserBySupabaseUserId(input.supabaseUserId);
}

export async function ensureDefaultOrganizationForUser(user: typeof users.$inferSelect) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot ensure organization: database not available");
    return null;
  }

  const existingMemberships = await db
    .select({
      organization: organizations,
      membership: organizationMembers,
    })
    .from(organizationMembers)
    .innerJoin(organizations, eq(organizationMembers.organizationId, organizations.id))
    .where(eq(organizationMembers.userId, user.id))
    .limit(1);

  if (existingMemberships[0]) {
    return existingMemberships[0];
  }

  const displayName = user.name || user.email || "My Organization";
  const baseSlug = slugifyOrganizationName(displayName);
  const slug = `${baseSlug}-${user.id}`;

  await db.insert(organizations).values({
    name: displayName,
    slug,
    createdByUserId: user.id,
  });

  const createdOrganizations = await db
    .select()
    .from(organizations)
    .where(eq(organizations.slug, slug))
    .limit(1);
  const organization = createdOrganizations[0];

  if (!organization) {
    throw new Error("Failed to create default organization");
  }

  await db.insert(organizationMembers).values({
    organizationId: organization.id,
    userId: user.id,
    role: "owner",
  });

  const memberships = await db
    .select()
    .from(organizationMembers)
    .where(and(eq(organizationMembers.organizationId, organization.id), eq(organizationMembers.userId, user.id)))
    .limit(1);

  const membership = memberships[0];
  if (!membership) {
    throw new Error("Failed to create default organization membership");
  }

  return { organization, membership };
}

export async function getOrganizationMembership(userId: number, organizationId: number) {
  const db = await getDb();
  if (!db) return null;

  const result = await db
    .select({
      organization: organizations,
      membership: organizationMembers,
    })
    .from(organizationMembers)
    .innerJoin(organizations, eq(organizationMembers.organizationId, organizations.id))
    .where(and(eq(organizationMembers.userId, userId), eq(organizationMembers.organizationId, organizationId)))
    .limit(1);

  return result[0] ?? null;
}

// ============ Agent Queries ============

export async function createAgent(agent: typeof agents.$inferInsert) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(agents).values(agent);
  return result;
}

export async function getAgentsByUserId(userId: number) {
  const db = await getDb();
  if (!db) return [];
  
  return await db.select().from(agents).where(eq(agents.userId, userId));
}

export async function getAgentById(agentId: number) {
  const db = await getDb();
  if (!db) return null;
  
  const result = await db.select().from(agents).where(eq(agents.id, agentId)).limit(1);
  return result.length > 0 ? result[0] : null;
}

export async function updateAgent(agentId: number, updates: Partial<typeof agents.$inferInsert>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  return await db.update(agents).set(updates).where(eq(agents.id, agentId));
}

export async function deleteAgent(agentId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  return await db.delete(agents).where(eq(agents.id, agentId));
}

// ============ Task Queries ============

export async function createTask(task: typeof tasks.$inferInsert) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(tasks).values(task);
  return result;
}

export async function getTasksByUserId(userId: number, limit = 50) {
  const db = await getDb();
  if (!db) return [];
  
  return await db.select().from(tasks)
    .where(eq(tasks.userId, userId))
    .orderBy(desc(tasks.createdAt))
    .limit(limit);
}

export async function getTaskById(taskId: number) {
  const db = await getDb();
  if (!db) return null;
  
  const result = await db.select().from(tasks).where(eq(tasks.id, taskId)).limit(1);
  return result.length > 0 ? result[0] : null;
}

export async function updateTask(taskId: number, updates: Partial<typeof tasks.$inferInsert>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  return await db.update(tasks).set(updates).where(eq(tasks.id, taskId));
}

export async function getTasksByStatus(userId: number, status: string) {
  const db = await getDb();
  if (!db) return [];
  
  return await db.select().from(tasks)
    .where(and(eq(tasks.userId, userId), eq(tasks.status, status as any)))
    .orderBy(desc(tasks.createdAt));
}

// ============ Conversation Queries ============

export async function createConversation(conversation: typeof conversations.$inferInsert) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.insert(conversations).values(conversation);
  // Fetch the created conversation
  const result = await db.select().from(conversations)
    .where(eq(conversations.userId, conversation.userId))
    .orderBy(desc(conversations.createdAt))
    .limit(1);
  return result.length > 0 ? result[0] : null;
}

export async function getConversationsByUserId(userId: number, limit = 50) {
  const db = await getDb();
  if (!db) return [];
  
  return await db.select().from(conversations)
    .where(eq(conversations.userId, userId))
    .orderBy(desc(conversations.updatedAt))
    .limit(limit);
}

export async function getConversationById(conversationId: number) {
  const db = await getDb();
  if (!db) return null;
  
  const result = await db.select().from(conversations).where(eq(conversations.id, conversationId)).limit(1);
  return result.length > 0 ? result[0] : null;
}

// ============ Message Queries ============

export async function addMessage(message: typeof messages.$inferInsert) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(messages).values(message);
  return result;
}

export async function getMessagesByConversationId(conversationId: number, limit = 100) {
  const db = await getDb();
  if (!db) return [];
  
  return await db.select().from(messages)
    .where(eq(messages.conversationId, conversationId))
    .orderBy(messages.createdAt)
    .limit(limit);
}

// ============ Task Execution Log Queries ============

export async function addExecutionLog(log: typeof taskExecutionLogs.$inferInsert) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  return await db.insert(taskExecutionLogs).values(log);
}

export async function getExecutionLogsByTaskId(taskId: number) {
  const db = await getDb();
  if (!db) return [];
  
  return await db.select().from(taskExecutionLogs)
    .where(eq(taskExecutionLogs.taskId, taskId))
    .orderBy(taskExecutionLogs.step);
}

// ============ Tool Queries ============

export async function createTool(tool: typeof tools.$inferInsert) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  return await db.insert(tools).values(tool);
}

export async function getToolByName(name: string) {
  const db = await getDb();
  if (!db) return null;
  
  const result = await db.select().from(tools).where(eq(tools.name, name)).limit(1);
  return result.length > 0 ? result[0] : null;
}

export async function getAllTools() {
  const db = await getDb();
  if (!db) return [];
  
  return await db.select().from(tools);
}

export async function getToolsByCategory(category: string) {
  const db = await getDb();
  if (!db) return [];
  
  return await db.select().from(tools).where(eq(tools.category, category));
}


// ============ Workflow Management ============

export async function createWorkflow(data: any) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(workflows).values(data);
  return { id: result[0]?.insertId || 0, ...data };
}

export async function getWorkflowById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(workflows).where(eq(workflows.id, id)).limit(1);
  return result[0];
}

export async function getWorkflowsByUserId(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(workflows).where(eq(workflows.userId, userId));
}

export async function createWorkflowStep(data: any) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(workflowSteps).values(data);
  return { id: result[0]?.insertId || 0, ...data };
}

export async function getWorkflowStepsByWorkflowId(workflowId: number) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(workflowSteps).where(eq(workflowSteps.workflowId, workflowId));
}

export async function createWorkflowExecution(data: any) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(workflowExecutions).values(data);
  return { id: result[0]?.insertId || 0, ...data };
}

export async function getWorkflowExecutionById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(workflowExecutions).where(eq(workflowExecutions.id, id)).limit(1);
  return result[0];
}

export async function getWorkflowExecutionsByWorkflowId(workflowId: number) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(workflowExecutions).where(eq(workflowExecutions.workflowId, workflowId));
}

export async function getWorkflowExecutionStepsByExecutionId(executionId: number) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(workflowExecutionSteps).where(eq(workflowExecutionSteps.executionId, executionId));
}
