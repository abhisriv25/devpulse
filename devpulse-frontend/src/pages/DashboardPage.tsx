import { useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { logout } from "../lib/api";
import { RiskBadge } from "../components/RiskBadge";
import { EmptyState, ErrorState } from "../components/StatusStates";
import { useCurrentUser } from "../lib/use-current-user";
import { useRepositories } from "../lib/use-repositories";
import { usePullRequests } from "../lib/use-pull-requests";
import type { PullRequestListItem, RiskLevel } from "../lib/api";

const RISK_RANK: Record<RiskLevel, number> = { CRITICAL: 3, HIGH: 2, MEDIUM: 1, LOW: 0 };

export function DashboardPage() {
  const { data: user } = useCurrentUser();
  const { data: repoData, isLoading: reposLoading, isError: reposError, refetch: refetchRepos } = useRepositories();
  const { data: prData, isLoading: prsLoading, isError: prsError, refetch: refetchPrs } = usePullRequests();
  const queryClient = useQueryClient();

  if (!user) return null; // ProtectedRoute already handles the loading/redirect cases

  const primaryOrg = user.organizations[0];
  const repositories = repoData?.repositories ?? [];
  const pullRequests = prData?.pullRequests ?? [];
  const openPrs = pullRequests.filter((pr) => pr.state === "open");

  const riskCounts = openPrs.reduce(
    (acc, pr) => {
      const level = pr.latestRisk?.level;
      if (level) acc[level] += 1;
      return acc;
    },
    { LOW: 0, MEDIUM: 0, HIGH: 0, CRITICAL: 0 } as Record<RiskLevel, number>,
  );
  const needsAttention = riskCounts.HIGH + riskCounts.CRITICAL;

  const topRiskPrs = [...openPrs]
    .filter((pr) => pr.latestRisk)
    .sort((a, b) => RISK_RANK[b.latestRisk!.level] - RISK_RANK[a.latestRisk!.level] || b.latestRisk!.score - a.latestRisk!.score)
    .slice(0, 5);

  async function handleLogout() {
    await logout();
    queryClient.removeQueries({ queryKey: ["currentUser"] });
    window.location.href = "/login";
  }

  return (
    <div className="relative min-h-screen bg-[#05070d]">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-40 right-[-10rem] h-[30rem] w-[30rem] animate-blob-drift-slow rounded-full bg-emerald-500/10 blur-[130px] motion-reduce:animate-none" />
        <div className="absolute left-[-10rem] top-1/3 h-[26rem] w-[26rem] animate-blob-drift rounded-full bg-indigo-500/10 blur-[120px] motion-reduce:animate-none" />
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage:
              "linear-gradient(to right, white 1px, transparent 1px), linear-gradient(to bottom, white 1px, transparent 1px)",
            backgroundSize: "48px 48px",
            maskImage: "radial-gradient(ellipse 80% 50% at 50% 0%, black 20%, transparent 90%)",
          }}
        />
      </div>

      <header className="sticky top-0 z-10 border-b border-slate-800/80 bg-slate-950/70 px-6 py-4 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <div className="flex items-center gap-2">
            <PulseMark className="h-5 w-5 text-emerald-400" />
            <span className="text-lg font-semibold tracking-tight text-white">DevPulse</span>
          </div>
          <nav className="hidden items-center gap-1 sm:flex">
            <NavLink to="/" active>
              Dashboard
            </NavLink>
            <NavLink to="/repositories">Repositories</NavLink>
          </nav>
          <div className="flex items-center gap-3">
            {user.avatarUrl && (
              <img
                src={user.avatarUrl}
                alt=""
                className="h-7 w-7 rounded-full ring-2 ring-slate-700 transition-all duration-300 hover:ring-emerald-400/60"
              />
            )}
            <span className="hidden text-sm text-slate-300 sm:inline">{user.githubLogin}</span>
            <button
              onClick={handleLogout}
              className="rounded-md border border-slate-700 px-3 py-1.5 text-xs text-slate-300 transition-all duration-200 hover:-translate-y-0.5 hover:border-slate-600 hover:bg-slate-800"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      <main className="relative mx-auto max-w-6xl px-6 py-10">
        <div className="animate-fade-in-up">
          <h1 className="text-2xl font-semibold text-white">
            Welcome back, {user.displayName ?? user.githubLogin}.
          </h1>
          {primaryOrg ? (
            <p className="mt-1.5 text-sm text-slate-400">
              Signed in to <span className="text-slate-200">{primaryOrg.name}</span> as{" "}
              <span className="text-slate-200">{primaryOrg.role}</span>
            </p>
          ) : (
            <p className="mt-1.5 text-sm text-slate-400">No organization found for this account.</p>
          )}
        </div>

        {/* Stat row */}
        <div className="mt-8 grid animate-fade-in-up grid-cols-2 gap-4 [animation-delay:80ms] sm:grid-cols-4">
          <StatCard
            icon={<RepoIcon />}
            label="Repositories"
            value={reposLoading ? "—" : repositories.length}
            accent="emerald"
          />
          <StatCard
            icon={<PrIcon />}
            label="Open pull requests"
            value={prsLoading ? "—" : openPrs.length}
            accent="indigo"
          />
          <StatCard
            icon={<AlertIcon />}
            label="Needs attention"
            value={prsLoading ? "—" : needsAttention}
            accent={needsAttention > 0 ? "rose" : "slate"}
          />
          <StatCard
            icon={<CheckIcon />}
            label="Low risk"
            value={prsLoading ? "—" : riskCounts.LOW}
            accent="slate"
          />
        </div>

        <div className="mt-8 grid animate-fade-in-up grid-cols-1 gap-6 [animation-delay:140ms] lg:grid-cols-[minmax(0,1fr)_20rem]">
          {/* Highest-risk PRs */}
          <section className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900/40 shadow-lg shadow-black/20">
            <div className="flex items-center justify-between border-b border-slate-800/80 px-5 py-4">
              <h2 className="text-sm font-semibold text-slate-200">Highest-risk open PRs</h2>
              {pullRequests.length > 0 && (
                <Link
                  to={repositories[0] ? `/repositories/${repositories[0].id}/pulls` : "/repositories"}
                  className="text-xs text-slate-500 transition-colors hover:text-emerald-300"
                >
                  View all →
                </Link>
              )}
            </div>

            {prsLoading ? (
              <div className="space-y-3 p-5">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="h-14 animate-pulse rounded-lg bg-slate-800/40" />
                ))}
              </div>
            ) : prsError ? (
              <ErrorState
                description="We couldn't reach the pull requests service."
                onRetry={() => refetchPrs()}
              />
            ) : topRiskPrs.length === 0 ? (
              <EmptyState
                title={repositories.length === 0 ? "No repositories connected yet" : "No risk-scored PRs yet"}
                description={
                  repositories.length === 0
                    ? "Connect a repository to start surfacing which PRs deserve a closer look."
                    : "Open a pull request on a connected repo, or check back after the next sync."
                }
              />
            ) : (
              <ul className="divide-y divide-slate-800/60">
                {topRiskPrs.map((pr, i) => (
                  <PrRow key={pr.id} pr={pr} delay={i * 60} />
                ))}
              </ul>
            )}
          </section>

          {/* Repositories side panel */}
          <section className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900/40 shadow-lg shadow-black/20">
            <div className="flex items-center justify-between border-b border-slate-800/80 px-5 py-4">
              <h2 className="text-sm font-semibold text-slate-200">Repositories</h2>
              <Link
                to="/repositories"
                className="text-xs text-slate-500 transition-colors hover:text-emerald-300"
              >
                Manage →
              </Link>
            </div>

            {reposLoading ? (
              <div className="space-y-3 p-5">
                {[0, 1].map((i) => (
                  <div key={i} className="h-10 animate-pulse rounded-lg bg-slate-800/40" />
                ))}
              </div>
            ) : reposError ? (
              <ErrorState
                description="We couldn't reach the repositories service."
                onRetry={() => refetchRepos()}
              />
            ) : repositories.length === 0 ? (
              <div className="p-5">
                <EmptyState
                  title="Nothing connected"
                  description="Install the GitHub App on a repo to get started."
                  compact
                />
                <Link
                  to="/repositories"
                  className="mt-4 flex items-center justify-center gap-1.5 rounded-md border border-slate-700 px-3 py-2 text-xs text-slate-300 transition-all duration-200 hover:-translate-y-0.5 hover:border-slate-600 hover:bg-slate-800 hover:text-white"
                >
                  Connect repository
                  <ArrowIcon />
                </Link>
              </div>
            ) : (
              <ul className="divide-y divide-slate-800/60">
                {repositories.slice(0, 6).map((repo) => (
                  <li key={repo.id}>
                    <Link
                      to={`/repositories/${repo.id}/pulls`}
                      className="flex items-center gap-2.5 px-5 py-3 text-sm transition-colors hover:bg-slate-800/40"
                    >
                      <RepoIcon className="h-3.5 w-3.5 shrink-0 text-slate-500" />
                      <span className="truncate text-slate-300">{repo.fullName}</span>
                      {repo.private && (
                        <span className="ml-auto shrink-0 text-[10px] uppercase tracking-wide text-slate-600">
                          Private
                        </span>
                      )}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}

function NavLink({ to, active, children }: { to: string; active?: boolean; children: React.ReactNode }) {
  return (
    <Link
      to={to}
      className={`rounded-md px-3 py-1.5 text-sm transition-colors ${
        active ? "bg-slate-800/80 text-white" : "text-slate-400 hover:text-slate-200"
      }`}
    >
      {children}
    </Link>
  );
}

function StatCard({
  icon,
  label,
  value,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  accent: "emerald" | "indigo" | "rose" | "slate";
}) {
  const accentStyles: Record<typeof accent, string> = {
    emerald: "bg-emerald-500/10 text-emerald-400",
    indigo: "bg-indigo-500/10 text-indigo-400",
    rose: "bg-rose-500/10 text-rose-400",
    slate: "bg-slate-500/10 text-slate-400",
  };

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4 shadow-lg shadow-black/10 transition-all duration-300 hover:-translate-y-0.5 hover:border-slate-700">
      <div className="flex items-center gap-2.5">
        <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${accentStyles[accent]}`}>
          {icon}
        </span>
        <span className="text-xs text-slate-500">{label}</span>
      </div>
      <p className="mt-3 text-2xl font-semibold text-white">{value}</p>
    </div>
  );
}

function PrRow({ pr, delay }: { pr: PullRequestListItem; delay: number }) {
  return (
    <li
      className="animate-fade-in motion-reduce:animate-none"
      style={{ animationDelay: `${delay}ms` }}
    >
      <Link
        to={`/pulls/${pr.id}`}
        className="flex items-center justify-between gap-4 px-5 py-3.5 transition-colors hover:bg-slate-800/40"
      >
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-slate-200">
            <span className="text-slate-500">#{pr.number}</span> {pr.title}
          </p>
          <p className="mt-1 truncate text-xs text-slate-500">
            {pr.repository.fullName} &middot; {pr.author}
          </p>
        </div>
        {pr.latestRisk && (
          <RiskBadge level={pr.latestRisk.level} score={pr.latestRisk.score} />
        )}
      </Link>
    </li>
  );
}

function PulseMark({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className={className}>
      <circle cx="12" cy="12" r="10" className="stroke-current" strokeWidth="1.5" opacity="0.25" />
      <path
        d="M3 12h4l2-5 4 10 2-5h6"
        className="stroke-current"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
}

function RepoIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor" aria-hidden="true" className={className}>
      <path d="M2 2.5A1.5 1.5 0 0 1 3.5 1h7A1.5 1.5 0 0 1 12 2.5v11.086a.5.5 0 0 1-.79.407L8 12.06l-3.21 1.933a.5.5 0 0 1-.79-.407V2.5Zm1.5-.5a.5.5 0 0 0-.5.5v10.396l2.71-1.63a.5.5 0 0 1 .58 0l2.71 1.63V2.5a.5.5 0 0 0-.5-.5h-5Z" />
      <path d="M13 4a1 1 0 0 1 1 1v9.5a.5.5 0 0 1-.79.407L10.5 13" opacity="0.5" />
    </svg>
  );
}

function PrIcon() {
  return (
    <svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor" aria-hidden="true">
      <path d="M4.75 1.5a.75.75 0 0 1 .75.75v.5a.75.75 0 0 1-1.5 0v-.5a.75.75 0 0 1 .75-.75Zm0 4a2.25 2.25 0 1 0 0 4.5 2.25 2.25 0 0 0 0-4.5ZM3 7.75a1.75 1.75 0 1 1 3.5 0 1.75 1.75 0 0 1-3.5 0Zm8.25-6.25a.75.75 0 0 1 .75.75v6.75a2.251 2.251 0 1 1-1.5 0V4.372a3.751 3.751 0 0 1-2.5 3.535V13a.75.75 0 0 1-1.5 0V6.5h1a2.25 2.25 0 0 0 2.25-2.25V2a.75.75 0 0 1 .75-.75Zm.75 9.75a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5Z" />
    </svg>
  );
}

function AlertIcon() {
  return (
    <svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor" aria-hidden="true">
      <path d="M8 1a.75.75 0 0 1 .671.415l6.5 13a.75.75 0 0 1-.671 1.085H1.5a.75.75 0 0 1-.671-1.085l6.5-13A.75.75 0 0 1 8 1Zm0 4a.75.75 0 0 0-.75.75v3.5a.75.75 0 0 0 1.5 0v-3.5A.75.75 0 0 0 8 5Zm0 6.5a.875.875 0 1 0 0 1.75.875.875 0 0 0 0-1.75Z" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg
      viewBox="0 0 16 16"
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M13.5 4.5 6 12 2.5 8.5" />
    </svg>
  );
}

function ArrowIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 16 16"
      width="12"
      height="12"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <path d="M3 8h10M9 4l4 4-4 4" />
    </svg>
  );
}
