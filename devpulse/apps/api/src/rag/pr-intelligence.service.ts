import { env } from "../config/env.js";
import { logger } from "../logger.js";
import { RETRIEVAL_VERSION } from "../retrieval/retrieval.service.js";
import { RISK_ENGINE_VERSION } from "../risk/risk-rules.config.js";
import { PullRequestNotFoundError, RepositoryNotFoundError, analyzePullRequest } from "./pr-analysis.service.js";
import { createPrIntelligence, findLatestPrIntelligence } from "./pr-intelligence.repository.js";
import { PROMPT_VERSION } from "./prompt-builder.js";
import type { PrIntelligenceRecord } from "./pr-intelligence.types.js";

export { PullRequestNotFoundError, RepositoryNotFoundError };

export type PrIntelligenceResult =
  | { status: "analyzed"; intelligence: PrIntelligenceRecord }
  | { status: "skipped_low_risk"; score: number; level: string };

/**
 * The Slice 10 entry point: get (or produce and persist) the unified
 * deterministic + AI analysis for a PR. This is the "previous pieces
 * finally become one product" moment the design doc describes — but the
 * unification is structural, not a rewrite: this function is a thin
 * wrapper around Slice 9's `analyzePullRequest`, which still owns all the
 * actual analysis logic (retrieval, prompting, LLM call, validation).
 * This layer's entire job is: reuse a persisted analysis if one exists,
 * otherwise call Slice 9, then persist the result with every version
 * stamp filled in.
 *
 * Still a callable service, not wired to any trigger — no HTTP route from
 * this file (that's pull-requests/pull-request.routes.ts), no automatic
 * run after PR sync.
 */
export async function getOrCreatePrIntelligence(pullRequestId: string): Promise<PrIntelligenceResult> {
  const existing = await findLatestPrIntelligence(pullRequestId);
  if (existing) {
    return { status: "analyzed", intelligence: existing };
  }

  const result = await analyzePullRequest(pullRequestId);

  if (result.status === "skipped_low_risk") {
    // Deliberately not persisted — a LOW-risk PR never called the
    // embedding or LLM APIs, so there's nothing versioned to record, and
    // persisting a placeholder row would just be noise a UI has to filter
    // back out. The caller gets the same skip signal Slice 9 already
    // produces.
    return result;
  }

  logger.info(
    { pullRequestId, model: result.model, riskAssessmentId: result.riskAssessmentId },
    "Persisting a new unified PR intelligence record"
  );

  const intelligence = await createPrIntelligence({
    pullRequestId,
    riskAssessmentId: result.riskAssessmentId,
    deterministicScore: result.score,
    riskLevel: result.level as PrIntelligenceRecord["riskLevel"],
    summary: result.analysis.summary,
    findings: result.analysis.riskExplanation,
    recommendations: result.analysis.recommendations,
    confidence: result.analysis.confidence,
    riskEngineVersion: RISK_ENGINE_VERSION,
    promptVersion: PROMPT_VERSION,
    embeddingModel: env.EMBEDDING_MODEL,
    retrievalVersion: RETRIEVAL_VERSION,
    llmModel: result.model,
  });

  return { status: "analyzed", intelligence };
}
