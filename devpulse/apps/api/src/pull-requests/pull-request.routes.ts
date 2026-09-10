import { Router } from "express";
import { resolvePrimaryOrganizationId } from "../github/repository.service.js";
import { requireAuth } from "../middleware/require-auth.js";
import {
  getOrCreatePrIntelligence,
  RepositoryNotFoundError as IntelligenceRepositoryNotFoundError,
} from "../rag/pr-intelligence.service.js";
import { RepositoryNotFoundError, assessPullRequest } from "../risk/risk-assessment.service.js";
import { listRiskAssessmentsForPullRequest } from "../risk/risk-assessment.repository.js";
import {
  findPullRequestWithRepository,
  listPullRequestsForOrganization,
} from "./pull-request.repository.js";

export const pullRequestRouter = Router();

/**
 * Every route here follows the same shape: resolve the caller's own
 * organization from their session, then scope (or check) against it —
 * never trust a client-supplied organization/repository id for anything
 * beyond an optional *filter*. This is the multi-tenancy boundary Slice 6
 * exists to get right: an authenticated user from Org A must never be able
 * to read Org B's PR data by guessing or enumerating ids.
 */

/**
 * GET /pull-requests?repositoryId=&state=&author=&risk=
 *
 * Scoped to the caller's organization via the repository relation, not a
 * client-supplied organizationId. `risk` (a RiskLevel) is filtered
 * in-memory after the fact — see the doc comment on
 * listPullRequestsForOrganization for why that one isn't pushed into the
 * DB query yet.
 */
pullRequestRouter.get("/pull-requests", requireAuth, async (req, res) => {
  const organizationId = await resolvePrimaryOrganizationId(req.session.userId!);
  if (!organizationId) {
    return res.json({ pullRequests: [] });
  }

  const { repositoryId, state, author, risk } = req.query;

  const items = await listPullRequestsForOrganization(organizationId, {
    repositoryId: typeof repositoryId === "string" ? repositoryId : undefined,
    state: typeof state === "string" ? state : undefined,
    author: typeof author === "string" ? author : undefined,
  });

  const filtered = typeof risk === "string" ? items.filter((item) => item.latestRisk?.level === risk) : items;

  res.json({
    pullRequests: filtered.map((item) => ({
      id: item.id,
      number: item.number,
      title: item.title,
      author: item.author,
      state: item.state,
      url: item.url,
      updatedAt: item.updatedAt,
      closedAt: item.closedAt,
      mergedAt: item.mergedAt,
      additions: item.additions,
      deletions: item.deletions,
      changedFilesCount: item.changedFilesCount,
      repository: {
        id: item.repository.id,
        owner: item.repository.owner,
        name: item.repository.name,
        fullName: item.repository.fullName,
      },
      latestRisk: item.latestRisk,
    })),
  });
});

/**
 * GET /pull-requests/:id
 *
 * Returns 404 — not 403 — for a PR that exists but belongs to a different
 * organization, same as for a PR that doesn't exist at all. Distinguishing
 * the two would tell an attacker "that id is real, you're just not
 * allowed to see it," which is exactly the kind of cross-tenant leak this
 * route exists to prevent even in its error responses.
 */
pullRequestRouter.get("/pull-requests/:id", requireAuth, async (req, res) => {
  const organizationId = await resolvePrimaryOrganizationId(req.session.userId!);
  const pullRequest = await findPullRequestWithRepository(req.params.id);

  if (!organizationId || !pullRequest || pullRequest.repository.organizationId !== organizationId) {
    return res.status(404).json({ error: { code: "NOT_FOUND", message: "Pull request not found" } });
  }

  res.json({
    id: pullRequest.id,
    number: pullRequest.number,
    title: pullRequest.title,
    body: pullRequest.body,
    state: pullRequest.state,
    author: pullRequest.author,
    baseBranch: pullRequest.baseBranch,
    headBranch: pullRequest.headBranch,
    baseSha: pullRequest.baseSha,
    headSha: pullRequest.headSha,
    url: pullRequest.url,
    createdAt: pullRequest.createdAt,
    updatedAt: pullRequest.updatedAt,
    closedAt: pullRequest.closedAt,
    mergedAt: pullRequest.mergedAt,
    additions: pullRequest.additions,
    deletions: pullRequest.deletions,
    changedFilesCount: pullRequest.changedFilesCount,
    repository: {
      id: pullRequest.repository.id,
      owner: pullRequest.repository.owner,
      name: pullRequest.repository.name,
      fullName: pullRequest.repository.fullName,
    },
  });
});

