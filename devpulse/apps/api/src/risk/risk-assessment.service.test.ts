import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../pull-requests/pull-request.repository.js", () => ({
  findPullRequestById: vi.fn(),
}));

vi.mock("../github/repository.service.js", () => ({
  findRepositoryById: vi.fn(),
}));

vi.mock("./risk-context.service.js", () => ({
  buildRiskInputFromGithub: vi.fn(),
}));

vi.mock("./risk-assessment.repository.js", () => ({
  createRiskAssessment: vi.fn(),
}));

import { findRepositoryById } from "../github/repository.service.js";
import { findPullRequestById } from "../pull-requests/pull-request.repository.js";
import { createRiskAssessment } from "./risk-assessment.repository.js";
import {
  PullRequestNotFoundError,
  RepositoryNotFoundError,
  assessPullRequest,
} from "./risk-assessment.service.js";
import { buildRiskInputFromGithub } from "./risk-context.service.js";
import { RISK_ENGINE_VERSION } from "./risk-rules.config.js";

const mockedFindPr = vi.mocked(findPullRequestById);
const mockedFindRepo = vi.mocked(findRepositoryById);
const mockedBuildInput = vi.mocked(buildRiskInputFromGithub);
const mockedCreate = vi.mocked(createRiskAssessment);

const PULL_REQUEST = {
  id: "pr_1",
  repositoryId: "repo_1",
  githubPrId: "999",
  number: 42,
  title: "Add caching",
  body: null,
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
  additions: 20,
  deletions: 5,
  changedFilesCount: 2,
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

beforeEach(() => {
  vi.clearAllMocks();
});

describe("assessPullRequest", () => {
  it("throws PullRequestNotFoundError and does nothing else when the PR doesn't exist", async () => {
    mockedFindPr.mockResolvedValue(null);

    await expect(assessPullRequest("pr_missing")).rejects.toThrow(PullRequestNotFoundError);

    expect(mockedFindRepo).not.toHaveBeenCalled();
    expect(mockedBuildInput).not.toHaveBeenCalled();
    expect(mockedCreate).not.toHaveBeenCalled();
  });

  it("throws RepositoryNotFoundError when the PR's repository is missing, without calling GitHub", async () => {
    mockedFindPr.mockResolvedValue(PULL_REQUEST as never);
    mockedFindRepo.mockResolvedValue(null);

    await expect(assessPullRequest("pr_1")).rejects.toThrow(RepositoryNotFoundError);

    expect(mockedBuildInput).not.toHaveBeenCalled();
    expect(mockedCreate).not.toHaveBeenCalled();
  });

  it("builds the risk input using the PR's own diff totals and the repo's installation credentials", async () => {
    mockedFindPr.mockResolvedValue(PULL_REQUEST as never);
    mockedFindRepo.mockResolvedValue(REPOSITORY as never);
    mockedBuildInput.mockResolvedValue({ additions: 20, deletions: 5, changedFilesCount: 2, changedFiles: [] });
    mockedCreate.mockResolvedValue({} as never);

    await assessPullRequest("pr_1");

    expect(mockedBuildInput).toHaveBeenCalledWith("inst_1", "acme", "widgets", 42, {
      additions: 20,
      deletions: 5,
      changedFilesCount: 2,
    });
  });

  it("computes a real score/level from the assembled input and persists it with the current engine version", async () => {
    mockedFindPr.mockResolvedValue(PULL_REQUEST as never);
    mockedFindRepo.mockResolvedValue(REPOSITORY as never);
    // A small, clean diff — deterministically scores 0 / LOW via the real engine.
    mockedBuildInput.mockResolvedValue({
      additions: 20,
      deletions: 5,
      changedFilesCount: 2,
      changedFiles: [
        { filename: "src/util.ts", additions: 15, deletions: 3, status: "modified" },
        { filename: "src/util.test.ts", additions: 5, deletions: 2, status: "modified" },
      ],
    });
    mockedCreate.mockResolvedValue({} as never);

    await assessPullRequest("pr_1");

    expect(mockedCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        pullRequestId: "pr_1",
        score: 0,
        level: "LOW",
        engineVersion: RISK_ENGINE_VERSION,
      })
    );
    const call = mockedCreate.mock.calls[0][0] as { rulesTriggered: unknown[] };
    expect(call.rulesTriggered).toHaveLength(6); // all six rules present, triggered or not
  });

  it("returns the persisted assessment record", async () => {
    mockedFindPr.mockResolvedValue(PULL_REQUEST as never);
    mockedFindRepo.mockResolvedValue(REPOSITORY as never);
    mockedBuildInput.mockResolvedValue({ additions: 0, deletions: 0, changedFilesCount: 0, changedFiles: [] });
    const persisted = { id: "assessment_1", score: 0, level: "LOW" };
    mockedCreate.mockResolvedValue(persisted as never);

    const result = await assessPullRequest("pr_1");

    expect(result).toBe(persisted);
  });
});
