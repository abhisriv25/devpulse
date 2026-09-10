import { prisma } from "../db/client.js";
import type { CreatePrIntelligenceInput, PrIntelligenceRecord } from "./pr-intelligence.types.js";

export function createPrIntelligence(input: CreatePrIntelligenceInput): Promise<PrIntelligenceRecord> {
  return prisma.pRAnalysis.create({
    data: {
      pullRequestId: input.pullRequestId,
      riskAssessmentId: input.riskAssessmentId,
      deterministicScore: input.deterministicScore,
      riskLevel: input.riskLevel,
      summary: input.summary,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      findings: input.findings as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      recommendations: input.recommendations as any,
      confidence: input.confidence,
      riskEngineVersion: input.riskEngineVersion,
      promptVersion: input.promptVersion,
      embeddingModel: input.embeddingModel,
      retrievalVersion: input.retrievalVersion,
      llmModel: input.llmModel,
    },
  });
}

/** The most recent unified analysis for a PR, or null if it's never been
 * analyzed (or was last analyzed as LOW risk, which is never persisted —
 * see pr-intelligence.service.ts). */
export function findLatestPrIntelligence(pullRequestId: string): Promise<PrIntelligenceRecord | null> {
  return prisma.pRAnalysis.findFirst({
    where: { pullRequestId },
    orderBy: { createdAt: "desc" },
  });
}
