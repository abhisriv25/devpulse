import type { RiskLevel } from "../risk/risk.types.js";
import type { ConfidenceLevel, RecommendationItem, RiskExplanationItem } from "./pr-analysis.types.js";

/** Explicit return shape (rather than relying on Prisma's inferred payload
 * type) so callers type-check correctly even before `prisma generate` has
 * run — same reasoning as every other *Record type in this codebase. */
export interface PrIntelligenceRecord {
  id: string;
  pullRequestId: string;
  riskAssessmentId: string;
  deterministicScore: number;
  riskLevel: RiskLevel;
  summary: string;
  findings: RiskExplanationItem[];
  recommendations: RecommendationItem[];
  confidence: ConfidenceLevel;
  riskEngineVersion: string;
  promptVersion: string;
  embeddingModel: string | null;
  retrievalVersion: string;
  llmModel: string;
  createdAt: Date;
}

export interface CreatePrIntelligenceInput {
  pullRequestId: string;
  riskAssessmentId: string;
  deterministicScore: number;
  riskLevel: RiskLevel;
  summary: string;
  findings: RiskExplanationItem[];
  recommendations: RecommendationItem[];
  confidence: ConfidenceLevel;
  riskEngineVersion: string;
  promptVersion: string;
  embeddingModel: string | null;
  retrievalVersion: string;
  llmModel: string;
}
