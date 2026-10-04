export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000";

export interface Organization {
  id: string;
  name: string;
  slug: string;
  role: "ADMIN" | "MEMBER";
}

export interface CurrentUser {
  id: string;
  githubLogin: string;
  displayName: string | null;
  avatarUrl: string | null;
  organizations: Organization[];
}

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    credentials: "include", // send/receive the devpulse.sid session cookie
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(res.status, body?.error?.message ?? `Request failed: ${res.status}`);
  }

  // 204 No Content has no body to parse
  if (res.status === 204) return undefined as T;

  return res.json() as Promise<T>;
}

export function fetchCurrentUser(): Promise<CurrentUser> {
  return apiFetch<CurrentUser>("/me");
}

export function logout(): Promise<void> {
  return apiFetch<void>("/auth/logout", { method: "POST" });
}

export function githubLoginUrl(): string {
  return `${API_BASE_URL}/auth/github/login`;
}

export interface Repository {
  id: string;
  owner: string;
  name: string;
  fullName: string;
  private: boolean;
  connectedAt: string;
}

export function fetchRepositories(): Promise<{ repositories: Repository[] }> {
  return apiFetch<{ repositories: Repository[] }>("/repositories");
}

/** Not a fetch — a plain link the browser navigates to directly, same as
 * githubLoginUrl(). The backend redirects on to GitHub's App install page
 * after stashing CSRF state in the session. */
export function githubInstallUrl(): string {
  return `${API_BASE_URL}/github/install-url`;
}

export type RiskLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export interface PullRequestRepositorySummary {
  id: string;
  owner: string;
  name: string;
  fullName: string;
}

export interface LatestRiskSummary {
  score: number;
  level: RiskLevel;
  createdAt: string;
}

export interface PullRequestListItem {
  id: string;
  number: number;
  title: string;
  author: string;
  state: string;
  url: string;
  updatedAt: string;
  closedAt: string | null;
  mergedAt: string | null;
  additions: number;
  deletions: number;
  changedFilesCount: number;
  repository: PullRequestRepositorySummary;
  latestRisk: LatestRiskSummary | null;
}

export interface PullRequestDetail {
  id: string;
  number: number;
  title: string;
  body: string | null;
  state: string;
  author: string;
  baseBranch: string;
  headBranch: string;
  baseSha: string;
  headSha: string;
  url: string;
  createdAt: string;
  updatedAt: string;
  closedAt: string | null;
  mergedAt: string | null;
  additions: number;
  deletions: number;
  changedFilesCount: number;
  repository: PullRequestRepositorySummary;
}

export interface RiskSignal {
  code: string;
  triggered: boolean;
  points: number;
  explanation: string;
  evidence: string[];
}

export interface RiskAssessment {
  id: string;
  pullRequestId: string;
  score: number;
  level: RiskLevel;
  rulesTriggered: RiskSignal[];
  engineVersion: string;
  createdAt: string;
}

export function fetchPullRequests(filters: { repositoryId?: string } = {}): Promise<{
  pullRequests: PullRequestListItem[];
}> {
  const params = new URLSearchParams();
  if (filters.repositoryId) params.set("repositoryId", filters.repositoryId);
  const query = params.toString();
  return apiFetch<{ pullRequests: PullRequestListItem[] }>(`/pull-requests${query ? `?${query}` : ""}`);
}

export function fetchPullRequest(id: string): Promise<PullRequestDetail> {
  return apiFetch<PullRequestDetail>(`/pull-requests/${id}`);
}

/** Slower than the other GETs on this page — an uncached assessment means
 * the API is calling out to GitHub before responding. Callers should show
 * a loading state, not assume this is instant. */
export function fetchPullRequestRisk(id: string): Promise<RiskAssessment> {
  return apiFetch<RiskAssessment>(`/pull-requests/${id}/risk`);
}

export type ConfidenceLevel = "LOW" | "MEDIUM" | "HIGH";

export interface RiskExplanationItem {
  title: string;
  severity: RiskLevel;
  reason: string;
  evidence: string[];
}

export interface RecommendationItem {
  action: string;
  reason: string;
  source: string | null;
}

export interface PrIntelligence {
  id: string;
  pullRequestId: string;
  riskAssessmentId: string;
  deterministicScore: number;
  riskLevel: RiskLevel;
  summary: string;
  findings: RiskExplanationItem[];
  recommendations: RecommendationItem[];
  confidence: ConfidenceLevel;
  riskEngineVersion: string;
  promptVersion: string;
  embeddingModel: string | null;
  retrievalVersion: string;
  llmModel: string;
  createdAt: string;
}

export type PrIntelligenceResponse =
  | { status: "analyzed"; intelligence: PrIntelligence }
  | { status: "skipped_low_risk"; score: number; level: RiskLevel };

/** Slice 10's unified endpoint — deterministic score plus grounded AI
 * summary/findings/recommendations in one response. Same "first view can
 * be slow" caveat as fetchPullRequestRisk: an uncached analysis means a
 * real LLM call happens server-side before this resolves. A LOW-risk PR
 * returns `{ status: "skipped_low_risk" }` by design — see the risk
 * engine's own cost-control reasoning — not an error. */
export function fetchPullRequestIntelligence(id: string): Promise<PrIntelligenceResponse> {
  return apiFetch<PrIntelligenceResponse>(`/pull-requests/${id}/intelligence`);
}
