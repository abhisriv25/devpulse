/** Minimal shape of `GET /repos/{owner}/{repo}` — only the field Slice 7
 * reads. */
export interface GithubRepoDetails {
  default_branch: string;
}

/** One entry from `GET /repos/{owner}/{repo}/git/trees/{sha}?recursive=1`. */
export interface GithubTreeEntry {
  path: string;
  type: "blob" | "tree" | "commit";
}

export interface GithubTreeResponse {
  tree: GithubTreeEntry[];
  truncated: boolean;
}

/** `GET /repos/{owner}/{repo}/contents/{path}` for a file (not a directory)
 * always returns `encoding: "base64"` with the file's content — this is
 * the only shape Slice 7 handles. */
export interface GithubContentsFileResponse {
  content: string;
  encoding: string;
}
