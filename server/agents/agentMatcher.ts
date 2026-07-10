import type { AgentTemplate } from "../../drizzle/schema";
import { normalizeCapability } from "./agentFingerprint";

export interface AgentMatchInput {
  name: string;
  responsibility: string;
  requiredCapabilities: string[];
  taskSpecificInstructions: string[];
}

export interface AgentMatchResult {
  template: AgentTemplate;
  score: number;
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

export function scoreAgentTemplate(template: AgentTemplate, input: AgentMatchInput) {
  const roleNameScore = Math.max(
    textSimilarity(`${template.name} ${template.role}`, input.name),
    textSimilarity(template.role, input.name)
  );
  const capabilityScore = listOverlap(template.capabilities, input.requiredCapabilities);
  const responsibilityScore = textSimilarity(`${template.description} ${template.goal}`, input.responsibility);
  const instructionScore = listOverlap(template.defaultInstructions, input.taskSpecificInstructions);

  return (
    roleNameScore * 0.4 +
    capabilityScore * 0.35 +
    responsibilityScore * 0.15 +
    instructionScore * 0.1
  );
}

export function findBestAgentTemplateMatch(
  templates: AgentTemplate[],
  input: AgentMatchInput,
  threshold = getAgentReuseThreshold()
): AgentMatchResult | null {
  let best: AgentMatchResult | null = null;

  for (const template of templates) {
    const score = scoreAgentTemplate(template, input);
    if (!best || score > best.score) {
      best = { template, score };
    }
  }

  return best && best.score >= threshold ? best : null;
}
