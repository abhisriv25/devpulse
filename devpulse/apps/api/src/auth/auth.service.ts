import { randomBytes } from "node:crypto";
import { prisma } from "../db/client.js";
import { env } from "../config/env.js";
import type { GithubOAuthTokenResponse, GithubUserProfile } from "./auth.types.js";

const GITHUB_AUTHORIZE_URL = "https://github.com/login/oauth/authorize";
const GITHUB_TOKEN_URL = "https://github.com/login/oauth/access_token";
const GITHUB_USER_API_URL = "https://api.github.com/user";

/** CSRF protection for the OAuth redirect: generated pre-redirect, stored in
 * the session, and compared against what GitHub sends back on callback. */
export function generateOAuthState(): string {
  return randomBytes(16).toString("hex");
}

export function buildGithubAuthorizeUrl(state: string): string {
  const url = new URL(GITHUB_AUTHORIZE_URL);
  url.searchParams.set("client_id", env.GITHUB_OAUTH_CLIENT_ID);
  url.searchParams.set("redirect_uri", `${env.API_BASE_URL}/auth/github/callback`);
  // read:user is enough for Slice 1 (identity only). Repo scopes are added
  // when the GitHub App / installation flow is built in Slice 2 — not here.
  url.searchParams.set("scope", "read:user");
  url.searchParams.set("state", state);
  return url.toString();
}

export async function exchangeCodeForToken(code: string): Promise<string> {
  const response = await fetch(GITHUB_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      client_id: env.GITHUB_OAUTH_CLIENT_ID,
      client_secret: env.GITHUB_OAUTH_CLIENT_SECRET,
      code,
      redirect_uri: `${env.API_BASE_URL}/auth/github/callback`,
    }),
  });

  if (!response.ok) {
    throw new Error(`GitHub token exchange failed: ${response.status}`);
  }

  const data = (await response.json()) as GithubOAuthTokenResponse & { error?: string };
  if (data.error || !data.access_token) {
    throw new Error(`GitHub token exchange returned an error: ${data.error ?? "no access_token"}`);
  }

  return data.access_token;
}

export async function fetchGithubProfile(accessToken: string): Promise<GithubUserProfile> {
  const response = await fetch(GITHUB_USER_API_URL, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/vnd.github+json",
      "User-Agent": "devpulse-app",
    },
  });

  if (!response.ok) {
    throw new Error(`GitHub user fetch failed: ${response.status}`);
  }

  return (await response.json()) as GithubUserProfile;
}

/**
 * Upsert the local User row from a GitHub profile, and — if this is the
 * user's very first login — bootstrap a personal Organization with an
 * ADMIN membership so every later feature (which is always org-scoped)
 * has something real to attach to from day one.
 */
export async function upsertUserFromGithubProfile(profile: GithubUserProfile) {
  const githubId = String(profile.id);

  const user = await prisma.user.upsert({
    where: { githubId },
    update: {
      githubLogin: profile.login,
      displayName: profile.name,
      avatarUrl: profile.avatar_url,
    },
    create: {
      githubId,
      githubLogin: profile.login,
      displayName: profile.name,
      avatarUrl: profile.avatar_url,
    },
    include: { memberships: true },
  });

  if (user.memberships.length === 0) {
    const baseSlug = `${profile.login}-org`.toLowerCase();
    // Slug collisions are rare (would require two different GitHub accounts
    // whose logins normalize to the same slug) but not impossible — retry
    // once with a short random suffix rather than 500ing a first login.
    try {
      await prisma.organization.create({
        data: {
          name: `${profile.login}'s Organization`,
          slug: baseSlug,
          memberships: { create: { userId: user.id, role: "ADMIN" } },
        },
      });
    } catch {
      const suffix = randomBytes(3).toString("hex");
      await prisma.organization.create({
        data: {
          name: `${profile.login}'s Organization`,
          slug: `${baseSlug}-${suffix}`,
          memberships: { create: { userId: user.id, role: "ADMIN" } },
        },
      });
    }
  }

  return user;
}
