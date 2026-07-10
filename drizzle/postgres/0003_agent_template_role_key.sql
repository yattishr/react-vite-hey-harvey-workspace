ALTER TABLE "agentTemplates"
ADD COLUMN IF NOT EXISTS "roleKey" varchar(255) DEFAULT 'research_analyst' NOT NULL;
--> statement-breakpoint
UPDATE "agentTemplates"
SET "roleKey" = CASE
  WHEN lower("name") LIKE '%investment%research%' OR lower("role") LIKE '%investment%research%' THEN 'investment_research_analyst'
  WHEN lower("name") LIKE '%financial%' OR lower("role") LIKE '%financial%' THEN 'financial_analyst'
  WHEN lower("name") LIKE '%risk%' OR lower("role") LIKE '%risk%' THEN 'risk_analyst'
  WHEN lower("name") LIKE '%valuation%' OR lower("role") LIKE '%valuation%' THEN 'valuation_analyst'
  WHEN lower("name") LIKE '%marketing%' OR lower("role") LIKE '%marketing%' THEN 'marketing_analyst'
  WHEN lower("name") LIKE '%review%' OR lower("role") LIKE '%review%' THEN 'qa_reviewer'
  WHEN lower("name") LIKE '%writer%' OR lower("role") LIKE '%writer%' OR lower("name") LIKE '%report%' OR lower("role") LIKE '%report%' THEN 'report_writer'
  WHEN lower("name") LIKE '%technology%' OR lower("role") LIKE '%technology%' THEN 'technology_consultant'
  WHEN lower("name") LIKE '%workflow%' OR lower("role") LIKE '%workflow%' THEN 'workflow_designer'
  WHEN lower("name") LIKE '%project%' OR lower("role") LIKE '%project%' THEN 'project_manager'
  WHEN lower("name") LIKE '%operation%' OR lower("role") LIKE '%operation%' OR lower("name") LIKE '%process%' OR lower("role") LIKE '%process%' THEN 'operations_analyst'
  ELSE 'research_analyst'
END;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "agentTemplates_organizationId_roleKey_idx"
ON "agentTemplates" ("organizationId", "roleKey");
