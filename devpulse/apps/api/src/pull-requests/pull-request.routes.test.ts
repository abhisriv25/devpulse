import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import { buildApp } from "../app.js";

vi.mock("../github/repository.service.js", () => ({
  resolvePrimaryOrganizationId: vi.fn(),
}));

// buildApp() unconditionally wires up authRouter, which imports db/client.js
// directly — mocking it here (same trick as webhook.routes.test.ts) avoids
// the real PrismaClient() construction that fails without `prisma generate`
// having run, without which none of these tests could execute at all in
// this environment.
vi.mock("../db/client.js", () => ({ prisma: {} }));

vi.mock("./pull-request.repository.js", () => ({
  findPullRequestWithRepository: vi.fn(),
  listPullRequestsForOrganization: vi.fn(),
}));

vi.mock("../risk/risk-assessment.repository.js", () => ({
  listRiskAssessmentsForPullRequest: vi.fn(),
}));

vi.mock("../risk/risk-assessment.service.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../risk/risk-assessment.service.js")>();
  return {
    ...actual,
    assessPullRequest: vi.fn(),
  };
});

vi.mock("../rag/pr-intelligence.service.js", () => ({
  RepositoryNotFoundError: class RepositoryNotFoundError extends Error {},
  PullRequestNotFoundError: class PullRequestNotFoundError extends Error {},
  getOrCreatePrIntelligence: vi.fn(),
}));

// Same login-via-real-OAuth-flow pattern used in github.routes.test.ts.
vi.mock("../auth/auth.service.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../auth/auth.service.js")>();
  return {
    ...actual,
    exchangeCodeForToken: vi.fn().mockResolvedValue("fake-token"),
    fetchGithubProfile: vi.fn().mockResolvedValue({
      id: 999,
      login: "octocat",
      name: "The Octocat",
      avatar_url: "https://example.com/a.png",
    }),
    upsertUserFromGithubProfile: vi.fn().mockResolvedValue({ id: "user_123" }),
  };
});

import { resolvePrimaryOrganizationId } from "../github/repository.service.js";
import {
  getOrCreatePrIntelligence,
  RepositoryNotFoundError as IntelligenceRepositoryNotFoundError,
} from "../rag/pr-intelligence.service.js";
import { listRiskAssessmentsForPullRequest } from "../risk/risk-assessment.repository.js";
import { RepositoryNotFoundError, assessPullRequest } from "../risk/risk-assessment.service.js";
import { findPullRequestWithRepository, listPullRequestsForOrganization } from "./pull-request.repository.js";

const mockedResolveOrg = vi.mocked(resolvePrimaryOrganizationId);
const mockedFindPr = vi.mocked(findPullRequestWithRepository);
const mockedListPrs = vi.mocked(listPullRequestsForOrganization);
const mockedListRisk = vi.mocked(listRiskAssessmentsForPullRequest);
const mockedAssess = vi.mocked(assessPullRequest);
const mockedGetIntelligence = vi.mocked(getOrCreatePrIntelligence);

async function loginAgent(agent: ReturnType<typeof request.agent>) {
  const loginRes = await agent.get("/auth/github/login");
  const state = new URL(loginRes.headers.location).searchParams.get("state");
  await agent.get(`/auth/github/callback?code=abc&state=${state}`);
}

const PR_IN_MY_ORG = {
  id: "pr_1",
  repositoryId: "repo_1",
  number: 42,
  title: "Add caching",
  body: "desc",
  state: "open",
  author: "octocat",
  baseBranch: "main",
  headBranch: "feature/cache",
  baseSha: "base-sha",
  headSha: "head-sha",
  url: "https://github.com/acme/widgets/pull/42",
  createdAt: new Date(),
  updatedAt: new Date(),
  closedAt: null,
  mergedAt: null,
  additions: 20,
  deletions: 5,
  changedFilesCount: 2,
  repository: { id: "repo_1", organizationId: "org_mine", owner: "acme", name: "widgets", fullName: "acme/widgets" },
};

