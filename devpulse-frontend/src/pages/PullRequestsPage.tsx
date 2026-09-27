import { Link, useParams } from "react-router-dom";
import { AppHeader } from "../components/AppHeader";
import { PageShell } from "../components/PageShell";
import { RiskBadge } from "../components/RiskBadge";
import { EmptyState, ErrorState, RowSkeleton } from "../components/StatusStates";
import { usePullRequests } from "../lib/use-pull-requests";

export function PullRequestsPage() {
  const { repoId } = useParams<{ repoId: string }>();
  const { data, isLoading, isError, refetch, isFetching } = usePullRequests({ repositoryId: repoId });

  const pullRequests = data?.pullRequests ?? [];
  const repoName = pullRequests[0]?.repository.fullName;
  const openCount = pullRequests.filter((pr) => pr.state === "open").length;

  return (
    <PageShell>
      <AppHeader />

      <main className="relative mx-auto max-w-5xl px-6 py-10">
        <div className="animate-fade-in-up">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <h1 className="text-2xl font-semibold text-white">
              Pull requests
              {repoName && <span className="font-normal text-slate-400"> — {repoName}</span>}
            </h1>
            {pullRequests.length > 0 && (
              <p className="text-sm text-slate-500">
                <span className="font-medium text-slate-300">{openCount}</span> open ·{" "}
                <span className="font-medium text-slate-300">{pullRequests.length}</span> total
              </p>
            )}
          </div>
        </div>

        <section className="mt-6 animate-fade-in-up overflow-hidden rounded-xl border border-slate-800 bg-slate-900/40 shadow-lg shadow-black/20 [animation-delay:80ms]">
          {isLoading ? (
            <RowSkeleton count={5} />
          ) : isError ? (
            <ErrorState
              description="We couldn't reach the pull requests service. Check that the API is running and try again."
              onRetry={() => refetch()}
            />
          ) : pullRequests.length === 0 ? (
            <EmptyState
              title="No pull requests yet"
              description="Once a PR is opened on this repo, it'll show up here shortly after GitHub's webhook fires and the sync poller picks it up."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-slate-800/80 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-5 py-3 font-medium">Pull request</th>
                    <th className="px-5 py-3 font-medium">Author</th>
                    <th className="px-5 py-3 font-medium">Risk</th>
                    <th className="px-5 py-3 font-medium">Status</th>
                    <th className="px-5 py-3 font-medium">Updated</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {pullRequests.map((pr, i) => (
                    <tr
                      key={pr.id}
                      className="animate-fade-in transition-colors hover:bg-slate-800/30 motion-reduce:animate-none"
                      style={{ animationDelay: `${Math.min(i, 8) * 40}ms` }}
                    >
                      <td className="max-w-md px-5 py-3.5">
                        <Link
                          to={`/pulls/${pr.id}`}
                          className="block truncate text-slate-200 transition-colors hover:text-emerald-300"
                        >
                          <span className="text-slate-500">#{pr.number}</span> {pr.title}
                        </Link>
                      </td>
                      <td className="px-5 py-3.5 text-slate-400">{pr.author}</td>
                      <td className="px-5 py-3.5">
                        {pr.latestRisk ? (
                          <RiskBadge level={pr.latestRisk.level} score={pr.latestRisk.score} />
                        ) : (
                          <span className="text-xs text-slate-600">Not assessed</span>
                        )}
                      </td>
                      <td className="px-5 py-3.5">
                        <StatusPill pr={pr} />
                      </td>
                      <td className="px-5 py-3.5 text-slate-500">
                        {new Date(pr.updatedAt).toLocaleDateString(undefined, {
                          month: "short",
                          day: "numeric",
                        })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {isFetching && !isLoading && (
            <div className="border-t border-slate-800/80 px-5 py-2 text-center text-[11px] text-slate-600">
              Refreshing…
            </div>
          )}
        </section>
      </main>
    </PageShell>
  );
}

function StatusPill({ pr }: { pr: { mergedAt: string | null; state: string } }) {
  const label = pr.mergedAt ? "Merged" : pr.state === "closed" ? "Closed" : "Open";
  const styles =
    label === "Merged"
      ? "border-violet-800 bg-violet-950 text-violet-300"
      : label === "Closed"
        ? "border-slate-700 bg-slate-800/60 text-slate-400"
        : "border-emerald-800 bg-emerald-950 text-emerald-300";
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${styles}`}>
      {label}
    </span>
  );
}
