import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("./github-app.service.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./github-app.service.js")>();
  return {
    ...actual,
    createInstallationAccessToken: vi.fn().mockResolvedValue("fake-installation-token"),
  };
});

import { GithubApiNotFoundError, fetchPullRequestFilesFromGithub } from "./pull-request.service.js";

const originalFetch = globalThis.fetch;

beforeEach(() => {
  globalThis.fetch = vi.fn();
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  vi.clearAllMocks();
});

function jsonResponse(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response;
}

describe("fetchPullRequestFilesFromGithub", () => {
  it("returns the files from a single page", async () => {
    const files = [{ filename: "a.ts", additions: 1, deletions: 0, status: "modified" }];
    vi.mocked(globalThis.fetch).mockResolvedValueOnce(jsonResponse(files));

    const result = await fetchPullRequestFilesFromGithub("inst_1", "acme", "widgets", 42);

    expect(result).toEqual(files);
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    const [url] = vi.mocked(globalThis.fetch).mock.calls[0];
    expect(String(url)).toContain("/repos/acme/widgets/pulls/42/files");
  });

  it("follows pagination and combines every page's files", async () => {
    const page1 = Array.from({ length: 100 }, (_, i) => ({
      filename: `file-${i}.ts`,
      additions: 1,
      deletions: 0,
      status: "modified",
    }));
    const page2 = [{ filename: "last.ts", additions: 1, deletions: 0, status: "modified" }];

    vi.mocked(globalThis.fetch).mockResolvedValueOnce(jsonResponse(page1)).mockResolvedValueOnce(jsonResponse(page2));

    const result = await fetchPullRequestFilesFromGithub("inst_1", "acme", "widgets", 42);

    expect(result).toHaveLength(101);
    expect(globalThis.fetch).toHaveBeenCalledTimes(2);
  });

  it("throws GithubApiNotFoundError on a 404", async () => {
    vi.mocked(globalThis.fetch).mockResolvedValueOnce(jsonResponse({}, 404));

    await expect(fetchPullRequestFilesFromGithub("inst_1", "acme", "widgets", 42)).rejects.toThrow(
      GithubApiNotFoundError
    );
  });

  it("throws a generic error on other non-2xx responses", async () => {
    vi.mocked(globalThis.fetch).mockResolvedValueOnce(jsonResponse({}, 503));

    await expect(fetchPullRequestFilesFromGithub("inst_1", "acme", "widgets", 42)).rejects.toThrow(/503/);
  });
});
