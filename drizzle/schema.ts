import { boolean, index, integer, json, pgEnum, pgTable, serial, text, timestamp, uniqueIndex, varchar } from "drizzle-orm/pg-core";

export const appRoleEnum = pgEnum("appRole", ["user", "admin"]);
export const organizationRoleEnum = pgEnum("organizationRole", ["owner", "admin", "member"]);
export const taskStatusEnum = pgEnum("taskStatus", ["draft", "planning", "team_ready", "queued", "running", "completed", "failed", "cancelled"]);
export const messageRoleEnum = pgEnum("messageRole", ["user", "agent", "system"]);
export const workflowExecutionTypeEnum = pgEnum("workflowExecutionType", ["sequential", "parallel", "conditional"]);
export const workflowStatusEnum = pgEnum("workflowStatus", ["draft", "active", "archived"]);
export const workflowExecutionStatusEnum = pgEnum("workflowExecutionStatus", ["queued", "running", "completed", "failed", "paused"]);
export const workflowExecutionStepStatusEnum = pgEnum("workflowExecutionStepStatus", ["pending", "running", "completed", "failed", "skipped"]);
export const taskSourceEnum = pgEnum("taskSource", ["predefined", "custom"]);
export const taskWorkflowTypeEnum = pgEnum("taskWorkflowType", ["sequential"]);
export const agentTemplateStatusEnum = pgEnum("agentTemplateStatus", ["active", "inactive", "archived"]);
export const agentTemplateSourceEnum = pgEnum("agentTemplateSource", ["system", "generated", "user_created", "migrated"]);
export const taskTeamStatusEnum = pgEnum("taskTeamStatus", ["assembling", "ready", "running", "completed", "failed", "cancelled"]);
export const agentRunStatusEnum = pgEnum("agentRunStatus", ["pending", "queued", "running", "completed", "failed", "cancelled"]);
export const taskArtifactTypeEnum = pgEnum("taskArtifactType", ["research", "analysis", "strategy", "draft", "review", "report", "structured_data", "other"]);

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = pgTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: serial("id").primaryKey(),
  /** Supabase Auth user id. This maps to auth.users.id in Supabase. */
  supabaseUserId: varchar("supabaseUserId", { length: 36 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: appRoleEnum("role").default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull().$onUpdate(() => new Date()),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * Organizations own tenant-scoped product data.
 */
export const organizations = pgTable("organizations", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  slug: varchar("slug", { length: 255 }).notNull().unique(),
  createdByUserId: integer("createdByUserId").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull().$onUpdate(() => new Date()),
});

export type Organization = typeof organizations.$inferSelect;
export type InsertOrganization = typeof organizations.$inferInsert;

/**
 * Organization membership controls tenant access and organization-level roles.
 */
export const organizationMembers = pgTable(
  "organizationMembers",
  {
    id: serial("id").primaryKey(),
    organizationId: integer("organizationId").notNull(),
    userId: integer("userId").notNull(),
    role: organizationRoleEnum("role").default("member").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().notNull().$onUpdate(() => new Date()),
  },
  table => [
    uniqueIndex("organizationMembers_organizationId_userId_unique").on(
      table.organizationId,
      table.userId
    ),
  ]
);

export type OrganizationMember = typeof organizationMembers.$inferSelect;
export type InsertOrganizationMember = typeof organizationMembers.$inferInsert;

/**
 * Agents table: stores AI agent configurations
 */
export const agents = pgTable("agents", {
  id: serial("id").primaryKey(),
  organizationId: integer("organizationId").notNull(), // Tenant owner
  userId: integer("userId").notNull(), // Creator/user owner
  name: varchar("name", { length: 255 }).notNull(),
  role: varchar("role", { length: 255 }).notNull(), // e.g., "Research Agent", "Data Analyst"
  goal: text("goal").notNull(), // Agent's primary objective
  backstory: text("backstory"), // Agent's background/personality
  tools: varchar("tools", { length: 1000 }).default('[]'), // Array of tool names (JSON string)
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull().$onUpdate(() => new Date()),
});

export type Agent = typeof agents.$inferSelect;
export type InsertAgent = typeof agents.$inferInsert;

/**
 * Tasks table: stores task assignments and execution records
 */
export const tasks = pgTable("tasks", {
  id: serial("id").primaryKey(),
  organizationId: integer("organizationId").notNull(), // Tenant owner
  userId: integer("userId").notNull(), // Creator/user owner
  agentIds: json("agentIds").$type<number[]>().notNull(), // Array of agent IDs assigned to this task
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description").notNull(), // Natural language task description
  source: taskSourceEnum("source").default("custom").notNull(),
  status: taskStatusEnum("status").default("queued").notNull(),
  workflowType: taskWorkflowTypeEnum("workflowType").default("sequential").notNull(),
  taskTeamId: integer("taskTeamId"),
  executionBlueprintId: integer("executionBlueprintId"),
  result: text("result"), // Task output/result
  error: text("error"), // Error message if task failed
  executionStartedAt: timestamp("executionStartedAt"),
  executionCompletedAt: timestamp("executionCompletedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull().$onUpdate(() => new Date()),
});

export type Task = typeof tasks.$inferSelect;
export type InsertTask = typeof tasks.$inferInsert;

export const agentTemplates = pgTable(
  "agentTemplates",
  {
    id: serial("id").primaryKey(),
    organizationId: integer("organizationId").notNull(),
    name: varchar("name", { length: 255 }).notNull(),
    slug: varchar("slug", { length: 255 }).notNull(),
    roleKey: varchar("roleKey", { length: 255 }).default("research_analyst").notNull(),
    role: varchar("role", { length: 255 }).notNull(),
    description: text("description").notNull(),
    goal: text("goal").notNull(),
    backstory: text("backstory"),
    defaultInstructions: json("defaultInstructions").$type<string[]>().default([]).notNull(),
    capabilities: json("capabilities").$type<string[]>().default([]).notNull(),
    toolPermissions: json("toolPermissions").$type<string[]>().default([]).notNull(),
    status: agentTemplateStatusEnum("status").default("active").notNull(),
    source: agentTemplateSourceEnum("source").default("generated").notNull(),
    version: integer("version").default(1).notNull(),
    fingerprint: varchar("fingerprint", { length: 128 }).notNull(),
    usageCount: integer("usageCount").default(0).notNull(),
    successCount: integer("successCount").default(0).notNull(),
    failureCount: integer("failureCount").default(0).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().notNull().$onUpdate(() => new Date()),
  },
  table => [
    index("agentTemplates_organizationId_roleKey_idx").on(table.organizationId, table.roleKey),
    uniqueIndex("agentTemplates_organizationId_fingerprint_unique").on(
      table.organizationId,
      table.fingerprint
    ),
    uniqueIndex("agentTemplates_organizationId_slug_unique").on(table.organizationId, table.slug),
  ]
);

export type AgentTemplate = typeof agentTemplates.$inferSelect;
export type InsertAgentTemplate = typeof agentTemplates.$inferInsert;

export const agentTemplateVersions = pgTable(
  "agentTemplateVersions",
  {
    id: serial("id").primaryKey(),
    organizationId: integer("organizationId").notNull(),
    agentTemplateId: integer("agentTemplateId").notNull(),
    version: integer("version").notNull(),
    snapshot: json("snapshot").$type<Record<string, unknown>>().notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [
    index("agentTemplateVersions_organizationId_idx").on(table.organizationId),
    uniqueIndex("agentTemplateVersions_template_version_unique").on(
      table.agentTemplateId,
      table.version
    ),
  ]
);

export type AgentTemplateVersion = typeof agentTemplateVersions.$inferSelect;
export type InsertAgentTemplateVersion = typeof agentTemplateVersions.$inferInsert;

export const executionBlueprints = pgTable(
  "executionBlueprints",
  {
    id: serial("id").primaryKey(),
    organizationId: integer("organizationId").notNull(),
    taskId: integer("taskId").notNull(),
    objective: text("objective").notNull(),
    deliverables: json("deliverables").$type<string[]>().default([]).notNull(),
    requiredCapabilities: json("requiredCapabilities").$type<string[]>().default([]).notNull(),
    suggestedRoles: json("suggestedRoles").$type<Record<string, unknown>[]>().default([]).notNull(),
    workflowSteps: json("workflowSteps").$type<Record<string, unknown>[]>().default([]).notNull(),
    assumptions: json("assumptions").$type<string[]>().default([]).notNull(),
    constraints: json("constraints").$type<string[]>().default([]).notNull(),
    risks: json("risks").$type<string[]>().default([]).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [index("executionBlueprints_organizationId_taskId_idx").on(table.organizationId, table.taskId)]
);

export type ExecutionBlueprint = typeof executionBlueprints.$inferSelect;
export type InsertExecutionBlueprint = typeof executionBlueprints.$inferInsert;

export const taskTeams = pgTable(
  "taskTeams",
  {
    id: serial("id").primaryKey(),
    organizationId: integer("organizationId").notNull(),
    taskId: integer("taskId").notNull(),
    status: taskTeamStatusEnum("status").default("assembling").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    completedAt: timestamp("completedAt"),
  },
  table => [index("taskTeams_organizationId_taskId_idx").on(table.organizationId, table.taskId)]
);

export type TaskTeam = typeof taskTeams.$inferSelect;
export type InsertTaskTeam = typeof taskTeams.$inferInsert;

export const teamMembers = pgTable(
  "teamMembers",
  {
    id: serial("id").primaryKey(),
    organizationId: integer("organizationId").notNull(),
    taskTeamId: integer("taskTeamId").notNull(),
    taskId: integer("taskId").notNull(),
    agentTemplateId: integer("agentTemplateId").notNull(),
    agentTemplateVersion: integer("agentTemplateVersion").notNull(),
    workflowOrder: integer("workflowOrder").notNull(),
    roleKey: varchar("roleKey", { length: 255 }).notNull(),
    taskSpecificInstructions: json("taskSpecificInstructions").$type<string[]>().default([]).notNull(),
    expectedOutput: text("expectedOutput").notNull(),
    dependsOnTeamMemberIds: json("dependsOnTeamMemberIds").$type<number[]>().default([]).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [index("teamMembers_organizationId_taskTeamId_idx").on(table.organizationId, table.taskTeamId)]
);

export type TeamMember = typeof teamMembers.$inferSelect;
export type InsertTeamMember = typeof teamMembers.$inferInsert;

export const agentRuns = pgTable(
  "agentRuns",
  {
    id: serial("id").primaryKey(),
    organizationId: integer("organizationId").notNull(),
    taskId: integer("taskId").notNull(),
    taskTeamId: integer("taskTeamId").notNull(),
    teamMemberId: integer("teamMemberId").notNull(),
    agentTemplateId: integer("agentTemplateId").notNull(),
    agentTemplateVersion: integer("agentTemplateVersion").notNull(),
    status: agentRunStatusEnum("status").default("pending").notNull(),
    inputContext: json("inputContext").$type<Record<string, unknown>>().notNull(),
    output: json("output").$type<Record<string, unknown>>(),
    error: json("error").$type<Record<string, unknown>>(),
    model: varchar("model", { length: 255 }),
    promptVersion: varchar("promptVersion", { length: 64 }),
    tokenUsage: json("tokenUsage").$type<Record<string, number>>(),
    estimatedCost: integer("estimatedCost"),
    startedAt: timestamp("startedAt"),
    completedAt: timestamp("completedAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [index("agentRuns_organizationId_taskTeamId_idx").on(table.organizationId, table.taskTeamId)]
);

export type AgentRun = typeof agentRuns.$inferSelect;
export type InsertAgentRun = typeof agentRuns.$inferInsert;

export const taskArtifacts = pgTable(
  "taskArtifacts",
  {
    id: serial("id").primaryKey(),
    organizationId: integer("organizationId").notNull(),
    taskId: integer("taskId").notNull(),
    taskTeamId: integer("taskTeamId").notNull(),
    agentRunId: integer("agentRunId").notNull(),
    artifactType: taskArtifactTypeEnum("artifactType").default("other").notNull(),
    title: varchar("title", { length: 255 }).notNull(),
    content: json("content").$type<unknown>().notNull(),
    mimeType: varchar("mimeType", { length: 255 }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [index("taskArtifacts_organizationId_taskTeamId_idx").on(table.organizationId, table.taskTeamId)]
);

export type TaskArtifact = typeof taskArtifacts.$inferSelect;
export type InsertTaskArtifact = typeof taskArtifacts.$inferInsert;

/**
 * Conversations table: stores chat threads between user and agents
 */
export const conversations = pgTable("conversations", {
  id: serial("id").primaryKey(),
  organizationId: integer("organizationId").notNull(), // Tenant owner
  userId: integer("userId").notNull(), // Creator/user owner
  taskId: integer("taskId"), // Optional: link to a specific task
  title: varchar("title", { length: 255 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull().$onUpdate(() => new Date()),
});

export type Conversation = typeof conversations.$inferSelect;
export type InsertConversation = typeof conversations.$inferInsert;

/**
 * Messages table: stores individual messages in conversations
 */
export const messages = pgTable("messages", {
  id: serial("id").primaryKey(),
  conversationId: integer("conversationId").notNull(), // Foreign key to conversations
  agentId: integer("agentId"), // Optional: if message is from an agent
  role: messageRoleEnum("role").notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Message = typeof messages.$inferSelect;
export type InsertMessage = typeof messages.$inferInsert;

/**
 * Task execution logs: stores detailed execution steps and progress
 */
export const taskExecutionLogs = pgTable("taskExecutionLogs", {
  id: serial("id").primaryKey(),
  taskId: integer("taskId").notNull(), // Foreign key to tasks
  agentId: integer("agentId"), // Which agent performed this step
  step: integer("step").notNull(), // Step number in execution sequence
  action: varchar("action", { length: 255 }).notNull(), // e.g., "thinking", "tool_call", "response"
  details: text("details"), // JSON or detailed description of the step
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type TaskExecutionLog = typeof taskExecutionLogs.$inferSelect;
export type InsertTaskExecutionLog = typeof taskExecutionLogs.$inferInsert;

/**
 * Tools registry: stores available tools that agents can use
 */
export const tools = pgTable("tools", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull().unique(),
  description: text("description").notNull(),
  category: varchar("category", { length: 100 }).notNull(), // e.g., "search", "data", "integration"
  isBuiltIn: boolean("isBuiltIn").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Tool = typeof tools.$inferSelect;
export type InsertTool = typeof tools.$inferInsert;


/**
 * Workflows table: stores workflow definitions for multi-agent collaboration
 */
export const workflows = pgTable("workflows", {
  id: serial("id").primaryKey(),
  organizationId: integer("organizationId").notNull(),
  userId: integer("userId").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  executionType: workflowExecutionTypeEnum("executionType").default("sequential").notNull(),
  status: workflowStatusEnum("status").default("draft").notNull(),
  config: text("config"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull().$onUpdate(() => new Date()),
});

export type Workflow = typeof workflows.$inferSelect;
export type InsertWorkflow = typeof workflows.$inferInsert;

/**
 * Workflow steps table: defines individual steps within a workflow
 */
export const workflowSteps = pgTable("workflowSteps", {
  id: serial("id").primaryKey(),
  workflowId: integer("workflowId").notNull(),
  stepNumber: integer("stepNumber").notNull(),
  agentIds: text("agentIds"),
  taskDescription: text("taskDescription").notNull(),
  dependsOn: text("dependsOn"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull().$onUpdate(() => new Date()),
});

export type WorkflowStep = typeof workflowSteps.$inferSelect;
export type InsertWorkflowStep = typeof workflowSteps.$inferInsert;

/**
 * Workflow executions table: tracks execution of workflows
 */
export const workflowExecutions = pgTable("workflowExecutions", {
  id: serial("id").primaryKey(),
  workflowId: integer("workflowId").notNull(),
  organizationId: integer("organizationId").notNull(),
  userId: integer("userId").notNull(),
  status: workflowExecutionStatusEnum("status").default("queued").notNull(),
  result: text("result"),
  error: text("error"),
  startedAt: timestamp("startedAt"),
  completedAt: timestamp("completedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull().$onUpdate(() => new Date()),
});

export type WorkflowExecution = typeof workflowExecutions.$inferSelect;
export type InsertWorkflowExecution = typeof workflowExecutions.$inferInsert;

/**
 * Workflow execution steps table: tracks execution of individual workflow steps
 */
export const workflowExecutionSteps = pgTable("workflowExecutionSteps", {
  id: serial("id").primaryKey(),
  executionId: integer("executionId").notNull(),
  stepId: integer("stepId").notNull(),
  agentId: integer("agentId"),
  status: workflowExecutionStepStatusEnum("status").default("pending").notNull(),
  result: text("result"),
  error: text("error"),
  startedAt: timestamp("startedAt"),
  completedAt: timestamp("completedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type WorkflowExecutionStep = typeof workflowExecutionSteps.$inferSelect;
export type InsertWorkflowExecutionStep = typeof workflowExecutionSteps.$inferInsert;
