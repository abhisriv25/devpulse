import { Link, useParams } from "react-router-dom";
import { RiskBadge } from "../components/RiskBadge";
import { usePullRequests } from "../lib/use-pull-requests";

export function PullRequestsPage() {
  const { repoId } = useParams<{ repoId: string }>();
  const { data, isLoading, isError } = usePullRequests({ repositoryId: repoId });

  const pullRequests = data?.pullRequests ?? [];
  const repoName = pullRequests[0]?.repository.fullName;

  return (
    <div className="min-h-screen">
      <header className="flex items-center justify-between border-b border-slate-800 px-6 py-4">
        <Link to="/" className="text-lg font-semibold tracking-tight">
          DevPulse
        </Link>
        <Link to="/repositories" className="text-sm text-slate-400 hover:text-slate-200">
          ← Repositories
        </Link>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-12">
        <h1 className="text-xl font-semibold">Pull requests{repoName ? ` — ${repoName}` : ""}</h1>

        <div className="mt-8">
          {isLoading && <p className="text-sm text-slate-500">Loading…</p>}

          {isError && <p className="text-sm text-red-400">Couldn't load pull requests.</p>}

          {!isLoading && !isError && pullRequests.length === 0 && (
            <div className="rounded-lg border border-dashed border-slate-800 p-6 text-sm text-slate-500">
              No pull requests yet. Once a PR is opened on this repo, it'll show up here shortly after
              GitHub's webhook fires and the sync poller picks it up.
            </div>
          )}

          {pullRequests.length > 0 && (
            <div className="overflow-hidden rounded-lg border border-slate-800">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-slate-800 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-2.5 font-medium">Pull request</th>
                    <th className="px-4 py-2.5 font-medium">Author</th>
                    <th className="px-4 py-2.5 font-medium">Risk</th>
                    <th className="px-4 py-2.5 font-medium">Status</th>
                    <th className="px-4 py-2.5 font-medium">Updated</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {pullRequests.map((pr) => (
                    <tr key={pr.id} className="hover:bg-slate-900/60">
                      <td className="px-4 py-3">
                        <Link to={`/pulls/${pr.id}`} className="text-slate-200 hover:underline">
                          #{pr.number} {pr.title}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-slate-400">{pr.author}</td>
                      <td className="px-4 py-3">
                        {pr.latestRisk ? (
                          <RiskBadge level={pr.latestRisk.level} score={pr.latestRisk.score} />
                        ) : (
                          <span className="text-xs text-slate-600">Not assessed</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-400">
                        {pr.mergedAt ? "Merged" : pr.state === "closed" ? "Closed" : "Open"}
                      </td>
                      <td className="px-4 py-3 text-slate-500">{new Date(pr.updatedAt).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
