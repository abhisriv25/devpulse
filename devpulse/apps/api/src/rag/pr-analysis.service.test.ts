import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../pull-requests/pull-request.repository.js", () => ({
  findPullRequestById: vi.fn(),
}));

vi.mock("../github/repository.service.js", () => ({
  findRepositoryById: vi.fn(),
}));

vi.mock("../risk/risk-assessment.repository.js", () => ({
  listRiskAssessmentsForPullRequest: vi.fn(),
}));

vi.mock("../risk/risk-assessment.service.js", () => ({
  assessPullRequest: vi.fn(),
}));

vi.mock("../retrieval/retrieval.service.js", () => ({
  retrieveRelevantContext: vi.fn(),
}));

vi.mock("./llm-client.js", () => ({
  generateChatCompletion: vi.fn(),
}));

import { findRepositoryById } from "../github/repository.service.js";
import { findPullRequestById } from "../pull-requests/pull-request.repository.js";
import { listRiskAssessmentsForPullRequest } from "../risk/risk-assessment.repository.js";
import { assessPullRequest } from "../risk/risk-assessment.service.js";
import { retrieveRelevantContext } from "../retrieval/retrieval.service.js";
import { generateChatCompletion } from "./llm-client.js";
import {
  PullRequestNotFoundError,
  RepositoryNotFoundError,
  analyzePullRequest,
} from "./pr-analysis.service.js";

const mockedFindPr = vi.mocked(findPullRequestById);
const mockedFindRepo = vi.mocked(findRepositoryById);
const mockedListRisk = vi.mocked(listRiskAssessmentsForPullRequest);
const mockedAssess = vi.mocked(assessPullRequest);
const mockedRetrieve = vi.mocked(retrieveRelevantContext);
const mockedGenerate = vi.mocked(generateChatCompletion);

const PULL_REQUEST = {
  id: "pr_1",
  repositoryId: "repo_1",
  githubPrId: "999",
  number: 42,
  title: "Add Redis caching",
  body: "Adds a cache layer.",
  state: "open",
  author: "octocat",
  baseBranch: "main",
  headBranch: "feature/cache",
  headSha: "head-sha",
  baseSha: "base-sha",
  url: "https://github.com/acme/widgets/pull/42",
  createdAt: new Date(),
  updatedAt: new Date(),
  closedAt: null,
  mergedAt: null,
  additions: 200,
  deletions: 10,
  changedFilesCount: 4,
  syncedAt: new Date(),
};

const REPOSITORY = {
  id: "repo_1",
  organizationId: "org_1",
  githubInstallationId: "inst_1",
  githubRepoId: "555",
  owner: "acme",
  name: "widgets",
  fullName: "acme/widgets",
  private: false,
  connectedAt: new Date(),
  updatedAt: new Date(),
};

function riskAssessment(overrides: Record<string, unknown> = {}) {
  return {
    id: "assessment_1",
    pullRequestId: "pr_1",
    score: 65,
    level: "HIGH",
    rulesTriggered: [
      { code: "DIFF_SIZE", triggered: true, points: 20, explanation: "Large diff", evidence: [] },
      { code: "MIGRATION_CHANGE", triggered: false, points: 0, explanation: "No migrations", evidence: [] },
    ],
    engineVersion: "v1",
    createdAt: new Date(),
    ...overrides,
  };
}

