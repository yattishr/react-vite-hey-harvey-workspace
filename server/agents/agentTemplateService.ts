import type { AgentTemplate } from "../../drizzle/schema";
import { createAgentFingerprint, normalizeAgentSlug } from "./agentFingerprint";
import { findBestAgentTemplateMatch } from "./agentMatcher";
import {
  canonicalizeCapabilities,
  inferCanonicalRoleKey,
  roleKeyToDisplayName,
} from "./roleCanon";
import {
  createAgentTemplate,
  getAgentTemplateByFingerprint,
  listActiveAgentTemplates,
  updateAgentTemplateCounters,
} from "./agentTemplateRepository";
import { snapshotAgentTemplateVersion } from "./agentVersionService";

export interface ResolveAgentTemplateInput {
  organizationId: number;
  roleKey: string;
  name: string;
  responsibility: string;
  requiredCapabilities: string[];
  taskSpecificInstructions: string[];
  taskObjective?: string;
  source?: AgentTemplate["source"];
}

export async function resolveAgentTemplate(input: ResolveAgentTemplateInput) {
  const canonicalRoleKey = inferCanonicalRoleKey(input);
  const capabilities = canonicalizeCapabilities([
    ...input.requiredCapabilities,
    ...(canonicalRoleKey === "investment_research_analyst" ? ["investment analysis"] : []),
  ]);
  const defaultInstructions = [
    "Use only task-provided context and upstream artifacts.",
    "Separate evidence, assumptions, and recommendations.",
  ];
  const fingerprint = createAgentFingerprint({
    roleKey: canonicalRoleKey,
    capabilities,
    defaultInstructions,
  });

  const exact = await getAgentTemplateByFingerprint(input.organizationId, fingerprint);
  if (exact?.status === "active") {
    await updateAgentTemplateCounters(input.organizationId, exact.id, "usageCount");
    return { template: exact, reused: true, score: 1 };
  }

  const activeTemplates = await listActiveAgentTemplates(input.organizationId);
  const best = findBestAgentTemplateMatch(activeTemplates, {
    ...input,
    roleKey: canonicalRoleKey,
    requiredCapabilities: capabilities,
  });
  if (best) {
    await updateAgentTemplateCounters(input.organizationId, best.template.id, "usageCount");
    return { template: best.template, reused: true, score: best.score };
  }

  const created = await createAgentTemplate({
    organizationId: input.organizationId,
    name: roleKeyToDisplayName(canonicalRoleKey),
    slug: `${normalizeAgentSlug(canonicalRoleKey)}-${Date.now().toString(36)}`,
    roleKey: canonicalRoleKey,
    role: roleKeyToDisplayName(canonicalRoleKey),
    description: input.responsibility,
    goal: input.responsibility,
    backstory: null,
    defaultInstructions,
    capabilities,
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
