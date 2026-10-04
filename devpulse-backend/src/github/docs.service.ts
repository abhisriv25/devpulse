import { GithubApiError, GithubApiNotFoundError } from "./pull-request.service.js";

function headers(token: string) {
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "User-Agent": "devpulse",
  };
}

function repoUrl(owner: string, repo: string) {
  return `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`;
}

async function githubGet<T>(url: string, token: string, what: string): Promise<T> {
  const res = await fetch(url, { headers: headers(token) });
  if (res.status === 404) throw new GithubApiNotFoundError(`${what} not found`);
  if (!res.ok) throw new GithubApiError(`Failed to fetch ${what} (status ${res.status})`);
  return (await res.json()) as T;
}

export async function fetchDefaultBranch(token: string, owner: string, repo: string): Promise<string> {
  const body = await githubGet<{ default_branch: string }>(repoUrl(owner, repo), token, "repository");
  return body.default_branch;
}

export function isDocPath(path: string): boolean {
  const lower = path.toLowerCase();
  return lower === "readme.md" || (lower.startsWith("docs/") && lower.endsWith(".md"));
}

/** README.md plus every Markdown file under docs/. Note: GitHub truncates
 * the recursive tree for very large repos; that case isn't handled. */
export async function listMarkdownFilePaths(
  token: string,
  owner: string,
  repo: string,
  branch: string,
): Promise<string[]> {
  const body = await githubGet<{ tree: { path: string; type: string }[] }>(
    `${repoUrl(owner, repo)}/git/trees/${encodeURIComponent(branch)}?recursive=1`,
    token,
    "repository tree",
  );
  return body.tree.filter((e) => e.type === "blob" && isDocPath(e.path)).map((e) => e.path);
}

export async function fetchFileContent(
  token: string,
  owner: string,
  repo: string,
  path: string,
  branch: string,
): Promise<string> {
  const encodedPath = path.split("/").map(encodeURIComponent).join("/");
  const body = await githubGet<{ content: string; encoding: string }>(
    `${repoUrl(owner, repo)}/contents/${encodedPath}?ref=${encodeURIComponent(branch)}`,
    token,
    `file ${path}`,
  );
  if (body.encoding !== "base64") throw new GithubApiError(`Unexpected encoding for ${path}`);
  return Buffer.from(body.content, "base64").toString("utf8");
}
