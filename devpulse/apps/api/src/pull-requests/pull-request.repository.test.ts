import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../db/client.js", () => ({
  prisma: {
    pullRequest: {
      upsert: vi.fn(),
    },
  },
}));

import { prisma } from "../db/client.js";
import { upsertPullRequestFromGithub } from "./pull-request.repository.js";
import type { GithubPullRequestApiResponse } from "../github/pull-request.types.js";

const mockedUpsert = vi.mocked(prisma.pullRequest.upsert);

beforeEach(() => {
  vi.clearAllMocks();
});

function githubPr(overrides: Partial<GithubPullRequestApiResponse> = {}): GithubPullRequestApiResponse {
  return {
    id: 999111,
    number: 42,
    title: "Add risk engine scaffolding",
    body: "Initial pass",
    state: "open",
    user: { login: "octocat" },
    base: { ref: "main", sha: "base-sha-1" },
    head: { ref: "feature/risk-engine", sha: "head-sha-1" },
    html_url: "https://github.com/acme/widgets/pull/42",
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T01:00:00Z",
    closed_at: null,
    merged_at: null,
    additions: 42,
    deletions: 10,
    changed_files: 3,
    ...overrides,
  };
}

describe("upsertPullRequestFromGithub", () => {
  it("upserts keyed on (repositoryId, githubPrId), not a plain create", async () => {
    mockedUpsert.mockResolvedValue({} as never);

    await upsertPullRequestFromGithub("repo_1", githubPr());

    expect(mockedUpsert).toHaveBeenCalledTimes(1);
    const call = mockedUpsert.mock.calls[0][0] as { where: unknown };
    expect(call.where).toEqual({
      repositoryId_githubPrId: { repositoryId: "repo_1", githubPrId: "999111" },
    });
  });

  it("maps GitHub's PR fields onto the DB row (author, branches, shas, url)", async () => {
    mockedUpsert.mockResolvedValue({} as never);

    await upsertPullRequestFromGithub("repo_1", githubPr());

    const call = mockedUpsert.mock.calls[0][0] as { create: Record<string, unknown> };
    expect(call.create).toMatchObject({
      repositoryId: "repo_1",
      githubPrId: "999111",
      number: 42,
      title: "Add risk engine scaffolding",
      author: "octocat",
      baseBranch: "main",
      headBranch: "feature/risk-engine",
      baseSha: "base-sha-1",
      headSha: "head-sha-1",
      url: "https://github.com/acme/widgets/pull/42",
      state: "open",
      additions: 42,
      deletions: 10,
      changedFilesCount: 3,
    });
  });

  it("falls back to a placeholder author rather than crashing when GitHub omits the user (e.g. a deleted account)", async () => {
    mockedUpsert.mockResolvedValue({} as never);

    await upsertPullRequestFromGithub("repo_1", githubPr({ user: null }));

    const call = mockedUpsert.mock.calls[0][0] as { create: Record<string, unknown> };
    expect(call.create.author).toBe("unknown");
  });

  it("processing the same PR twice (e.g. opened then synchronize) targets the same row and reflects the latest state, not a merge of old and new", async () => {
    mockedUpsert.mockResolvedValue({} as never);

    await upsertPullRequestFromGithub("repo_1", githubPr({ state: "open", title: "WIP" }));
    await upsertPullRequestFromGithub(
      "repo_1",
      githubPr({ state: "open", title: "Ready for review", headSha: "head-sha-2" } as never)
    );

    expect(mockedUpsert).toHaveBeenCalledTimes(2);
    const firstWhere = (mockedUpsert.mock.calls[0][0] as { where: { repositoryId_githubPrId: unknown } }).where
      .repositoryId_githubPrId;
    const secondWhere = (mockedUpsert.mock.calls[1][0] as { where: { repositoryId_githubPrId: unknown } }).where
      .repositoryId_githubPrId;
    expect(firstWhere).toEqual(secondWhere); // same identity — one logical row, not two

    const secondUpdate = (mockedUpsert.mock.calls[1][0] as { update: Record<string, unknown> }).update;
    expect(secondUpdate.title).toBe("Ready for review"); // reflects the newer fetch, no stale carry-over
  });

  it("sets closedAt/mergedAt from GitHub's timestamps when the PR is closed/merged", async () => {
    mockedUpsert.mockResolvedValue({} as never);

    await upsertPullRequestFromGithub(
      "repo_1",
      githubPr({ state: "closed", closed_at: "2026-01-02T00:00:00Z", merged_at: "2026-01-02T00:00:00Z" })
    );

    const call = mockedUpsert.mock.calls[0][0] as { update: Record<string, unknown> };
    expect(call.update.state).toBe("closed");
    expect(call.update.closedAt).toEqual(new Date("2026-01-02T00:00:00Z"));
    expect(call.update.mergedAt).toEqual(new Date("2026-01-02T00:00:00Z"));
  });

  it("leaves closedAt/mergedAt null for an open PR", async () => {
    mockedUpsert.mockResolvedValue({} as never);

    await upsertPullRequestFromGithub("repo_1", githubPr({ state: "open" }));

    const call = mockedUpsert.mock.calls[0][0] as { update: Record<string, unknown> };
    expect(call.update.closedAt).toBeNull();
    expect(call.update.mergedAt).toBeNull();
  });
});