const VALID_LLM_JSON = JSON.stringify({
  summary: "Notable caching risk.",
  riskExplanation: [],
  recommendations: [],
  confidence: "MEDIUM",
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe("analyzePullRequest — not-found handling", () => {
  it("throws PullRequestNotFoundError and touches nothing else when the PR doesn't exist", async () => {
    mockedFindPr.mockResolvedValue(null);

    await expect(analyzePullRequest("pr_missing")).rejects.toThrow(PullRequestNotFoundError);

    expect(mockedFindRepo).not.toHaveBeenCalled();
    expect(mockedRetrieve).not.toHaveBeenCalled();
    expect(mockedGenerate).not.toHaveBeenCalled();
  });

  it("throws RepositoryNotFoundError when the PR's repository is missing", async () => {
    mockedFindPr.mockResolvedValue(PULL_REQUEST as never);
    mockedFindRepo.mockResolvedValue(null);

    await expect(analyzePullRequest("pr_1")).rejects.toThrow(RepositoryNotFoundError);
    expect(mockedRetrieve).not.toHaveBeenCalled();
  });
});

describe("analyzePullRequest — LOW risk cost control", () => {
  it("skips retrieval and the LLM call entirely for a LOW-risk PR", async () => {
    mockedFindPr.mockResolvedValue(PULL_REQUEST as never);
    mockedFindRepo.mockResolvedValue(REPOSITORY as never);
    mockedListRisk.mockResolvedValue([riskAssessment({ level: "LOW", score: 10 })] as never);

    const result = await analyzePullRequest("pr_1");

    expect(result).toEqual({ status: "skipped_low_risk", score: 10, level: "LOW" });
    expect(mockedRetrieve).not.toHaveBeenCalled();
    expect(mockedGenerate).not.toHaveBeenCalled();
  });
});

describe("analyzePullRequest — risk assessment reuse", () => {
  it("reuses an existing assessment rather than recomputing one", async () => {
    mockedFindPr.mockResolvedValue(PULL_REQUEST as never);
    mockedFindRepo.mockResolvedValue(REPOSITORY as never);
    mockedListRisk.mockResolvedValue([riskAssessment()] as never);
    mockedRetrieve.mockResolvedValue([]);
    mockedGenerate.mockResolvedValue(VALID_LLM_JSON);

    await analyzePullRequest("pr_1");

    expect(mockedAssess).not.toHaveBeenCalled();
  });

  it("computes a fresh assessment when the PR has never been scored", async () => {
    mockedFindPr.mockResolvedValue(PULL_REQUEST as never);
    mockedFindRepo.mockResolvedValue(REPOSITORY as never);
    mockedListRisk.mockResolvedValue([]);
    mockedAssess.mockResolvedValue(riskAssessment() as never);
    mockedRetrieve.mockResolvedValue([]);
    mockedGenerate.mockResolvedValue(VALID_LLM_JSON);

    await analyzePullRequest("pr_1");

    expect(mockedAssess).toHaveBeenCalledWith("pr_1");
  });
});

describe("analyzePullRequest — the analyzed path", () => {
  it("retrieves memory scoped to the repository's organization, using the PR title and triggered-signal explanations as the query", async () => {
    mockedFindPr.mockResolvedValue(PULL_REQUEST as never);
    mockedFindRepo.mockResolvedValue(REPOSITORY as never);
    mockedListRisk.mockResolvedValue([riskAssessment()] as never);
    mockedRetrieve.mockResolvedValue([]);
    mockedGenerate.mockResolvedValue(VALID_LLM_JSON);

    await analyzePullRequest("pr_1");

    expect(mockedRetrieve).toHaveBeenCalledWith({
      organizationId: "org_1",
      query: "Add Redis caching. Large diff",
      topK: 5,
    });
  });

  it("uses the strong model for HIGH risk and the small model for MEDIUM risk", async () => {
    mockedFindPr.mockResolvedValue(PULL_REQUEST as never);
    mockedFindRepo.mockResolvedValue(REPOSITORY as never);
    mockedRetrieve.mockResolvedValue([]);
    mockedGenerate.mockResolvedValue(VALID_LLM_JSON);

    mockedListRisk.mockResolvedValue([riskAssessment({ level: "HIGH" })] as never);
    let result = await analyzePullRequest("pr_1");
    expect(result.status).toBe("analyzed");
    if (result.status === "analyzed") expect(result.model).toBe("gpt-4o");

    mockedListRisk.mockResolvedValue([riskAssessment({ level: "MEDIUM" })] as never);
    result = await analyzePullRequest("pr_1");
    if (result.status === "analyzed") expect(result.model).toBe("gpt-4o-mini");
  });

  it("returns the parsed, schema-validated analysis on success", async () => {
    mockedFindPr.mockResolvedValue(PULL_REQUEST as never);
    mockedFindRepo.mockResolvedValue(REPOSITORY as never);
    mockedListRisk.mockResolvedValue([riskAssessment()] as never);
    mockedRetrieve.mockResolvedValue([]);
    mockedGenerate.mockResolvedValue(VALID_LLM_JSON);

    const result = await analyzePullRequest("pr_1");

    expect(result).toEqual({
      status: "analyzed",
      model: "gpt-4o",
      riskAssessmentId: "assessment_1",
      score: 65,
      level: "HIGH",
      analysis: {
        summary: "Notable caching risk.",
        riskExplanation: [],
        recommendations: [],
        confidence: "MEDIUM",
      },
    });
  });

  it("propagates a schema-validation failure rather than returning malformed data", async () => {
    mockedFindPr.mockResolvedValue(PULL_REQUEST as never);
    mockedFindRepo.mockResolvedValue(REPOSITORY as never);
    mockedListRisk.mockResolvedValue([riskAssessment()] as never);
    mockedRetrieve.mockResolvedValue([]);
    mockedGenerate.mockResolvedValue("not valid json");

    await expect(analyzePullRequest("pr_1")).rejects.toThrow();
  });
});
