import { normalizeCapability } from "./agentFingerprint";

export const ROLE_ALIASES: Record<string, string> = {
  analyst: "research_analyst",
  business_analyst: "research_analyst",
  company_research_analyst: "investment_research_analyst",
  data_analyst: "financial_analyst",
  equity_analyst: "investment_research_analyst",
  equity_research_analyst: "investment_research_analyst",
  financial_analysis_specialist: "financial_analyst",
  financial_research_analyst: "financial_analyst",
  investment_analyst: "investment_research_analyst",
  investment_researcher: "investment_research_analyst",
  investment_reviewer: "qa_reviewer",
  market_analyst: "marketing_analyst",
  market_research_analyst: "research_analyst",
  marketing_strategist: "marketing_analyst",
  process_research_analyst: "research_analyst",
  report_author: "report_writer",
  reviewer: "qa_reviewer",
  risk_assessment_analyst: "risk_analyst",
  risk_research_analyst: "risk_analyst",
  valuation_specialist: "valuation_analyst",
  writer: "report_writer",
};

const CANONICAL_ROLE_KEYS = new Set([
  "research_analyst",
  "investment_research_analyst",
  "financial_analyst",
  "risk_analyst",
  "valuation_analyst",
  "report_writer",
  "qa_reviewer",
  "marketing_analyst",
  "operations_analyst",
  "technology_consultant",
  "project_manager",
  "workflow_designer",
]);

const SUBJECT_TERMS = new Set([
  "absa",
  "bank",
  "coles",
  "company",
  "firm",
  "firstRand".toLowerCase(),
  "hey",
  "harvey",
  "holdings",
  "limited",
  "standard",
  "woolworths",
]);

export function normalizeRoleKey(value: string) {
  return value
    .trim()
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/_+/g, "_");
}

function roleNameToKey(value: string) {
  return normalizeRoleKey(value.replace(/\bagent\b/gi, "").trim());
}

export function canonicalizeRoleKey(roleKey: string | undefined, roleName: string) {
  const candidates = [roleKey, roleNameToKey(roleName)].filter((value): value is string => !!value);
  for (const candidate of candidates) {
    const normalized = normalizeRoleKey(candidate);
    const alias = ROLE_ALIASES[normalized] ?? normalized;
    if (CANONICAL_ROLE_KEYS.has(alias)) return alias;
  }

  const normalizedName = normalizeRoleKey(roleName);
  if (normalizedName.includes("investment") && normalizedName.includes("research")) {
    return "investment_research_analyst";
  }
  if (normalizedName.includes("financial") || normalizedName.includes("finance")) {
    return "financial_analyst";
  }
  if (normalizedName.includes("risk")) return "risk_analyst";
  if (normalizedName.includes("valuation")) return "valuation_analyst";
  if (normalizedName.includes("marketing")) return "marketing_analyst";
  if (normalizedName.includes("review") || normalizedName.includes("quality")) return "qa_reviewer";
  if (normalizedName.includes("write") || normalizedName.includes("report")) return "report_writer";
  if (normalizedName.includes("technology")) return "technology_consultant";
  if (normalizedName.includes("workflow")) return "workflow_designer";
  if (normalizedName.includes("project")) return "project_manager";
  if (normalizedName.includes("operation") || normalizedName.includes("process")) return "operations_analyst";
  if (normalizedName.includes("research") || normalizedName.includes("analyst")) return "research_analyst";

  return normalizedName || "research_analyst";
}

export function canonicalizeCapabilities(values: string[]) {
  return Array.from(
    new Set(
      values
        .map(value => {
          const normalized = normalizeCapability(value);
          const aliases: Record<string, string> = {
            "business analysis": "investment analysis",
            "data interpretation": "quality assurance",
            "financial analysis": "financial modeling",
            "market analysis": "market research",
            "research skills": "market research",
            "risk analysis": "risk assessment",
            "risk assessment methodologies": "risk assessment",
            "risk evaluation": "risk assessment",
            "risk management": "risk assessment",
            "valuation expertise": "valuation analysis",
            "valuation modeling": "valuation analysis",
          };
          return aliases[normalized] ?? normalized;
        })
        .filter(value => value && !SUBJECT_TERMS.has(value))
    )
  ).sort();
}

export function inferCanonicalRoleKey(input: {
  roleKey: string;
  name: string;
  responsibility: string;
  requiredCapabilities: string[];
  taskSpecificInstructions: string[];
  taskObjective?: string;
}) {
  const canonicalRoleKey = canonicalizeRoleKey(input.roleKey, input.name);
  const combined = [
    input.name,
    input.taskObjective ?? "",
    input.responsibility,
    ...input.requiredCapabilities,
    ...input.taskSpecificInstructions,
  ]
    .join(" ")
    .toLowerCase();

  if (
    canonicalRoleKey === "research_analyst" &&
    (combined.includes("investment") ||
      combined.includes("valuation") ||
      combined.includes("financial position") ||
      combined.includes("investment opportunity"))
  ) {
    return "investment_research_analyst";
  }

  return canonicalRoleKey;
}

export function roleKeyToDisplayName(roleKey: string) {
  return roleKey
    .split("_")
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
