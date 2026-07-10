import { createHash } from "node:crypto";

export interface AgentFingerprintInput {
  roleKey: string;
  capabilities: string[];
  defaultInstructions: string[];
}

function normalizeText(value: string) {
  return value
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeList(values: string[]) {
  return Array.from(new Set(values.map(normalizeText).filter(Boolean))).sort();
}

export function createAgentFingerprint(input: AgentFingerprintInput) {
  const normalized = {
    roleKey: normalizeText(input.roleKey),
    capabilities: normalizeList(input.capabilities),
    defaultInstructions: normalizeList(input.defaultInstructions),
  };

  return createHash("sha256").update(JSON.stringify(normalized)).digest("hex");
}

export function normalizeAgentSlug(value: string) {
  const slug = normalizeText(value).replace(/\s+/g, "-").slice(0, 80);
  return slug || "agent-template";
}

export function normalizeCapability(value: string) {
  return normalizeText(value);
}
