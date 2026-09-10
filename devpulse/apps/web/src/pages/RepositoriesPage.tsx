import { Link, useSearchParams } from "react-router-dom";
import { githubInstallUrl } from "../lib/api";
import { useRepositories } from "../lib/use-repositories";

const ERROR_MESSAGES: Record<string, string> = {
  invalid_callback: "GitHub didn't send back what we expected. Please try connecting again.",
  invalid_state: "That connection request expired or was already used. Please try again.",
  install_failed: "We couldn't finish syncing your repositories. Please try again.",
};

export function RepositoriesPage() {
  const [searchParams] = useSearchParams();
  const { data, isLoading, isError } = useRepositories();

  const justConnected = searchParams.get("connected") === "1";
  const errorCode = searchParams.get("error");
  const errorMessage = errorCode ? ERROR_MESSAGES[errorCode] ?? "Something went wrong. Please try again." : null;

  const repositories = data?.repositories ?? [];

  return (
    <div className="min-h-screen">
      <header className="flex items-center justify-between border-b border-slate-800 px-6 py-4">
        <Link to="/" className="text-lg font-semibold tracking-tight">
          DevPulse
        </Link>
        <Link to="/" className="text-sm text-slate-400 hover:text-slate-200">
          ← Dashboard
        </Link>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-12">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold">Repositories</h1>
          <a
            href={githubInstallUrl()}
            className="rounded-md bg-slate-100 px-4 py-2 text-sm font-medium text-slate-900 transition hover:bg-white"
          >
            Connect repository
          </a>
        </div>

        {justConnected && (
          <p className="mt-4 rounded-md bg-emerald-950 px-3 py-2 text-sm text-emerald-300">
            Repositories connected.
          </p>
        )}
        {errorMessage && (
          <p className="mt-4 rounded-md bg-red-950 px-3 py-2 text-sm text-red-300">{errorMessage}</p>
        )}

        <div className="mt-8">
          {isLoading && <p className="text-sm text-slate-500">Loading…</p>}

          {isError && <p className="text-sm text-red-400">Couldn't load repositories.</p>}

          {!isLoading && !isError && repositories.length === 0 && (
            <div className="rounded-lg border border-dashed border-slate-800 p-6 text-sm text-slate-500">
              No repositories connected yet. Click "Connect repository" to install the DevPulse GitHub App
              and choose which repos to sync.
            </div>
          )}

          {repositories.length > 0 && (
            <ul className="divide-y divide-slate-800 rounded-lg border border-slate-800">
              {repositories.map((repo) => (
                <li key={repo.id} className="flex items-center justify-between px-4 py-3">
                  <Link to={`/repositories/${repo.id}/pulls`} className="text-sm text-slate-200 hover:underline">
                    {repo.fullName}
                  </Link>
                  {repo.private && (
                    <span className="rounded-full border border-slate-700 px-2 py-0.5 text-xs text-slate-400">
                      Private
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </main>
    </div>
  );
}
