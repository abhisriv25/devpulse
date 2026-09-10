import { prisma } from "../db/client.js";
import type { RiskAssessmentRecord, RiskLevel, RiskSignal } from "./risk.types.js";

export interface CreateRiskAssessmentInput {
  pullRequestId: string;
  score: number;
  level: RiskLevel;
  rulesTriggered: RiskSignal[];
  engineVersion: string;
}

export function createRiskAssessment(input: CreateRiskAssessmentInput): Promise<RiskAssessmentRecord> {
  return prisma.riskAssessment.create({
    data: {
      pullRequestId: input.pullRequestId,
      score: input.score,
      level: input.level,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      rulesTriggered: input.rulesTriggered as any,
      engineVersion: input.engineVersion,
    },
  });
}

/** Every historical assessment for a PR, newest first — lets a future UI
 * (Slice 6) show "why did this score change" rather than only ever the
 * latest number. */
export function listRiskAssessmentsForPullRequest(pullRequestId: string): Promise<RiskAssessmentRecord[]> {
  return prisma.riskAssessment.findMany({
    where: { pullRequestId },
    orderBy: { createdAt: "desc" },
  });
}
