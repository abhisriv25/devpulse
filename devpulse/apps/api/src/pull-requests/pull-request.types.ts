/** Explicit return shape (rather than relying on Prisma's inferred payload
 * type) so callers type-check correctly even before `prisma generate` has
 * run — same reasoning as RepositoryRecord / WebhookEventRecord. */
export interface PullRequestRecord {
  id: string;
  repositoryId: string;
  githubPrId: string;
  number: number;
  title: string;
  body: string | null;
  state: string;
  author: string;
  baseBranch: string;
  headBranch: string;
  headSha: string;
  baseSha: string;
  url: string;
  createdAt: Date;
  updatedAt: Date;
  closedAt: Date | null;
  mergedAt: Date | null;
  additions: number;
  deletions: number;
  changedFilesCount: number;
  syncedAt: Date;
}

/** A minimal, display-oriented view of a PR's repository — just enough for
 * the list/detail UI to show "which repo" without pulling in every
 * Repository field. */
export interface PullRequestRepositorySummary {
  id: string;
  organizationId: string;
  owner: string;
  name: string;
  fullName: string;
}

/** The most recent risk assessment for a PR, or null if it's never been
 * assessed. Deliberately just the summary fields a list view needs — the
 * full `rulesTriggered` breakdown is fetched separately by the detail
 * page via GET /pull-requests/:id/risk. */
export interface LatestRiskSummary {
  score: number;
  level: string;
  createdAt: Date;
}

export interface PullRequestListItem extends PullRequestRecord {
  repository: PullRequestRepositorySummary;
  latestRisk: LatestRiskSummary | null;
}

export interface PullRequestWithRepository extends PullRequestRecord {
  repository: PullRequestRepositorySummary;
}

export interface PullRequestListFilters {
  repositoryId?: string;
  state?: string;
  author?: string;
}
