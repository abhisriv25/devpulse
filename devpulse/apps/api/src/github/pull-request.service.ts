import { GITHUB_API_BASE, GITHUB_USER_AGENT, createInstallationAccessToken } from "./github-app.service.js";
import type { GithubPullRequestApiResponse, GithubPullRequestFile } from "./pull-request.types.js";

/** Distinguishes "GitHub confirms this PR doesn't exist" from any other
 * failure (network blip, 5xx, rate limit). The processor treats these
 * very differently — a 404 is permanent (mark the event FAILED), anything
 * else might succeed on retry (leave it RECEIVED). */
export class GithubApiNotFoundError extends Error {}

/**
 * Fetches the current, authoritative state of a PR from GitHub's API.
 *
 * Deliberately takes GitHub App installation credentials, not a user's
 * OAuth token: the user authenticated *to DevPulse*, but the GitHub App
 * installation is what was actually granted access to this organization's
 * repositories, and is what should be doing the fetching — an
 * architectural line worth keeping straight even though both would
 * technically work for a public repo.
 */
export async function fetchPullRequestFromGithub(
  installationId: string,
  owner: string,
  repo: string,
  prNumber: number
): Promise<GithubPullRequestApiResponse> {
  const token = await createInstallationAccessToken(installationId);

  const response = await fetch(`${GITHUB_API_BASE}/repos/${owner}/${repo}/pulls/${prNumber}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "User-Agent": GITHUB_USER_AGENT,
    },
  });

  if (response.status === 404) {
    throw new GithubApiNotFoundError(`PR ${owner}/${repo}#${prNumber} not found`);
  }

  if (!response.ok) {
    throw new Error(`Failed to fetch PR ${owner}/${repo}#${prNumber}: ${response.status}`);
  }

  return (await response.json()) as GithubPullRequestApiResponse;
}

/**
 * Fetches the list of individual changed files for a PR — the Slice 5
 * risk engine's only reason to call this endpoint at all (per-file paths
 * for the sensitive-path/migration/dependency/test-presence rules). Not
 * cached or persisted; each risk assessment fetches current data, same
 * reasoning as fetching the PR itself rather than trusting a webhook
 * payload's stale snapshot.
 */
export async function fetchPullRequestFilesFromGithub(
  installationId: string,
  owner: string,
  repo: string,
  prNumber: number
): Promise<GithubPullRequestFile[]> {
  const token = await createInstallationAccessToken(installationId);
  const files: GithubPullRequestFile[] = [];
  let page = 1;

  // Same "don't silently truncate" reasoning as fetchInstallationRepositories.
  for (;;) {
    const response = await fetch(
      `${GITHUB_API_BASE}/repos/${owner}/${repo}/pulls/${prNumber}/files?per_page=100&page=${page}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github+json",
          "User-Agent": GITHUB_USER_AGENT,
        },
      }
    );

    if (response.status === 404) {
      throw new GithubApiNotFoundError(`PR ${owner}/${repo}#${prNumber} not found`);
    }

    if (!response.ok) {
      throw new Error(`Failed to fetch files for PR ${owner}/${repo}#${prNumber}: ${response.status}`);
    }

    const pageFiles = (await response.json()) as GithubPullRequestFile[];
    files.push(...pageFiles);

    if (pageFiles.length < 100) break;
    page += 1;
  }

  return files;
}