const PR_IN_OTHER_ORG = {
  ...PR_IN_MY_ORG,
  id: "pr_2",
  repository: { ...PR_IN_MY_ORG.repository, organizationId: "org_theirs" },
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /pull-requests", () => {
  it("requires authentication", async () => {
    const app = buildApp();
    const res = await request(app).get("/pull-requests");
    expect(res.status).toBe(401);
  });

  it("scopes to the caller's organization, resolved server-side", async () => {
    const app = buildApp();
    const agent = request.agent(app);
    await loginAgent(agent);
    mockedResolveOrg.mockResolvedValue("org_mine");
    mockedListPrs.mockResolvedValue([{ ...PR_IN_MY_ORG, latestRisk: null }] as never);

    const res = await agent.get("/pull-requests?repositoryId=someone-elses-filter-attempt");

    expect(res.status).toBe(200);
    expect(res.body.pullRequests).toHaveLength(1);
    expect(mockedListPrs).toHaveBeenCalledWith("org_mine", expect.objectContaining({ repositoryId: "someone-elses-filter-attempt" }));
  });

  it("returns an empty list when the user has no organization", async () => {
    const app = buildApp();
    const agent = request.agent(app);
    await loginAgent(agent);
    mockedResolveOrg.mockResolvedValue(null);

    const res = await agent.get("/pull-requests");
    expect(res.body.pullRequests).toEqual([]);
    expect(mockedListPrs).not.toHaveBeenCalled();
  });

  it("filters by risk level in the response", async () => {
    const app = buildApp();
    const agent = request.agent(app);
    await loginAgent(agent);
    mockedResolveOrg.mockResolvedValue("org_mine");
    mockedListPrs.mockResolvedValue([
      { ...PR_IN_MY_ORG, id: "pr_low", latestRisk: { score: 10, level: "LOW", createdAt: new Date() } },
      { ...PR_IN_MY_ORG, id: "pr_high", latestRisk: { score: 80, level: "CRITICAL", createdAt: new Date() } },
    ] as never);

    const res = await agent.get("/pull-requests?risk=CRITICAL");

    expect(res.body.pullRequests).toHaveLength(1);
    expect(res.body.pullRequests[0].id).toBe("pr_high");
  });
});

describe("GET /pull-requests/:id", () => {
  it("requires authentication", async () => {
    const app = buildApp();
    const res = await request(app).get("/pull-requests/pr_1");
    expect(res.status).toBe(401);
  });

  it("returns 404 for a PR that doesn't exist", async () => {
    const app = buildApp();
    const agent = request.agent(app);
    await loginAgent(agent);
    mockedResolveOrg.mockResolvedValue("org_mine");
    mockedFindPr.mockResolvedValue(null);

    const res = await agent.get("/pull-requests/nonexistent");
    expect(res.status).toBe(404);
  });

  it("returns 404 (not 403) for a PR belonging to a different organization — the core multi-tenancy test", async () => {
    const app = buildApp();
    const agent = request.agent(app);
    await loginAgent(agent);
    mockedResolveOrg.mockResolvedValue("org_mine");
    mockedFindPr.mockResolvedValue(PR_IN_OTHER_ORG as never);

    const res = await agent.get("/pull-requests/pr_2");
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("NOT_FOUND");
  });

  it("returns the PR when it belongs to the caller's organization", async () => {
    const app = buildApp();
    const agent = request.agent(app);
    await loginAgent(agent);
    mockedResolveOrg.mockResolvedValue("org_mine");
    mockedFindPr.mockResolvedValue(PR_IN_MY_ORG as never);

    const res = await agent.get("/pull-requests/pr_1");
    expect(res.status).toBe(200);
    expect(res.body.id).toBe("pr_1");
    expect(res.body.repository.fullName).toBe("acme/widgets");
  });
});

describe("GET /pull-requests/:id/risk", () => {
  it("requires authentication", async () => {
    const app = buildApp();
    const res = await request(app).get("/pull-requests/pr_1/risk");
    expect(res.status).toBe(401);
  });

  it("returns 404 for a PR in a different organization, and never computes anything", async () => {
    const app = buildApp();
    const agent = request.agent(app);
    await loginAgent(agent);
    mockedResolveOrg.mockResolvedValue("org_mine");
    mockedFindPr.mockResolvedValue(PR_IN_OTHER_ORG as never);

    const res = await agent.get("/pull-requests/pr_2/risk");
    expect(res.status).toBe(404);
    expect(mockedListRisk).not.toHaveBeenCalled();
    expect(mockedAssess).not.toHaveBeenCalled();
  });

  it("returns the existing latest assessment without recomputing", async () => {
    const app = buildApp();
    const agent = request.agent(app);
    await loginAgent(agent);
    mockedResolveOrg.mockResolvedValue("org_mine");
    mockedFindPr.mockResolvedValue(PR_IN_MY_ORG as never);
    mockedListRisk.mockResolvedValue([{ id: "assessment_1", score: 42, level: "MEDIUM" }] as never);

    const res = await agent.get("/pull-requests/pr_1/risk");

    expect(res.status).toBe(200);
    expect(res.body.id).toBe("assessment_1");
    expect(mockedAssess).not.toHaveBeenCalled();
  });

  it("computes a fresh assessment on demand when none exists yet", async () => {
    const app = buildApp();
    const agent = request.agent(app);
    await loginAgent(agent);
    mockedResolveOrg.mockResolvedValue("org_mine");
    mockedFindPr.mockResolvedValue(PR_IN_MY_ORG as never);
    mockedListRisk.mockResolvedValue([]);
    mockedAssess.mockResolvedValue({ id: "assessment_new", score: 10, level: "LOW" } as never);

    const res = await agent.get("/pull-requests/pr_1/risk");

    expect(res.status).toBe(200);
    expect(res.body.id).toBe("assessment_new");
    expect(mockedAssess).toHaveBeenCalledWith("pr_1");
  });

  it("returns 502 when on-demand assessment fails unexpectedly", async () => {
    const app = buildApp();
    const agent = request.agent(app);
    await loginAgent(agent);
    mockedResolveOrg.mockResolvedValue("org_mine");
    mockedFindPr.mockResolvedValue(PR_IN_MY_ORG as never);
    mockedListRisk.mockResolvedValue([]);
    mockedAssess.mockRejectedValue(new Error("GitHub API 503"));

    const res = await agent.get("/pull-requests/pr_1/risk");

    expect(res.status).toBe(502);
    expect(res.body.error.code).toBe("RISK_ASSESSMENT_FAILED");
  });

  it("returns 404 when the assessment fails because the repository is gone", async () => {
    const app = buildApp();
    const agent = request.agent(app);
    await loginAgent(agent);
    mockedResolveOrg.mockResolvedValue("org_mine");
    mockedFindPr.mockResolvedValue(PR_IN_MY_ORG as never);
    mockedListRisk.mockResolvedValue([]);
    mockedAssess.mockRejectedValue(new RepositoryNotFoundError("gone"));

    const res = await agent.get("/pull-requests/pr_1/risk");
    expect(res.status).toBe(404);
  });
});

