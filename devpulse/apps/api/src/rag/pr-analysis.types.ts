import { z } from "zod";

/**
 * Deliberately categorical, not a fake-precise float like `0.81` or
 * `83.742%` — the design doc is explicit elsewhere that confidence should
 * read as HIGH/MEDIUM/LOW, not manufactured decimal precision an LLM has
 * no real basis for. Same philosophy as the risk engine's own LOW/MEDIUM/
 * HIGH/CRITICAL bands (Slice 5): honest granularity over false precision.
 */
export const ConfidenceLevelSchema = z.enum(["LOW", "MEDIUM", "HIGH"]);
export type ConfidenceLevel = z.infer<typeof ConfidenceLevelSchema>;

export const RiskExplanationSchema = z.object({
  title: z.string(),
  severity: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]),
  reason: z.string(),
  evidence: z.array(z.string()),
});
export type RiskExplanationItem = z.infer<typeof RiskExplanationSchema>;

export const RecommendationSchema = z.object({
  action: z.string(),
  reason: z.string(),
  /** A document path (e.g. "docs/caching.md") when the recommendation is
   * grounded in retrieved engineering memory, or null when it's grounded
   * only in the PR facts / deterministic risk signals — never a vague
   * "the docs suggest" with nothing to actually point at. */
  source: z.string().nullable(),
});
export type RecommendationItem = z.infer<typeof RecommendationSchema>;

/**
 * The full shape the LLM must return, enforced at runtime — "never trust
 * model output blindly" isn't a suggestion, it's this schema plus
 * response-parser.ts actually rejecting anything that doesn't match it.
 */
export const PrAnalysisResultSchema = z.object({
  summary: z.string(),
  riskExplanation: z.array(RiskExplanationSchema),
  recommendations: z.array(RecommendationSchema),
  confidence: ConfidenceLevelSchema,
});
export type PrAnalysisResult = z.infer<typeof PrAnalysisResultSchema>;
