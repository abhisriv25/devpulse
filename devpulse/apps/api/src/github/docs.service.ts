import { GITHUB_API_BASE, GITHUB_USER_AGENT, createInstallationAccessToken } from "./github-app.service.js";
import { GithubApiNotFoundError } from "./pull-request.service.js";
import type { GithubContentsFileResponse, GithubRepoDetails, GithubTreeResponse } from "./docs.types.js";

/** Paths Slice 7 actually ingests: the repo's root README, and anything
 * under docs/. Deliberately narrow — see the doc's own guidance: "start
 * with README.md, docs/**, *.md. Do not start with 15 integrations." */
function isTrackedMarkdownPath(path: string): boolean {
  const lower = path.toLowerCase();
  if (!lower.endsWith(".md")) return false;
  if (lower === "readme.md") return true;
  if (lower.startsWith("docs/")) return true;
  return false;
}

async function githubGet<T>(url: string, token: string): Promise<T> {
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "User-Agent": GITHUB_USER_AGENT,
    },
  });

  if (response.status === 404) {
    throw new GithubApiNotFoundError(`GitHub API 404: ${url}`);
  }
  if (!response.ok) {
    throw new Error(`GitHub API request failed (${response.status}): ${url}`);
  }

  return (await response.json()) as T;
}

export async function fetchRepositoryDefaultBranch(
  installationId: string,
  owner: string,
  repo: string
): Promise<string> {
  const token = await createInstallationAccessToken(installationId);
  const data = await githubGet<GithubRepoDetails>(`${GITHUB_API_BASE}/repos/${owner}/${repo}`, token);
  return data.default_branch;
}

/**
 * Lists every README.md / docs/**\/*.md path in the repo, via the Git
 * Trees API's recursive listing — one call instead of walking directories
 * one at a time.
 *
 * Known limitation: GitHub truncates very large trees (`truncated: true`
 * in the response); this doesn't paginate around that yet, so an
 * enormous monorepo could have some docs/ files silently missed. Fine at
 * the scale this is meant for today — see README.
 */
export async function listMarkdownFilePaths(installationId: string, owner: string, repo: string, branch: string): Promise<string[]> {
  const token = await createInstallationAccessToken(installationId);
  const data = await githubGet<GithubTreeResponse>(
    `${GITHUB_API_BASE}/repos/${owner}/${repo}/git/trees/${encodeURIComponent(branch)}?recursive=1`,
    token
  );

  return data.tree.filter((entry) => entry.type === "blob" && isTrackedMarkdownPath(entry.path)).map((entry) => entry.path);
}

/** Encodes each path segment separately so slashes stay literal — a plain
 * `encodeURIComponent(path)` would also escape the `/` and break the URL. */
function encodeGithubPath(path: string): string {
  return path.split("/").map(encodeURIComponent).join("/");
}

export async function fetchFileContent(
  installationId: string,
  owner: string,
  repo: string,
  path: string,
  ref: string
): Promise<string> {
  const token = await createInstallationAccessToken(installationId);
  const data = await githubGet<GithubContentsFileResponse>(
    `${GITHUB_API_BASE}/repos/${owner}/${repo}/contents/${encodeGithubPath(path)}?ref=${encodeURIComponent(ref)}`,
    token
  );

  if (data.encoding !== "base64") {
    throw new Error(`Unexpected content encoding "${data.encoding}" for ${path}`);
  }

  return Buffer.from(data.content, "base64").toString("utf8");
}
