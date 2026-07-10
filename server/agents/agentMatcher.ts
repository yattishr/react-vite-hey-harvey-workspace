import type { AgentTemplate } from "../../drizzle/schema";
import { normalizeCapability } from "./agentFingerprint";
import { canonicalizeCapabilities, canonicalizeRoleKey } from "./roleCanon";

export interface AgentMatchInput {
  roleKey: string;
  name: string;
  responsibility: string;
  requiredCapabilities: string[];
  taskSpecificInstructions: string[];
}

export interface AgentMatchResult {
  template: AgentTemplate;
  score: number;
  strategy: "exact_role_key" | "role_alias" | "weighted";
}

const DEFAULT_REUSE_THRESHOLD = 0.78;

export function getAgentReuseThreshold() {
  const parsed = Number(process.env.AGENT_REUSE_THRESHOLD);
  return Number.isFinite(parsed) && parsed >= 0 && parsed <= 1 ? parsed : DEFAULT_REUSE_THRESHOLD;
}

function tokenize(value: string) {
  return new Set(
    value
      .toLowerCase()
      .replace(/[^\w\s]/g, " ")
      .split(/\s+/)
      .filter(Boolean)
  );
}

function textSimilarity(left: string, right: string) {
  const leftTokens = tokenize(left);
  const rightTokens = tokenize(right);
  if (leftTokens.size === 0 || rightTokens.size === 0) return 0;

  const overlap = Array.from(leftTokens).filter(token => rightTokens.has(token)).length;
  return overlap / Math.max(leftTokens.size, rightTokens.size);
}

function listOverlap(left: string[], right: string[]) {
  const leftSet = new Set(left.map(normalizeCapability).filter(Boolean));
  const rightSet = new Set(right.map(normalizeCapability).filter(Boolean));
  if (leftSet.size === 0 || rightSet.size === 0) return 0;

  const overlap = Array.from(leftSet).filter(value => rightSet.has(value)).length;
  return overlap / Math.max(leftSet.size, rightSet.size);
}

export function capabilityCompatibility(left: string[], right: string[]) {
  const leftCapabilities = canonicalizeCapabilities(left);
  const rightCapabilities = canonicalizeCapabilities(right);
  if (leftCapabilities.length === 0 || rightCapabilities.length === 0) return 0;

  const leftSet = new Set(leftCapabilities);
  const rightSet = new Set(rightCapabilities);
  const overlap = leftCapabilities.filter(value => rightSet.has(value)).length;
  const smallerSetCoverage = overlap / Math.min(leftSet.size, rightSet.size);
  const largerSetCoverage = overlap / Math.max(leftSet.size, rightSet.size);

  return smallerSetCoverage * 0.7 + largerSetCoverage * 0.3;
}

export function scoreAgentTemplate(template: AgentTemplate, input: AgentMatchInput) {
  const templateRoleKey = canonicalizeRoleKey(template.roleKey, template.name);
  const inputRoleKey = canonicalizeRoleKey(input.roleKey, input.name);
  const roleKeyScore = templateRoleKey === inputRoleKey ? 1 : 0;
  const roleNameScore = Math.max(
    textSimilarity(`${template.name} ${template.role}`, input.name),
    textSimilarity(template.role, input.name)
  );
  const capabilityScore = listOverlap(template.capabilities, input.requiredCapabilities);
  const responsibilityScore = textSimilarity(`${template.description} ${template.goal}`, input.responsibility);
  const instructionScore = listOverlap(template.defaultInstructions, input.taskSpecificInstructions);

  return (
    roleKeyScore * 0.35 +
    roleNameScore * 0.25 +
    capabilityScore * 0.35 +
    responsibilityScore * 0.05 +
    instructionScore * 0
  );
}

export function findBestAgentTemplateMatch(
  templates: AgentTemplate[],
  input: AgentMatchInput,
  threshold = getAgentReuseThreshold()
): AgentMatchResult | null {
  const canonicalInputRoleKey = canonicalizeRoleKey(input.roleKey, input.name);
  const exactRoleMatches = templates
    .map(template => ({
      template,
      score: capabilityCompatibility(template.capabilities, input.requiredCapabilities),
      strategy: "exact_role_key" as const,
    }))
    .filter(match => canonicalizeRoleKey(match.template.roleKey, match.template.name) === canonicalInputRoleKey)
    .sort((left, right) => right.score - left.score);

  if (exactRoleMatches[0] && exactRoleMatches[0].score >= 0.45) {
    return exactRoleMatches[0];
  }

  const aliasMatches = templates
    .map(template => ({
      template,
      compatibility: capabilityCompatibility(template.capabilities, input.requiredCapabilities),
      score:
        scoreAgentTemplate(template, input) +
        capabilityCompatibility(template.capabilities, input.requiredCapabilities) * 0.25,
      strategy: "role_alias" as const,
    }))
    .filter(
      match =>
        canonicalizeRoleKey(match.template.roleKey, match.template.name) === canonicalInputRoleKey &&
        match.compatibility >= 0.25
    )
    .sort((left, right) => right.score - left.score);

  if (aliasMatches[0] && aliasMatches[0].score >= 0.6) {
    return aliasMatches[0];
  }

  let best: AgentMatchResult | null = null;

  for (const template of templates) {
    const templateRoleKey = canonicalizeRoleKey(template.roleKey, template.name);
    if (templateRoleKey !== canonicalInputRoleKey && capabilityCompatibility(template.capabilities, input.requiredCapabilities) < 0.65) {
      continue;
    }

    const score = scoreAgentTemplate(template, input);
    if (!best || score > best.score) {
      best = { template, score, strategy: "weighted" };
    }
  }

  return best && best.score >= threshold ? best : null;
}
