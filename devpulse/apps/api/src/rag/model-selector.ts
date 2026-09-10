import type { RiskLevel } from "../risk/risk.types.js";

export interface ModelTierConfig {
  small: string;
  strong: string;
}

/**
 * A real cost control, not just a config default: LOW-risk PRs get no AI
 * call at all (`null`) — a PR the deterministic engine already considers
 * unremarkable doesn't need an LLM to agree. MEDIUM uses the cheaper
 * model tier; HIGH/CRITICAL use the stronger one, since that's exactly
 * where a shallow or wrong explanation is most costly to trust. Pure and
 * model-name-agnostic on purpose — the actual model strings live in env
 * config, not hardcoded here, so this is testable with fixture names
 * instead of real model identifiers.
 */
export function selectModelForRiskLevel(level: RiskLevel, models: ModelTierConfig): string | null {
  switch (level) {
    case "LOW":
      return null;
    case "MEDIUM":
      return models.small;
    case "HIGH":
    case "CRITICAL":
      return models.strong;
  }
}
