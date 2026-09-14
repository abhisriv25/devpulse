import { useSearchParams } from "react-router-dom";
import { githubLoginUrl } from "../lib/api";

const PREVIEW_PULLS = [
  {
    number: 482,
    title: "Rework session refresh to avoid token race",
    author: "priyaverma",
    risk: "HIGH" as const,
    reason: "Sensitive path + no test files",
  },
  {
    number: 479,
    title: "Add pagination to /pull-requests",
    author: "jrs-dev",
    risk: "MEDIUM" as const,
    reason: "38 files changed",
  },
  {
    number: 477,
    title: "Fix typo in onboarding email copy",
    author: "kwan-oss",
    risk: "LOW" as const,
    reason: "No rules triggered",
  },
];

const RISK_STYLES = {
  HIGH: "border-rose-400/30 bg-rose-500/10 text-rose-300",
  MEDIUM: "border-amber-400/30 bg-amber-500/10 text-amber-300",
  LOW: "border-emerald-400/30 bg-emerald-500/10 text-emerald-300",
} as const;

export function LoginPage() {
  const [searchParams] = useSearchParams();
  const oauthFailed = searchParams.get("error") === "oauth_failed";

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#05070d] text-slate-100">
      {/* Ambient background: soft drifting glow + faint grid, both purely
          decorative and disabled for users who prefer reduced motion. */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute left-[8%] top-[-10%] h-[34rem] w-[34rem] animate-blob-drift rounded-full bg-emerald-500/15 blur-[130px] motion-reduce:animate-none" />
        <div className="absolute right-[-10%] top-[30%] h-[28rem] w-[28rem] animate-blob-drift-slow rounded-full bg-indigo-500/15 blur-[120px] motion-reduce:animate-none" />
        <div
          className="absolute inset-0 opacity-[0.05]"
          style={{
            backgroundImage:
              "linear-gradient(to right, white 1px, transparent 1px), linear-gradient(to bottom, white 1px, transparent 1px)",
            backgroundSize: "48px 48px",
            maskImage: "radial-gradient(ellipse 70% 60% at 30% 40%, black 30%, transparent 100%)",
          }}
        />
      </div>

      <div className="relative mx-auto flex min-h-screen max-w-6xl flex-col">
        <header className="flex items-center gap-2 px-6 pt-8 sm:px-10">
          <PulseMark className="h-6 w-6 text-emerald-400" />
          <span className="text-sm font-semibold tracking-wide text-slate-200">DevPulse</span>
        </header>

        <main className="grid flex-1 grid-cols-1 items-center gap-16 px-6 py-12 sm:px-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:py-0">
          {/* Left: brand + sign in */}
          <div className="mx-auto w-full max-w-sm animate-fade-in-up lg:mx-0 motion-reduce:animate-none">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/20 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-300">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75 motion-reduce:animate-none" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
              </span>
              Connected to GitHub
            </span>

            <h1 className="mt-5 text-4xl font-semibold tracking-tight text-white sm:text-5xl">
              Which PRs deserve attention,{" "}
              <span className="bg-gradient-to-r from-emerald-300 to-teal-200 bg-clip-text text-transparent">
                and why.
              </span>
            </h1>

            <p className="mt-4 text-[15px] leading-relaxed text-slate-400">
              DevPulse scores every pull request against your codebase's real risk
              signals and its own docs — so review time goes where it actually
              matters.
            </p>

            {oauthFailed && (
              <p className="mt-6 animate-shake rounded-md border border-red-900/60 bg-red-950/80 px-3 py-2 text-sm text-red-300">
                Sign-in failed. Please try again.
              </p>
            )}

            <a
              href={githubLoginUrl()}
              className="group relative mt-8 flex w-full max-w-xs items-center justify-center gap-2 overflow-hidden rounded-md bg-slate-100 px-4 py-2.5 text-sm font-medium text-slate-900 shadow-lg shadow-black/20 transition-all duration-300 will-change-transform hover:-translate-y-0.5 hover:bg-white hover:shadow-emerald-500/20 hover:shadow-xl active:translate-y-0 active:scale-[0.98]"
            >
              <span className="pointer-events-none absolute inset-0 -z-0">
                <span className="absolute inset-y-0 left-0 w-1/3 -skew-x-12 bg-gradient-to-r from-transparent via-white/60 to-transparent opacity-0 transition-opacity duration-300 group-hover:animate-shine group-hover:opacity-100" />
              </span>
              <GithubMark className="relative transition-transform duration-300 group-hover:-rotate-12" />
              <span className="relative">Sign in with GitHub</span>
            </a>

            <p className="mt-4 flex items-center gap-1.5 text-xs text-slate-500">
              <LockMark />
              Secured with GitHub OAuth &middot; read-only access
            </p>
          </div>

          {/* Right: live-feeling product preview */}
          <div
            className="relative mx-auto w-full max-w-md animate-fade-in-up motion-reduce:animate-none [animation-delay:120ms]"
            aria-hidden="true"
          >
            <div className="absolute -inset-4 -z-10 rounded-[28px] bg-gradient-to-br from-emerald-500/10 via-transparent to-indigo-500/10 blur-2xl" />
            <div className="overflow-hidden rounded-2xl border border-slate-800/80 bg-slate-900/60 shadow-2xl shadow-black/50 backdrop-blur-xl">
              <div className="flex items-center justify-between border-b border-slate-800/80 px-4 py-3">
                <div className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-slate-700" />
                  <span className="h-2.5 w-2.5 rounded-full bg-slate-700" />
                  <span className="h-2.5 w-2.5 rounded-full bg-slate-700" />
                </div>
                <span className="text-xs font-medium text-slate-500">acme/api &middot; pulls</span>
              </div>

              <ul className="divide-y divide-slate-800/60">
                {PREVIEW_PULLS.map((pr, i) => (
                  <li
                    key={pr.number}
                    className="animate-fade-in px-4 py-3.5 motion-reduce:animate-none"
                    style={{ animationDelay: `${240 + i * 120}ms` }}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-slate-200">
                          <span className="text-slate-500">#{pr.number}</span> {pr.title}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          {pr.author} &middot; {pr.reason}
                        </p>
                      </div>
                      <span
                        className={`shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${RISK_STYLES[pr.risk]}`}
                      >
                        {pr.risk}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>

              <div className="border-t border-slate-800/80 bg-slate-950/40 px-4 py-3 text-center text-xs text-slate-500">
                Scored on open &middot; explained on click
              </div>
            </div>
          </div>
        </main>

        <footer className="px-6 pb-8 pt-4 text-center text-xs text-slate-600 sm:px-10 sm:text-left">
          DevPulse reads pull request metadata and repository docs you connect. Nothing is shared with third parties.
        </footer>
      </div>
    </div>
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

function GithubMark({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" width="18" height="18" fill="currentColor" aria-hidden="true" className={className}>
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38
        0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13
        -.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66
        .07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15
        -.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0
        1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82
        1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01
        1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8z"
      />
    </svg>
  );
}

function LockMark() {
  return (
    <svg viewBox="0 0 16 16" width="12" height="12" fill="currentColor" aria-hidden="true">
      <path d="M4 6.5V4.5a4 4 0 1 1 8 0v2h.5A1.5 1.5 0 0 1 14 8v6a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 2 14V8a1.5 1.5 0 0 1 1.5-1.5H4Zm1.5-2v2h5v-2a2.5 2.5 0 0 0-5 0Z" />
    </svg>
  );
}
