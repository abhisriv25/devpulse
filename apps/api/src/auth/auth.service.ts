import { randomBytes } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "../prisma.js";
import type { GithubOAuthProfile } from "./github-oauth.service.js";

/**
 * Upserts the User row for this GitHub identity, and — on a user's very
 * first login only — bootstraps a personal Organization + ADMIN Membership,
 * since every later feature (repos, PRs, knowledge sources) is org-scoped.
 */
export async function findOrCreateUserForGithubProfile(profile: GithubOAuthProfile) {
  const user = await prisma.user.upsert({
    where: { githubId: profile.githubId },
    update: {
      githubLogin: profile.githubLogin,
      displayName: profile.displayName,
      avatarUrl: profile.avatarUrl,
    },
    create: {
      githubId: profile.githubId,
      githubLogin: profile.githubLogin,
      displayName: profile.displayName,
      avatarUrl: profile.avatarUrl,
    },
    include: { memberships: true },
  });

  if (user.memberships.length > 0) {
    return user;
  }

  const membership = await createPersonalOrganization(user.id, profile.githubLogin);
  return { ...user, memberships: [membership] };
}

async function createPersonalOrganization(userId: string, githubLogin: string) {
  const baseSlug = githubLogin.toLowerCase();

  for (const slug of [baseSlug, `${baseSlug}-${randomBytes(3).toString("hex")}`]) {
    try {
      const organization = await prisma.organization.create({
        data: { name: `${githubLogin}'s Organization`, slug },
      });
      return await prisma.membership.create({
        data: { userId, organizationId: organization.id, role: "ADMIN" },
      });
    } catch (err) {
      const isSlugCollision =
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === "P2002" &&
        (err.meta?.target as string[] | undefined)?.includes("slug");
      if (!isSlugCollision) throw err;
    }
  }

  throw new Error(`Could not allocate a unique organization slug for ${githubLogin}`);
}

/**
 * "The" organization a user belongs to. Every user is bootstrapped with
 * exactly one org on first login (see above), so "their first membership"
 * is correct today — this is a placeholder for real org selection once
 * multi-org membership becomes a real scenario.
 */
export async function resolvePrimaryOrganizationId(userId: string): Promise<string | null> {
  const membership = await prisma.membership.findFirst({
    where: { userId },
    orderBy: { createdAt: "asc" },
  });

  return membership?.organizationId ?? null;
}