/**
 * GET /pull-requests/:id/risk
 *
 * Returns the most recent RiskAssessment if one exists. If the PR has
 * never been assessed, computes one on demand — this is Slice 6 closing
 * the loose end Slice 5 deliberately left open ("assessPullRequest isn't
 * triggered by anything yet"). Still not triggered automatically from PR
 * sync; it's triggered by a human looking at the PR detail page, which is
 * a deliberate choice, not a default.
 */
pullRequestRouter.get("/pull-requests/:id/risk", requireAuth, async (req, res) => {
  const organizationId = await resolvePrimaryOrganizationId(req.session.userId!);
  const pullRequest = await findPullRequestWithRepository(req.params.id);

  if (!organizationId || !pullRequest || pullRequest.repository.organizationId !== organizationId) {
    return res.status(404).json({ error: { code: "NOT_FOUND", message: "Pull request not found" } });
  }

  const existing = await listRiskAssessmentsForPullRequest(pullRequest.id);
  if (existing.length > 0) {
    return res.json(existing[0]);
  }

  try {
    const assessment = await assessPullRequest(pullRequest.id);
    res.json(assessment);
  } catch (err) {
    if (err instanceof RepositoryNotFoundError) {
      return res.status(404).json({ error: { code: "NOT_FOUND", message: "Pull request not found" } });
    }
    req.log?.error({ err, pullRequestId: pullRequest.id }, "On-demand risk assessment failed");
    res
      .status(502)
      .json({ error: { code: "RISK_ASSESSMENT_FAILED", message: "Could not compute a risk assessment right now" } });
  }
});

/**
 * GET /pull-requests/:id/intelligence
 *
 * Slice 10's unified endpoint: the deterministic score/level plus the
 * grounded AI summary/findings/recommendations, in one response — what
 * the design doc's own PR-page mockup shows as a single view, backed by
 * `getOrCreatePrIntelligence` (reuse-if-persisted, otherwise compute via
 * Slice 9 and persist). Same org-scoping and 404-not-403 shape as every
 * other PR route.
 *
 * A LOW-risk PR has no AI analysis by design (see rag/model-selector.ts's
 * cost control) — this returns `{ status: "skipped_low_risk", score,
 * level }` rather than a 404, since "there's genuinely no AI analysis for
 * this PR" is a normal, expected response, not an error.
 */
pullRequestRouter.get("/pull-requests/:id/intelligence", requireAuth, async (req, res) => {
  const organizationId = await resolvePrimaryOrganizationId(req.session.userId!);
  const pullRequest = await findPullRequestWithRepository(req.params.id);

  if (!organizationId || !pullRequest || pullRequest.repository.organizationId !== organizationId) {
    return res.status(404).json({ error: { code: "NOT_FOUND", message: "Pull request not found" } });
  }

  try {
    const result = await getOrCreatePrIntelligence(pullRequest.id);
    res.json(result);
  } catch (err) {
    if (err instanceof IntelligenceRepositoryNotFoundError) {
      return res.status(404).json({ error: { code: "NOT_FOUND", message: "Pull request not found" } });
    }
    req.log?.error({ err, pullRequestId: pullRequest.id }, "PR intelligence generation failed");
    res
      .status(502)
      .json({ error: { code: "INTELLIGENCE_FAILED", message: "Could not generate PR intelligence right now" } });
  }
});
