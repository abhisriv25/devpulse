import { fetchPullRequestFilesFromGithub } from "../github/pull-request.service.js";
import type { RiskInput } from "./risk.types.js";

/**
 * Assembles a RiskInput from GitHub — the only I/O the risk engine needs.
 * Kept separate from calculateRiskSignals/calculateRiskScore on purpose
 * (see risk-engine.ts's doc comment): this function is allowed to make
 * network calls, those aren't.
 *
 * Only fetches the per-file list — the aggregate diff counters
 * (additions/deletions/changedFilesCount) are passed in from the already-
 * synced PullRequest row rather than re-fetched, since Slice 4's sync
 * already has them.
 */
export async function buildRiskInputFromGithub(
  installationId: string,
  owner: string,
  repo: string,
  prNumber: number,
  totals: { additions: number; deletions: number; changedFilesCount: number }
): Promise<RiskInput> {
  const files = await fetchPullRequestFilesFromGithub(installationId, owner, repo, prNumber);

  return {
    additions: totals.additions,
    deletions: totals.deletions,
    changedFilesCount: totals.changedFilesCount,
    changedFiles: files.map((f) => ({
      filename: f.filename,
      additions: f.additions,
      deletions: f.deletions,
      status: f.status,
    })),
  };
}
