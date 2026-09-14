import jwt from "jsonwebtoken";
import { env } from "../env.js";

export class GithubAppError extends Error {}

// GitHub caps App JWTs at 10 minutes; back the issued-at off by 60s to
// tolerate clock drift between this process and GitHub's.
const JWT_EXPIRY_SECONDS = 9 * 60;

function buildAppJwt(): string {
  const now = Math.floor(Date.now() / 1000);
  const privateKey = env.GITHUB_APP_PRIVATE_KEY.replace(/\\n/g, "\n");

  return jwt.sign(
    {
      iat: now - 60,
      exp: now + JWT_EXPIRY_SECONDS,
      iss: env.GITHUB_APP_ID,
    },
    privateKey,
    { algorithm: "RS256" },
  );
}

export async function fetchInstallationAccessToken(installationId: string): Promise<string> {
  const res = await fetch(
    `https://api.github.com/app/installations/${installationId}/access_tokens`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${buildAppJwt()}`,
        Accept: "application/vnd.github+json",
        "User-Agent": "devpulse",
      },
    },
  );

  if (!res.ok) {
    throw new GithubAppError(`Failed to create installation access token (status ${res.status})`);
  }

  const body = (await res.json()) as { token?: string };
  if (!body.token) {
    throw new GithubAppError("Installation access token response had no token");
  }

  return body.token;
}

export interface GithubInstallationRepo {
  githubRepoId: string;
  owner: string;
  name: string;
  fullName: string;
  private: boolean;
}

interface GithubApiRepo {
  id: number;
  name: string;
  full_name: string;
  private: boolean;
  owner: { login: string };
}

/** Never trusts a client-supplied repo list — always asks GitHub which
 * repos this specific installation actually has access to. */
export async function fetchInstallationRepositories(
  installationAccessToken: string,
): Promise<GithubInstallationRepo[]> {
  const repos: GithubInstallationRepo[] = [];
  let page = 1;

  for (;;) {
    const res = await fetch(
      `https://api.github.com/installation/repositories?per_page=100&page=${page}`,
      {
        headers: {
          Authorization: `Bearer ${installationAccessToken}`,
          Accept: "application/vnd.github+json",
          "User-Agent": "devpulse",
        },
      },
    );

    if (!res.ok) {
      throw new GithubAppError(`Failed to fetch installation repositories (status ${res.status})`);
    }

    const body = (await res.json()) as { repositories: GithubApiRepo[] };

    for (const repo of body.repositories) {
      repos.push({
        githubRepoId: String(repo.id),
        owner: repo.owner.login,
        name: repo.name,
        fullName: repo.full_name,
        private: repo.private,
      });
    }

    if (body.repositories.length < 100) break;
    page += 1;
  }

  return repos;
}
