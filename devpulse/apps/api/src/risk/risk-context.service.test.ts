import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../github/pull-request.service.js", () => ({
  fetchPullRequestFilesFromGithub: vi.fn(),
}));

import { fetchPullRequestFilesFromGithub } from "../github/pull-request.service.js";
import { buildRiskInputFromGithub } from "./risk-context.service.js";

const mockedFetchFiles = vi.mocked(fetchPullRequestFilesFromGithub);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("buildRiskInputFromGithub", () => {
  it("uses the passed-in totals rather than deriving them from the files list", async () => {
    mockedFetchFiles.mockResolvedValue([{ filename: "a.ts", additions: 1, deletions: 1, status: "modified" }]);

    const input = await buildRiskInputFromGithub("inst_1", "acme", "widgets", 42, {
      additions: 500,
      deletions: 100,
      changedFilesCount: 9,
    });

    expect(input.additions).toBe(500);
    expect(input.deletions).toBe(100);
    expect(input.changedFilesCount).toBe(9);
  });

  it("maps the fetched files list onto RiskInput.changedFiles", async () => {
    mockedFetchFiles.mockResolvedValue([
      { filename: "src/auth/login.ts", additions: 10, deletions: 2, status: "modified" },
      { filename: "package.json", additions: 1, deletions: 1, status: "modified" },
    ]);

    const input = await buildRiskInputFromGithub("inst_1", "acme", "widgets", 42, {
      additions: 11,
      deletions: 3,
      changedFilesCount: 2,
    });

    expect(input.changedFiles).toEqual([
      { filename: "src/auth/login.ts", additions: 10, deletions: 2, status: "modified" },
      { filename: "package.json", additions: 1, deletions: 1, status: "modified" },
    ]);
    expect(mockedFetchFiles).toHaveBeenCalledWith("inst_1", "acme", "widgets", 42);
  });
});
