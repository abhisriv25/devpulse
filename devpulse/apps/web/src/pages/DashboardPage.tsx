import { useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { logout } from "../lib/api";
import { useCurrentUser } from "../lib/use-current-user";
import { useRepositories } from "../lib/use-repositories";

export function DashboardPage() {
  const { data: user } = useCurrentUser();
  const { data: repoData } = useRepositories();
  const queryClient = useQueryClient();
  const repoCount = repoData?.repositories.length ?? 0;

  if (!user) return null; // ProtectedRoute already handles the loading/redirect cases

  const primaryOrg = user.organizations[0];

  async function handleLogout() {
    await logout();
    // Drop the cached /me response so the next render re-checks auth state
    // instead of showing stale "logged in" UI for a moment.
    queryClient.removeQueries({ queryKey: ["currentUser"] });
    window.location.href = "/login";
  }

  return (
    <div className="min-h-screen">
      <header className="flex items-center justify-between border-b border-slate-800 px-6 py-4">
        <span className="text-lg font-semibold tracking-tight">DevPulse</span>
        <div className="flex items-center gap-3">
          {user.avatarUrl && (
            <img src={user.avatarUrl} alt="" className="h-7 w-7 rounded-full" />
          )}
          <span className="text-sm text-slate-300">{user.githubLogin}</span>
          <button
            onClick={handleLogout}
            className="rounded-md border border-slate-700 px-3 py-1.5 text-xs text-slate-300 transition hover:bg-slate-800"
          >
            Sign out
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-12">
        <h1 className="text-xl font-semibold">
          Welcome, {user.displayName ?? user.githubLogin}.
        </h1>

        {primaryOrg ? (
          <p className="mt-2 text-sm text-slate-400">
            Signed in to <span className="text-slate-200">{primaryOrg.name}</span> as{" "}
            <span className="text-slate-200">{primaryOrg.role}</span>.
          </p>
        ) : (
          <p className="mt-2 text-sm text-slate-400">No organization found for this account.</p>
        )}

        <div className="mt-10 flex items-center justify-between rounded-lg border border-slate-800 p-6">
          <div>
            <p className="text-sm text-slate-200">
              {repoCount === 0
                ? "No repositories connected yet."
                : `${repoCount} ${repoCount === 1 ? "repository" : "repositories"} connected.`}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Highest-risk open PRs will show up here once sync (Slice 3+) is built.
            </p>
          </div>
          <Link
            to="/repositories"
            className="shrink-0 rounded-md border border-slate-700 px-3 py-1.5 text-xs text-slate-300 transition hover:bg-slate-800"
          >
            Manage repositories
          </Link>
        </div>
      </main>
    </div>
  );
}
