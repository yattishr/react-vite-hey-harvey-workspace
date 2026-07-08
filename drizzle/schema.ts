import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, json, boolean, decimal } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: int("id").autoincrement().primaryKey(),
  /** Supabase Auth user id. This maps to auth.users.id in Supabase. */
  supabaseUserId: varchar("supabaseUserId", { length: 36 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * Organizations own tenant-scoped product data.
 */
export const organizations = mysqlTable("organizations", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  slug: varchar("slug", { length: 255 }).notNull().unique(),
  createdByUserId: int("createdByUserId").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Organization = typeof organizations.$inferSelect;
export type InsertOrganization = typeof organizations.$inferInsert;

/**
 * Organization membership controls tenant access and organization-level roles.
 */
export const organizationMembers = mysqlTable("organizationMembers", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId").notNull(),
  userId: int("userId").notNull(),
  role: mysqlEnum("role", ["owner", "admin", "member"]).default("member").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type OrganizationMember = typeof organizationMembers.$inferSelect;
export type InsertOrganizationMember = typeof organizationMembers.$inferInsert;

/**
 * Agents table: stores AI agent configurations
 */
export const agents = mysqlTable("agents", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId").notNull(), // Tenant owner
  userId: int("userId").notNull(), // Creator/user owner
  name: varchar("name", { length: 255 }).notNull(),
  role: varchar("role", { length: 255 }).notNull(), // e.g., "Research Agent", "Data Analyst"
  goal: text("goal").notNull(), // Agent's primary objective
  backstory: text("backstory"), // Agent's background/personality
  tools: varchar("tools", { length: 1000 }).default('[]'), // Array of tool names (JSON string)
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Agent = typeof agents.$inferSelect;
export type InsertAgent = typeof agents.$inferInsert;

/**
 * Tasks table: stores task assignments and execution records
 */
export const tasks = mysqlTable("tasks", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId").notNull(), // Tenant owner
  userId: int("userId").notNull(), // Creator/user owner
  agentIds: json("agentIds").$type<number[]>().notNull(), // Array of agent IDs assigned to this task
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description").notNull(), // Natural language task description
  status: mysqlEnum("status", ["queued", "running", "completed", "failed"]).default("queued").notNull(),
  result: text("result"), // Task output/result
  error: text("error"), // Error message if task failed
  executionStartedAt: timestamp("executionStartedAt"),
  executionCompletedAt: timestamp("executionCompletedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Task = typeof tasks.$inferSelect;
export type InsertTask = typeof tasks.$inferInsert;

/**
 * Conversations table: stores chat threads between user and agents
 */
export const conversations = mysqlTable("conversations", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId").notNull(), // Tenant owner
  userId: int("userId").notNull(), // Creator/user owner
  taskId: int("taskId"), // Optional: link to a specific task
  title: varchar("title", { length: 255 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Conversation = typeof conversations.$inferSelect;
export type InsertConversation = typeof conversations.$inferInsert;

/**
 * Messages table: stores individual messages in conversations
 */
export const messages = mysqlTable("messages", {
  id: int("id").autoincrement().primaryKey(),
  conversationId: int("conversationId").notNull(), // Foreign key to conversations
  agentId: int("agentId"), // Optional: if message is from an agent
  role: mysqlEnum("role", ["user", "agent", "system"]).notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Message = typeof messages.$inferSelect;
export type InsertMessage = typeof messages.$inferInsert;

/**
 * Task execution logs: stores detailed execution steps and progress
 */
export const taskExecutionLogs = mysqlTable("taskExecutionLogs", {
  id: int("id").autoincrement().primaryKey(),
  taskId: int("taskId").notNull(), // Foreign key to tasks
  agentId: int("agentId"), // Which agent performed this step
  step: int("step").notNull(), // Step number in execution sequence
  action: varchar("action", { length: 255 }).notNull(), // e.g., "thinking", "tool_call", "response"
  details: text("details"), // JSON or detailed description of the step
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type TaskExecutionLog = typeof taskExecutionLogs.$inferSelect;
export type InsertTaskExecutionLog = typeof taskExecutionLogs.$inferInsert;

/**
 * Tools registry: stores available tools that agents can use
 */
export const tools = mysqlTable("tools", {
  id: int("id").autoincrement().primaryKey(),
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
export const workflows = mysqlTable("workflows", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId").notNull(),
  userId: int("userId").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  executionType: mysqlEnum("executionType", ["sequential", "parallel", "conditional"]).default("sequential").notNull(),
  status: mysqlEnum("status", ["draft", "active", "archived"]).default("draft").notNull(),
  config: text("config"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Workflow = typeof workflows.$inferSelect;
export type InsertWorkflow = typeof workflows.$inferInsert;

/**
 * Workflow steps table: defines individual steps within a workflow
 */
export const workflowSteps = mysqlTable("workflowSteps", {
  id: int("id").autoincrement().primaryKey(),
  workflowId: int("workflowId").notNull(),
  stepNumber: int("stepNumber").notNull(),
  agentIds: text("agentIds"),
  taskDescription: text("taskDescription").notNull(),
  dependsOn: text("dependsOn"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type WorkflowStep = typeof workflowSteps.$inferSelect;
export type InsertWorkflowStep = typeof workflowSteps.$inferInsert;

/**
 * Workflow executions table: tracks execution of workflows
 */
export const workflowExecutions = mysqlTable("workflowExecutions", {
  id: int("id").autoincrement().primaryKey(),
  workflowId: int("workflowId").notNull(),
  organizationId: int("organizationId").notNull(),
  userId: int("userId").notNull(),
  status: mysqlEnum("status", ["queued", "running", "completed", "failed", "paused"]).default("queued").notNull(),
  result: text("result"),
  error: text("error"),
  startedAt: timestamp("startedAt"),
  completedAt: timestamp("completedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type WorkflowExecution = typeof workflowExecutions.$inferSelect;
export type InsertWorkflowExecution = typeof workflowExecutions.$inferInsert;

/**
 * Workflow execution steps table: tracks execution of individual workflow steps
 */
export const workflowExecutionSteps = mysqlTable("workflowExecutionSteps", {
  id: int("id").autoincrement().primaryKey(),
  executionId: int("executionId").notNull(),
  stepId: int("stepId").notNull(),
  agentId: int("agentId"),
  status: mysqlEnum("status", ["pending", "running", "completed", "failed", "skipped"]).default("pending").notNull(),
  result: text("result"),
  error: text("error"),
  startedAt: timestamp("startedAt"),
  completedAt: timestamp("completedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type WorkflowExecutionStep = typeof workflowExecutionSteps.$inferSelect;
export type InsertWorkflowExecutionStep = typeof workflowExecutionSteps.$inferInsert;
