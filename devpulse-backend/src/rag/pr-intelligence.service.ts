import type { PRAnalysis, Prisma } from "@prisma/client";
import { prisma } from "../prisma.js";
import { RETRIEVAL_VERSION } from "../retrieval/retrieval.service.js";
import { getOrCreateLatestRiskAssessment } from "../risk/risk-assessment.service.js";
import { RISK_ENGINE_VERSION } from "../risk/risk-rules.config.js";
import { analyzePullRequest } from "./pr-analysis.service.js";
import { PROMPT_VERSION } from "./prompt-builder.js";

export type PrIntelligenceResult =
  | { status: "skipped_low_risk"; score: number; level: string }
  | { status: "analyzed"; analysis: PRAnalysis };

/** Reuse the stored analysis for the current risk assessment; otherwise
 * analyze and persist it, stamped with every version that shaped it.
 * A LOW-risk skip is never persisted. */
export async function getOrCreatePrIntelligence(pullRequestId: string): Promise<PrIntelligenceResult> {
  const assessment = await getOrCreateLatestRiskAssessment(pullRequestId);

  const existing = await prisma.pRAnalysis.findFirst({
    where: { pullRequestId, riskAssessmentId: assessment.id },
    orderBy: { createdAt: "desc" },
  });
  if (existing) return { status: "analyzed", analysis: existing };

  const result = await analyzePullRequest(pullRequestId, assessment);
  if (result.status === "skipped_low_risk") return result;

  const analysis = await prisma.pRAnalysis.create({
    data: {
      pullRequestId,
      riskAssessmentId: result.riskAssessmentId,
      deterministicScore: result.score,
      riskLevel: result.level,
      summary: result.analysis.summary,
      findings: result.analysis.riskExplanation as unknown as Prisma.InputJsonValue,
      recommendations: result.analysis.recommendations as unknown as Prisma.InputJsonValue,
      confidence: result.analysis.confidence,
      riskEngineVersion: RISK_ENGINE_VERSION,
      promptVersion: PROMPT_VERSION,
      embeddingModel: result.embeddingModel,
      retrievalVersion: RETRIEVAL_VERSION,
      llmModel: result.model,
    },
  });
  return { status: "analyzed", analysis };
}
