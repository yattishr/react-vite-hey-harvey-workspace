import type { AgentTemplate } from "../../drizzle/schema";
import { createAgentTemplateVersion } from "./agentTemplateRepository";

export function buildAgentTemplateSnapshot(template: AgentTemplate) {
  const { usageCount, successCount, failureCount, ...snapshot } = template;
  return snapshot;
}

export async function snapshotAgentTemplateVersion(template: AgentTemplate) {
  return createAgentTemplateVersion({
    organizationId: template.organizationId,
    agentTemplateId: template.id,
    version: template.version,
    snapshot: buildAgentTemplateSnapshot(template),
  });
}
