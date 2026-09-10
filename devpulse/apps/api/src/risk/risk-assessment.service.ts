import { findRepositoryById } from "../github/repository.service.js";
import { findPullRequestById } from "../pull-requests/pull-request.repository.js";
import { createRiskAssessment } from "./risk-assessment.repository.js";
import { buildRiskInputFromGithub } from "./risk-context.service.js";
import { calculateRiskScore, calculateRiskSignals } from "./risk-engine.js";
import { RISK_ENGINE_VERSION } from "./risk-rules.config.js";
import type { RiskAssessmentRecord } from "./risk.types.js";

export class PullRequestNotFoundError extends Error {}
export class RepositoryNotFoundError extends Error {}

/**
 * The one entry point Slice 5 exposes: score a single PR and persist the
 * result. Deliberately just a plain callable service — no HTTP route (that's
 * `GET /pull-requests/:id/risk` in Slice 6) and no automatic trigger from
 * the Slice 4 webhook pipeline (nothing in this slice's scope asked for
 * that, and wiring it in is a deliberate integration decision better made
 * explicitly than smuggled into "the engine exists" work).
 */
export async function assessPullRequest(pullRequestId: string): Promise<RiskAssessmentRecord> {
  const pullRequest = await findPullRequestById(pullRequestId);
  if (!pullRequest) {
    throw new PullRequestNotFoundError(`PullRequest ${pullRequestId} not found`);
  }

  const repository = await findRepositoryById(pullRequest.repositoryId);
  if (!repository) {
    throw new RepositoryNotFoundError(`Repository ${pullRequest.repositoryId} not found`);
  }

  const input = await buildRiskInputFromGithub(
    repository.githubInstallationId,
    repository.owner,
    repository.name,
    pullRequest.number,
    {
      additions: pullRequest.additions,
      deletions: pullRequest.deletions,
      changedFilesCount: pullRequest.changedFilesCount,
    }
  );

  const signals = calculateRiskSignals(input);
  const { score, level } = calculateRiskScore(signals);

  return createRiskAssessment({
    pullRequestId: pullRequest.id,
    score,
    level,
    rulesTriggered: signals,
    engineVersion: RISK_ENGINE_VERSION,
  });
}
