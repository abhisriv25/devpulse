/** The subset of GitHub's `GET /repos/{owner}/{repo}/pulls/{number}`
 * response Slice 4 actually reads and stores. Not a full GitHub PR type —
 * only what maps to a PullRequest column. */
export interface GithubPullRequestApiResponse {
  id: number;
  number: number;
  title: string;
  body: string | null;
  state: string;
  user: { login: string } | null;
  base: { ref: string; sha: string };
  head: { ref: string; sha: string };
  html_url: string;
  created_at: string;
  updated_at: string;
  closed_at: string | null;
  merged_at: string | null;
  additions: number;
  deletions: number;
  changed_files: number;
}

/** One entry from `GET /repos/{owner}/{repo}/pulls/{number}/files` — the
 * Slice 5 risk engine's only use for individual changed-file data (paths,
 * per-file diff size). Not persisted anywhere; fetched fresh per
 * assessment. See risk/risk-context.service.ts. */
export interface GithubPullRequestFile {
  filename: string;
  additions: number;
  deletions: number;
  status: string;
}