describe("GET /pull-requests/:id/intelligence", () => {
  it("requires authentication", async () => {
    const app = buildApp();
    const res = await request(app).get("/pull-requests/pr_1/intelligence");
    expect(res.status).toBe(401);
  });

  it("returns 404 for a PR in a different organization, and never calls the intelligence layer", async () => {
    const app = buildApp();
    const agent = request.agent(app);
    await loginAgent(agent);
    mockedResolveOrg.mockResolvedValue("org_mine");
    mockedFindPr.mockResolvedValue(PR_IN_OTHER_ORG as never);

    const res = await agent.get("/pull-requests/pr_2/intelligence");
    expect(res.status).toBe(404);
    expect(mockedGetIntelligence).not.toHaveBeenCalled();
  });

  it("returns the unified analyzed result", async () => {
    const app = buildApp();
    const agent = request.agent(app);
    await loginAgent(agent);
    mockedResolveOrg.mockResolvedValue("org_mine");
    mockedFindPr.mockResolvedValue(PR_IN_MY_ORG as never);
    mockedGetIntelligence.mockResolvedValue({
      status: "analyzed",
      intelligence: { id: "pra_1", summary: "Notable caching risk." },
    } as never);

    const res = await agent.get("/pull-requests/pr_1/intelligence");

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      status: "analyzed",
      intelligence: { id: "pra_1", summary: "Notable caching risk." },
    });
  });

  it("returns a skipped_low_risk result as 200, not an error", async () => {
    const app = buildApp();
    const agent = request.agent(app);
    await loginAgent(agent);
    mockedResolveOrg.mockResolvedValue("org_mine");
    mockedFindPr.mockResolvedValue(PR_IN_MY_ORG as never);
    mockedGetIntelligence.mockResolvedValue({ status: "skipped_low_risk", score: 10, level: "LOW" } as never);

    const res = await agent.get("/pull-requests/pr_1/intelligence");

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: "skipped_low_risk", score: 10, level: "LOW" });
  });

  it("returns 502 when intelligence generation fails unexpectedly", async () => {
    const app = buildApp();
    const agent = request.agent(app);
    await loginAgent(agent);
    mockedResolveOrg.mockResolvedValue("org_mine");
    mockedFindPr.mockResolvedValue(PR_IN_MY_ORG as never);
    mockedGetIntelligence.mockRejectedValue(new Error("LLM API 503"));

    const res = await agent.get("/pull-requests/pr_1/intelligence");

    expect(res.status).toBe(502);
    expect(res.body.error.code).toBe("INTELLIGENCE_FAILED");
  });

  it("returns 404 when the underlying repository has gone missing", async () => {
    const app = buildApp();
    const agent = request.agent(app);
    await loginAgent(agent);
    mockedResolveOrg.mockResolvedValue("org_mine");
    mockedFindPr.mockResolvedValue(PR_IN_MY_ORG as never);
    mockedGetIntelligence.mockRejectedValue(new IntelligenceRepositoryNotFoundError("gone"));

    const res = await agent.get("/pull-requests/pr_1/intelligence");
    expect(res.status).toBe(404);
  });
});
