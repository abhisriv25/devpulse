import { prisma } from "../db/client.js";
import type { GithubPullRequestApiResponse } from "../github/pull-request.types.js";
import type {
  PullRequestListFilters,
  PullRequestListItem,
  PullRequestRecord,
  PullRequestWithRepository,
} from "./pull-request.types.js";

/**
 * Writes GitHub's current PR state into the DB. Always an upsert, never a
 * plain create — `opened` makes a new row, but `synchronize`/`reopened`/
 * `closed` all need to update the *same* row, and a webhook can also be
 * processed more than once (retry, or the poller picking up an event
 * that's already RECEIVED again before its status flips) without ever
 * producing a duplicate PullRequest. The (repositoryId, githubPrId) unique
 * constraint is what makes that safe under races, same reasoning as
 * WebhookEvent.deliveryId in Slice 3.
 */
export function upsertPullRequestFromGithub(
  repositoryId: string,
  githubPr: GithubPullRequestApiResponse
): Promise<PullRequestRecord> {
  const data = {
    title: githubPr.title,
    body: githubPr.body,
    state: githubPr.state,
    author: githubPr.user?.login ?? "unknown",
    baseBranch: githubPr.base.ref,
    headBranch: githubPr.head.ref,
    headSha: githubPr.head.sha,
    baseSha: githubPr.base.sha,
    url: githubPr.html_url,
    createdAt: new Date(githubPr.created_at),
    updatedAt: new Date(githubPr.updated_at),
    closedAt: githubPr.closed_at ? new Date(githubPr.closed_at) : null,
    mergedAt: githubPr.merged_at ? new Date(githubPr.merged_at) : null,
    additions: githubPr.additions,
    deletions: githubPr.deletions,
    changedFilesCount: githubPr.changed_files,
  };

  return prisma.pullRequest.upsert({
    where: {
      repositoryId_githubPrId: {
        repositoryId,
        githubPrId: String(githubPr.id),
      },
    },
    update: data,
    create: {
      repositoryId,
      githubPrId: String(githubPr.id),
      number: githubPr.number,
      ...data,
    },
  });
}

/** Used by the Slice 5 risk-assessment orchestrator to load the PR being
 * scored — kept in this module rather than duplicated, since PullRequest
 * data access belongs with the rest of the PullRequest read/write logic. */
export function findPullRequestById(id: string): Promise<PullRequestRecord | null> {
  return prisma.pullRequest.findUnique({ where: { id } });
}

/**
 * Loads a PR together with its Repository — specifically so callers can
 * check `repository.organizationId` against the caller's own organization
 * before returning anything. This is the join the Slice 6 routes' entire
 * authorization story rests on: every PR lookup goes through this (or
 * `listPullRequestsForOrganization`, which filters by org directly), never
 * a bare `findUnique` by id alone.
 */
export function findPullRequestWithRepository(id: string): Promise<PullRequestWithRepository | null> {
  return prisma.pullRequest.findUnique({
    where: { id },
    include: { repository: true },
  }) as unknown as Promise<PullRequestWithRepository | null>;
}

/**
 * The PR list view's data source — scoped to the caller's organization via
 * the `repository.organizationId` relation filter, not fetched broadly and
 * filtered after the fact. Each PR carries its most recent risk assessment
 * (if any) via a `take: 1` relation query, not a separate round trip per PR.
 *
 * Known limitation: an optional `risk` level filter isn't pushed into this
 * query — filtering "latest assessment has level X" cleanly in a single
 * Prisma relation filter would match "any assessment ever had level X",
 * not specifically the latest one, so that filter (if added) belongs in
 * the route layer over this function's results. Not implemented yet
 * because nothing calls for it yet — see README.
 */
export async function listPullRequestsForOrganization(
  organizationId: string,
  filters: PullRequestListFilters = {}
): Promise<PullRequestListItem[]> {
  const rows = (await prisma.pullRequest.findMany({
    where: {
      repository: {
        organizationId,
        ...(filters.repositoryId ? { id: filters.repositoryId } : {}),
      },
      ...(filters.state ? { state: filters.state } : {}),
      ...(filters.author ? { author: filters.author } : {}),
    },
    include: {
      repository: true,
      riskAssessments: { orderBy: { createdAt: "desc" }, take: 1 },
    },
    orderBy: { updatedAt: "desc" },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  })) as any[];

  return rows.map((row) => ({
    ...row,
    latestRisk: row.riskAssessments[0]
      ? { score: row.riskAssessments[0].score, level: row.riskAssessments[0].level, createdAt: row.riskAssessments[0].createdAt }
      : null,
  }));
}
