import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import type {
  GithubInstallationRepo,
  GithubInstallationRepositoriesResponse,
  GithubInstallationTokenResponse,
} from "./github-app.types.js";

export const GITHUB_API_BASE = "https://api.github.com";
export const GITHUB_USER_AGENT = "devpulse-app";

/**
 * Short-lived (≤10 min) JWT identifying the GitHub App itself. This is only
 * ever used for one thing — minting an installation access token — never
 * for any other API call, and never stored.
 */
function buildAppJwt(): string {
  const nowSeconds = Math.floor(Date.now() / 1000);
  return jwt.sign(
    {
      iat: nowSeconds - 60, // back-dated 60s to tolerate clock drift
      exp: nowSeconds + 60 * 9, // GitHub rejects anything over 10 minutes
      iss: env.GITHUB_APP_ID,
    },
    env.GITHUB_APP_PRIVATE_KEY,
    { algorithm: "RS256" }
  );
}

export function buildGithubAppInstallUrl(state: string): string {
  const url = new URL(`https://github.com/apps/${env.GITHUB_APP_SLUG}/installations/new`);
  url.searchParams.set("state", state);
  return url.toString();
}

/**
 * Exchanges the App-level JWT for a short-lived (1hr) token scoped to one
 * specific installation — the credential actually used to call the REST
 * API on that installation's behalf. Exported (not just used internally)
 * because Slice 4's PR fetch service needs the exact same installation
 * credential — GitHub App auth is deliberately centralized here rather
 * than reimplemented per caller.
 */
export async function createInstallationAccessToken(installationId: string): Promise<string> {
  const response = await fetch(`${GITHUB_API_BASE}/app/installations/${installationId}/access_tokens`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${buildAppJwt()}`,
      Accept: "application/vnd.github+json",
      "User-Agent": GITHUB_USER_AGENT,
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to create installation access token: ${response.status}`);
  }

  const data = (await response.json()) as GithubInstallationTokenResponse;
  return data.token;
}

/**
 * The repos this installation was actually granted access to. This is the
 * source of truth for "what did the user connect" — never trust a
 * client-supplied repo list, since the only thing that can't be spoofed is
 * what GitHub itself says the installation can see.
 */
export async function fetchInstallationRepositories(installationId: string): Promise<GithubInstallationRepo[]> {
  const token = await createInstallationAccessToken(installationId);
  const repos: GithubInstallationRepo[] = [];
  let page = 1;

  // Installations are usually small, but don't silently truncate a larger
  // org's repo list at GitHub's 100-per-page default.
  for (;;) {
    const response = await fetch(`${GITHUB_API_BASE}/installation/repositories?per_page=100&page=${page}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "User-Agent": GITHUB_USER_AGENT,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to list installation repositories: ${response.status}`);
    }

    const data = (await response.json()) as GithubInstallationRepositoriesResponse;
    repos.push(...data.repositories);

    if (data.repositories.length < 100) break;
    page += 1;
  }

  return repos;
}
