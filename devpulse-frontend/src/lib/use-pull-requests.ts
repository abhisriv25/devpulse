import { useQuery } from "@tanstack/react-query";
import { fetchPullRequest, fetchPullRequestIntelligence, fetchPullRequestRisk, fetchPullRequests } from "./api";

export function usePullRequests(filters: { repositoryId?: string } = {}) {
  return useQuery({
    queryKey: ["pullRequests", filters.repositoryId ?? null],
    queryFn: () => fetchPullRequests(filters),
  });
}

export function usePullRequest(id: string | undefined) {
  return useQuery({
    queryKey: ["pullRequest", id],
    queryFn: () => fetchPullRequest(id!),
    enabled: Boolean(id),
  });
}

export function usePullRequestRisk(id: string | undefined) {
  return useQuery({
    queryKey: ["pullRequestRisk", id],
    queryFn: () => fetchPullRequestRisk(id!),
    enabled: Boolean(id),
    // An on-demand assessment can involve a real GitHub API call server-side
    // (see fetchPullRequestRisk's doc comment) — don't hammer it on refocus.
    refetchOnWindowFocus: false,
  });
}

export function usePullRequestIntelligence(id: string | undefined) {
  return useQuery({
    queryKey: ["pullRequestIntelligence", id],
    queryFn: () => fetchPullRequestIntelligence(id!),
    enabled: Boolean(id),
    // Same reasoning as usePullRequestRisk — an uncached analysis is a real
    // LLM call server-side, not an instant read.
    refetchOnWindowFocus: false,
  });
}
