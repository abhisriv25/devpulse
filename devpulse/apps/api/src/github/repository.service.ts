import { prisma } from "../db/client.js";
import type { GithubInstallationRepo } from "./github-app.types.js";

/**
 * Resolves "the" organization for a user. Slice 2 has no org switcher yet —
 * every user's first (Slice-1-bootstrapped) organization is their only
 * one — so "first membership by creation order" is equivalent to "their
 * org" for now. This is a placeholder for real org selection (added when
 * multi-org membership becomes a real scenario), not a permanent shortcut,
 * and it's the single place that logic lives so it's one line to change
 * later instead of several call sites.
 */
export async function resolvePrimaryOrganizationId(userId: string): Promise<string | null> {
  const membership = await prisma.membership.findFirst({
    where: { userId },
    orderBy: { createdAt: "asc" },
  });
  return membership?.organizationId ?? null;
}

/**
 * Upserts repos returned by a GitHub App installation into the caller's
 * organization. `organizationId` must come from server-side session state
 * (see github.routes.ts), never from the request body/query — that's what
 * keeps one org from ever writing into another org's repository list.
 */
export async function upsertRepositoriesFromInstallation(
  organizationId: string,
  installationId: string,
  repos: GithubInstallationRepo[]
) {
  await prisma.$transaction(
    repos.map((repo) =>
      prisma.repository.upsert({
        where: {
          organizationId_githubRepoId: {
            organizationId,
            githubRepoId: String(repo.id),
          },
        },
        update: {
          githubInstallationId: installationId,
          owner: repo.owner.login,
          name: repo.name,
          fullName: repo.full_name,
          private: repo.private,
        },
        create: {
          organizationId,
          githubInstallationId: installationId,
          githubRepoId: String(repo.id),
          owner: repo.owner.login,
          name: repo.name,
          fullName: repo.full_name,
          private: repo.private,
        },
      })
    )
  );
}

/** Explicit return shape (rather than relying on Prisma's inferred payload
 * type) so callers type-check correctly even before `prisma generate` has
 * run — e.g. in CI steps that lint before installing a database. */
export interface RepositoryRecord {
  id: string;
  organizationId: string;
  githubInstallationId: string;
  githubRepoId: string;
  owner: string;
  name: string;
  fullName: string;
  private: boolean;
  connectedAt: Date;
  updatedAt: Date;
}

export function listRepositoriesForOrganization(organizationId: string): Promise<RepositoryRecord[]> {
  return prisma.repository.findMany({
    where: { organizationId },
    orderBy: { connectedAt: "desc" },
  });
}

/**
 * Resolves a webhook delivery's (githubRepoId, githubInstallationId) back
 * to a connected Repository — used by the Slice 4 processor to know
 * whether an incoming event is for a repo DevPulse actually tracks, and to
 * get the owner/name needed to call GitHub's API (never trusting a repo
 * name out of the webhook payload itself).
 *
 * Known limitation: this returns the *first* match. If the same GitHub
 * repo were ever connected by two different organizations independently
 * (a legitimate but rare case — see Repository's own unique constraint,
 * which is scoped per-org for exactly this reason), only one org's PR data
 * gets synced from a given event today. Not handled because nothing in
 * this codebase creates that scenario yet; worth revisiting if/when it can
 * actually happen.
 */
export function findRepositoryByGithubIds(
  githubRepoId: string,
  githubInstallationId: string
): Promise<RepositoryRecord | null> {
  return prisma.repository.findFirst({
    where: { githubRepoId, githubInstallationId },
  });
}

/** Used by the Slice 5 risk-assessment orchestrator to resolve a PR's
 * owner/name/installation for calling GitHub's API. */
export function findRepositoryById(id: string): Promise<RepositoryRecord | null> {
  return prisma.repository.findUnique({ where: { id } });
}
