import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("./github-app.service.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./github-app.service.js")>();
  return {
    ...actual,
    createInstallationAccessToken: vi.fn().mockResolvedValue("fake-token"),
  };
});

import { GithubApiNotFoundError } from "./pull-request.service.js";
import { fetchFileContent, fetchRepositoryDefaultBranch, listMarkdownFilePaths } from "./docs.service.js";

const originalFetch = globalThis.fetch;

beforeEach(() => {
  globalThis.fetch = vi.fn();
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  vi.clearAllMocks();
});

function jsonResponse(body: unknown, status = 200) {
  return { ok: status >= 200 && status < 300, status, json: async () => body } as Response;
}

describe("fetchRepositoryDefaultBranch", () => {
  it("returns the repo's default branch", async () => {
    vi.mocked(globalThis.fetch).mockResolvedValueOnce(jsonResponse({ default_branch: "main" }));
    const branch = await fetchRepositoryDefaultBranch("inst_1", "acme", "widgets");
    expect(branch).toBe("main");
  });

  it("throws GithubApiNotFoundError on 404", async () => {
    vi.mocked(globalThis.fetch).mockResolvedValueOnce(jsonResponse({}, 404));
    await expect(fetchRepositoryDefaultBranch("inst_1", "acme", "widgets")).rejects.toThrow(GithubApiNotFoundError);
  });
});

describe("listMarkdownFilePaths", () => {
  it("keeps README.md and anything under docs/, drops everything else", async () => {
    vi.mocked(globalThis.fetch).mockResolvedValueOnce(
      jsonResponse({
        truncated: false,
        tree: [
          { path: "README.md", type: "blob" },
          { path: "docs/architecture.md", type: "blob" },
          { path: "docs/nested/adr-1.md", type: "blob" },
          { path: "src/index.ts", type: "blob" },
          { path: "CHANGELOG.md", type: "blob" }, // root-level .md, not README, not under docs/
          { path: "docs", type: "tree" }, // a directory entry, not a file
        ],
      })
    );

    const paths = await listMarkdownFilePaths("inst_1", "acme", "widgets", "main");

    expect(paths.sort()).toEqual(["README.md", "docs/architecture.md", "docs/nested/adr-1.md"].sort());
  });

  it("matches README.md case-insensitively", async () => {
    vi.mocked(globalThis.fetch).mockResolvedValueOnce(
      jsonResponse({ truncated: false, tree: [{ path: "readme.md", type: "blob" }] })
    );
    const paths = await listMarkdownFilePaths("inst_1", "acme", "widgets", "main");
    expect(paths).toEqual(["readme.md"]);
  });
});

describe("fetchFileContent", () => {
  it("decodes base64 content", async () => {
    const original = "# Hello\n\nWorld.";
    vi.mocked(globalThis.fetch).mockResolvedValueOnce(
      jsonResponse({ content: Buffer.from(original, "utf8").toString("base64"), encoding: "base64" })
    );

    const content = await fetchFileContent("inst_1", "acme", "widgets", "README.md", "main");
    expect(content).toBe(original);
  });

  it("URL-encodes path segments but keeps slashes literal", async () => {
    vi.mocked(globalThis.fetch).mockResolvedValueOnce(
      jsonResponse({ content: Buffer.from("x").toString("base64"), encoding: "base64" })
    );

    await fetchFileContent("inst_1", "acme", "widgets", "docs/my doc.md", "main");

    const [url] = vi.mocked(globalThis.fetch).mock.calls[0];
    expect(String(url)).toContain("/contents/docs/my%20doc.md");
  });

  it("throws GithubApiNotFoundError when the file doesn't exist", async () => {
    vi.mocked(globalThis.fetch).mockResolvedValueOnce(jsonResponse({}, 404));
    await expect(fetchFileContent("inst_1", "acme", "widgets", "missing.md", "main")).rejects.toThrow(
      GithubApiNotFoundError
    );
  });
});
