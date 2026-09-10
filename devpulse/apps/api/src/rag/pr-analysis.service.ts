import { env } from "../config/env.js";
import { findRepositoryById } from "../github/repository.service.js";
import { logger } from "../logger.js";
import { findPullRequestById } from "../pull-requests/pull-request.repository.js";
import { listRiskAssessmentsForPullRequest } from "../risk/risk-assessment.repository.js";
import { assessPullRequest } from "../risk/risk-assessment.service.js";
import { retrieveRelevantContext } from "../retrieval/retrieval.service.js";
import { generateChatCompletion } from "./llm-client.js";
import { selectModelForRiskLevel } from "./model-selector.js";
import { buildPrAnalysisPrompt } from "./prompt-builder.js";
import { parsePrAnalysisResponse } from "./response-parser.js";
import type { PrAnalysisResult } from "./pr-analysis.types.js";

export class PullRequestNotFoundError extends Error {}
export class RepositoryNotFoundError extends Error {}

export type AnalyzePullRequestResult =
  | {
      status: "analyzed";
      analysis: PrAnalysisResult;
      model: string;
      riskAssessmentId: string;
      score: number;
      level: string;
    }
  | { status: "skipped_low_risk"; score: number; level: string };

const RETRIEVAL_TOP_K = 5;

/**
 * The Slice 9 entry point: combine a PR's deterministic risk assessment
 * (Slice 5) with retrieved engineering memory (Slice 8) into a grounded,
 * schema-validated explanation. Same "callable service, not wired to any
 * trigger" pattern as every prior slice's orchestrator — no HTTP route,
 * no automatic run.
 *
 * Deliberately does NOT persist the result — Slice 10's `pr-intelligence.service.ts`
 * wraps this function and is the thing that actually writes a `PRAnalysis`
 * row (see that file). Keeping persistence out of this function is what
 * let Slice 9 ship without scaffolding a table ahead of settling on the
 * exact shape to store, and it stays that way now: this function still
 * has no opinion about storage, Slice 10's wrapper does.
 */
export async function analyzePullRequest(pullRequestId: string): Promise<AnalyzePullRequestResult> {
  const pullRequest = await findPullRequestById(pullRequestId);
  if (!pullRequest) {
    throw new PullRequestNotFoundError(`PullRequest ${pullRequestId} not found`);
  }

  const repository = await findRepositoryById(pullRequest.repositoryId);
  if (!repository) {
    throw new RepositoryNotFoundError(`Repository ${pullRequest.repositoryId} not found`);
  }

  // Reuse an existing assessment if one exists (same "don't recompute
  // what's already there" reasoning as the Slice 6 risk route); compute
  // one fresh via Slice 5's engine if this PR has never been scored.
  const existing = await listRiskAssessmentsForPullRequest(pullRequest.id);
  const riskAssessment = existing[0] ?? (await assessPullRequest(pullRequest.id));

  const model = selectModelForRiskLevel(riskAssessment.level, {
    small: env.LLM_MODEL_SMALL,
    strong: env.LLM_MODEL_STRONG,
  });

  if (!model) {
    logger.info({ pullRequestId, level: riskAssessment.level }, "Skipping AI analysis for a LOW-risk PR");
    return { status: "skipped_low_risk", score: riskAssessment.score, level: riskAssessment.level };
  }

  // A natural-language proxy for "what should we search organizational
  // memory for": the PR's own title plus the plain-English reasons the
  // deterministic engine actually flagged, not a hand-authored query.
  const triggeredExplanations = riskAssessment.rulesTriggered
    .filter((signal) => signal.triggered)
    .map((signal) => signal.explanation);
  const retrievalQuery = [pullRequest.title, ...triggeredExplanations].join(". ");

  const memory = await retrieveRelevantContext({
    organizationId: repository.organizationId,
    query: retrievalQuery,
    topK: RETRIEVAL_TOP_K,
  });

  const { systemPrompt, userPrompt } = buildPrAnalysisPrompt({
    pr: {
      title: pullRequest.title,
      body: pullRequest.body,
      author: pullRequest.author,
      baseBranch: pullRequest.baseBranch,
      headBranch: pullRequest.headBranch,
      additions: pullRequest.additions,
      deletions: pullRequest.deletions,
      changedFilesCount: pullRequest.changedFilesCount,
    },
    risk: { score: riskAssessment.score, level: riskAssessment.level, signals: riskAssessment.rulesTriggered },
    memory,
  });

  const raw = await generateChatCompletion(model, systemPrompt, userPrompt);
  const analysis = parsePrAnalysisResponse(raw);

  return {
    status: "analyzed",
    analysis,
    model,
    riskAssessmentId: riskAssessment.id,
    score: riskAssessment.score,
    level: riskAssessment.level,
  };
}
