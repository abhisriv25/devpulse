import { Link, useParams } from "react-router-dom";
import { RiskBadge } from "../components/RiskBadge";
import { usePullRequest, usePullRequestIntelligence, usePullRequestRisk } from "../lib/use-pull-requests";

export function PullRequestDetailPage() {
  const { pullId } = useParams<{ pullId: string }>();
  const { data: pr, isLoading: prLoading, isError: prError } = usePullRequest(pullId);
  const { data: risk, isLoading: riskLoading, isError: riskError } = usePullRequestRisk(pullId);
  const {
    data: intelligence,
    isLoading: intelligenceLoading,
    isError: intelligenceError,
  } = usePullRequestIntelligence(pullId);

  return (
    <div className="min-h-screen">
      <header className="flex items-center justify-between border-b border-slate-800 px-6 py-4">
        <Link to="/" className="text-lg font-semibold tracking-tight">
          DevPulse
        </Link>
        {pr && (
          <Link to={`/repositories/${pr.repository.id}/pulls`} className="text-sm text-slate-400 hover:text-slate-200">
            ← {pr.repository.fullName}
          </Link>
        )}
      </header>

      <main className="mx-auto max-w-3xl px-6 py-12">
        {prLoading && <p className="text-sm text-slate-500">Loading…</p>}
        {prError && <p className="text-sm text-red-400">Couldn't load this pull request.</p>}

        {pr && (
          <>
            <div className="flex items-start justify-between gap-4">
              <div>
                <h1 className="text-xl font-semibold">
                  {pr.title} <span className="text-slate-500">#{pr.number}</span>
                </h1>
                <p className="mt-1 text-sm text-slate-400">
                  <span className="text-slate-300">{pr.author}</span> wants to merge{" "}
                  <code className="rounded bg-slate-900 px-1.5 py-0.5 text-xs">{pr.headBranch}</code> into{" "}
                  <code className="rounded bg-slate-900 px-1.5 py-0.5 text-xs">{pr.baseBranch}</code>
                </p>
              </div>
              <a
                href={pr.url}
                target="_blank"
                rel="noreferrer"
                className="shrink-0 rounded-md border border-slate-700 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-800"
              >
                View on GitHub
              </a>
            </div>

            <div className="mt-4 flex items-center gap-4 text-sm text-slate-400">
              <span>{pr.mergedAt ? "Merged" : pr.state === "closed" ? "Closed" : "Open"}</span>
              <span>
                <span className="text-emerald-400">+{pr.additions}</span>{" "}
                <span className="text-red-400">-{pr.deletions}</span>
              </span>
              <span>
                {pr.changedFilesCount} file{pr.changedFilesCount === 1 ? "" : "s"} changed
              </span>
            </div>

            <section className="mt-10">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Risk assessment</h2>

              {riskLoading && (
                <p className="mt-3 text-sm text-slate-500">
                  Computing risk assessment — this can take a few seconds the first time…
                </p>
              )}
              {riskError && <p className="mt-3 text-sm text-red-400">Couldn't compute a risk assessment right now.</p>}

              {risk && (
                <div className="mt-4 rounded-lg border border-slate-800 p-5">
                  <div className="flex items-center gap-3">
                    <RiskBadge level={risk.level} score={risk.score} />
                    <span className="text-xs text-slate-500">
                      engine {risk.engineVersion} · assessed {new Date(risk.createdAt).toLocaleString()}
                    </span>
                  </div>

                  <ul className="mt-5 space-y-3">
                    {risk.rulesTriggered.map((signal) => (
                      <li
                        key={signal.code}
                        className={`flex items-start gap-3 text-sm ${signal.triggered ? "text-slate-200" : "text-slate-600"}`}
                      >
                        <span
                          className={`mt-0.5 w-10 shrink-0 text-right font-mono text-xs ${
                            signal.triggered ? "text-slate-300" : "text-slate-700"
                          }`}
                        >
                          {signal.triggered ? `+${signal.points}` : "0"}
                        </span>
                        <div>
                          <p>{signal.explanation}</p>
                          {signal.evidence.length > 0 && (
                            <ul className="mt-1 space-y-0.5 text-xs text-slate-500">
                              {signal.evidence.map((path) => (
                                <li key={path} className="font-mono">
                                  {path}
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </section>

            <section className="mt-10">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">AI context</h2>

              {intelligenceLoading && (
                <p className="mt-3 text-sm text-slate-500">
                  Generating AI analysis — this can take a few seconds the first time…
                </p>
              )}
              {intelligenceError && (
                <p className="mt-3 text-sm text-red-400">Couldn't generate an AI analysis right now.</p>
              )}

              {intelligence?.status === "skipped_low_risk" && (
                <p className="mt-3 text-sm text-slate-500">
                  This PR's risk is LOW, so no AI analysis was generated — that's the cost control working as
                  intended, not a missing feature.
                </p>
              )}

              {intelligence?.status === "analyzed" && (
                <div className="mt-4 space-y-6">
                  <div className="rounded-lg border border-slate-800 p-5">
                    <div className="flex items-center gap-3">
                      <span className="rounded-full border border-slate-700 px-2.5 py-0.5 text-xs text-slate-300">
                        {intelligence.intelligence.confidence} confidence
                      </span>
                      <span className="text-xs text-slate-500">
                        {intelligence.intelligence.llmModel} · analyzed{" "}
                        {new Date(intelligence.intelligence.createdAt).toLocaleString()}
                      </span>
                    </div>
                    <p className="mt-3 text-sm text-slate-300">{intelligence.intelligence.summary}</p>
                  </div>

                  {intelligence.intelligence.recommendations.length > 0 && (
                    <div>
                      <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Recommendations
                      </h3>
                      <ul className="mt-3 space-y-3">
                        {intelligence.intelligence.recommendations.map((rec, i) => (
                          <li key={i} className="rounded-lg border border-slate-800 p-4 text-sm">
                            <p className="text-slate-200">{rec.action}</p>
                            <p className="mt-1 text-slate-500">{rec.reason}</p>
                            {rec.source && (
                              <p className="mt-2 font-mono text-xs text-slate-600">Evidence: {rec.source}</p>
                            )}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </section>

            {pr.body && (
              <section className="mt-10">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Description</h2>
                <p className="mt-3 whitespace-pre-wrap text-sm text-slate-400">{pr.body}</p>
              </section>
            )}
          </>
        )}
      </main>
    </div>
  );
}
