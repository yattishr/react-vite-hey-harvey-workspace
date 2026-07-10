import type { AgentTemplate } from "../../drizzle/schema";
import { createAgentFingerprint, normalizeAgentSlug } from "./agentFingerprint";
import { findBestAgentTemplateMatch } from "./agentMatcher";
import {
  createAgentTemplate,
  getAgentTemplateByFingerprint,
  listActiveAgentTemplates,
  updateAgentTemplateCounters,
} from "./agentTemplateRepository";
import { snapshotAgentTemplateVersion } from "./agentVersionService";

export interface ResolveAgentTemplateInput {
  organizationId: number;
  name: string;
  responsibility: string;
  requiredCapabilities: string[];
  taskSpecificInstructions: string[];
  source?: AgentTemplate["source"];
}

export async function resolveAgentTemplate(input: ResolveAgentTemplateInput) {
  const defaultInstructions = input.taskSpecificInstructions.slice(0, 5);
  const fingerprint = createAgentFingerprint({
    role: input.name,
    capabilities: input.requiredCapabilities,
    defaultInstructions,
  });

  const exact = await getAgentTemplateByFingerprint(input.organizationId, fingerprint);
  if (exact?.status === "active") {
    await updateAgentTemplateCounters(input.organizationId, exact.id, "usageCount");
    return { template: exact, reused: true, score: 1 };
  }

  const activeTemplates = await listActiveAgentTemplates(input.organizationId);
  const best = findBestAgentTemplateMatch(activeTemplates, input);
  if (best) {
    await updateAgentTemplateCounters(input.organizationId, best.template.id, "usageCount");
    return { template: best.template, reused: true, score: best.score };
  }

  const created = await createAgentTemplate({
    organizationId: input.organizationId,
    name: input.name,
    slug: `${normalizeAgentSlug(input.name)}-${Date.now().toString(36)}`,
    role: input.name,
    description: input.responsibility,
    goal: input.responsibility,
    backstory: null,
    defaultInstructions,
    capabilities: input.requiredCapabilities,
    toolPermissions: [],
    status: "active",
    source: input.source ?? "generated",
    version: 1,
    fingerprint,
    usageCount: 1,
    successCount: 0,
    failureCount: 0,
  });

  await snapshotAgentTemplateVersion(created);
  return { template: created, reused: false, score: 0 };
}

export async function incrementAgentTemplateSuccess(organizationId: number, templateId: number) {
  await updateAgentTemplateCounters(organizationId, templateId, "successCount");
}

export async function incrementAgentTemplateFailure(organizationId: number, templateId: number) {
  await updateAgentTemplateCounters(organizationId, templateId, "failureCount");
}
