import { Link, useSearchParams } from "react-router-dom";
import { AppHeader } from "../components/AppHeader";
import { PageShell } from "../components/PageShell";
import { EmptyState, ErrorState, RowSkeleton } from "../components/StatusStates";
import { githubInstallUrl } from "../lib/api";
import { useRepositories } from "../lib/use-repositories";

const ERROR_MESSAGES: Record<string, string> = {
  invalid_callback: "GitHub didn't send back what we expected. Please try connecting again.",
  invalid_state: "That connection request expired or was already used. Please try again.",
  install_failed: "We couldn't finish syncing your repositories. Please try again.",
};

export function RepositoriesPage() {
  const [searchParams] = useSearchParams();
  const { data, isLoading, isError, refetch } = useRepositories();

  const justConnected = searchParams.get("connected") === "1";
  const errorCode = searchParams.get("error");
  const errorMessage = errorCode ? ERROR_MESSAGES[errorCode] ?? "Something went wrong. Please try again." : null;

  const repositories = data?.repositories ?? [];

  return (
    <PageShell>
      <AppHeader />

      <main className="relative mx-auto max-w-3xl px-6 py-10">
        <div className="flex animate-fade-in-up flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-white">Repositories</h1>
            <p className="mt-1.5 text-sm text-slate-400">
              {repositories.length > 0
                ? `${repositories.length} connected — DevPulse syncs pull requests as they change.`
                : "Connect a repo to start scoring its pull requests."}
            </p>
          </div>
          <a
            href={githubInstallUrl()}
            className="group relative flex shrink-0 items-center gap-1.5 overflow-hidden rounded-md bg-slate-100 px-4 py-2 text-sm font-medium text-slate-900 shadow-lg shadow-black/20 transition-all duration-300 hover:-translate-y-0.5 hover:bg-white hover:shadow-emerald-500/20 hover:shadow-xl active:translate-y-0 active:scale-[0.98]"
          >
            <PlusIcon />
            Connect repository
          </a>
        </div>

        {justConnected && (
          <p className="mt-5 flex animate-fade-in-up items-center gap-2 rounded-md border border-emerald-900/60 bg-emerald-950/60 px-3 py-2.5 text-sm text-emerald-300">
            <CheckIcon />
            Repositories connected.
          </p>
        )}
        {errorMessage && (
          <p className="mt-5 flex animate-shake items-center gap-2 rounded-md border border-red-900/60 bg-red-950/80 px-3 py-2.5 text-sm text-red-300">
            <AlertIcon />
            {errorMessage}
          </p>
        )}

        <section className="mt-6 animate-fade-in-up overflow-hidden rounded-xl border border-slate-800 bg-slate-900/40 shadow-lg shadow-black/20 [animation-delay:80ms]">
          {isLoading ? (
            <RowSkeleton count={4} />
          ) : isError ? (
            <ErrorState
              description="We couldn't reach the repositories service. Check that the API is running and try again."
              onRetry={() => refetch()}
            />
          ) : repositories.length === 0 ? (
            <EmptyState
              title="Nothing connected yet"
              description={
                'Click "Connect repository" to install the DevPulse GitHub App and choose which repos to sync.'
              }
            />
          ) : (
            <ul className="divide-y divide-slate-800/60">
              {repositories.map((repo, i) => (
                <li
                  key={repo.id}
                  className="animate-fade-in motion-reduce:animate-none"
                  style={{ animationDelay: `${Math.min(i, 8) * 40}ms` }}
                >
                  <Link
                    to={`/repositories/${repo.id}/pulls`}
                    className="flex items-center gap-3 px-5 py-3.5 transition-colors hover:bg-slate-800/30"
                  >
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400">
                      <RepoIcon />
                    </span>
                    <span className="min-w-0 flex-1 truncate text-sm text-slate-200">{repo.fullName}</span>
                    {repo.private && (
                      <span className="shrink-0 rounded-full border border-slate-700 px-2 py-0.5 text-[11px] text-slate-400">
                        Private
                      </span>
                    )}
                    <ArrowIcon className="shrink-0 text-slate-600" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </PageShell>
  );
}

function RepoIcon() {
  return (
    <svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor" aria-hidden="true">
      <path d="M2 2.5A1.5 1.5 0 0 1 3.5 1h7A1.5 1.5 0 0 1 12 2.5v11.086a.5.5 0 0 1-.79.407L8 12.06l-3.21 1.933a.5.5 0 0 1-.79-.407V2.5Zm1.5-.5a.5.5 0 0 0-.5.5v10.396l2.71-1.63a.5.5 0 0 1 .58 0l2.71 1.63V2.5a.5.5 0 0 0-.5-.5h-5Z" />
      <path d="M13 4a1 1 0 0 1 1 1v9.5a.5.5 0 0 1-.79.407L10.5 13" opacity="0.5" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg
      viewBox="0 0 16 16"
      width="14"
      height="14"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <path d="M8 3v10M3 8h10" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg
      viewBox="0 0 16 16"
      width="14"
      height="14"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M13.5 4.5 6 12 2.5 8.5" />
    </svg>
  );
}

function AlertIcon() {
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor" aria-hidden="true">
      <path d="M8 1a.75.75 0 0 1 .671.415l6.5 13a.75.75 0 0 1-.671 1.085H1.5a.75.75 0 0 1-.671-1.085l6.5-13A.75.75 0 0 1 8 1Zm0 4a.75.75 0 0 0-.75.75v3.5a.75.75 0 0 0 1.5 0v-3.5A.75.75 0 0 0 8 5Zm0 6.5a.875.875 0 1 0 0 1.75.875.875 0 0 0 0-1.75Z" />
    </svg>
  );
}

function ArrowIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 16 16"
      width="14"
      height="14"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <path d="M6 4l4 4-4 4" />
    </svg>
  );
}
