import { Link, useSearchParams } from "react-router-dom";
import { AlertIcon, DatabaseIcon, FlaskIcon, GithubIcon, LockIcon, ShieldCheckIcon, SparkleIcon } from "../components/icons";
import { PublicLayout } from "../components/PublicLayout";
import { RiskBadge, ScoreRing } from "../components/risk";
import { Banner, buttonClasses } from "../components/ui";
import { githubLoginUrl, type RiskLevel } from "../lib/api";

const PREVIEW_PULLS: { number: number; title: string; author: string; risk: RiskLevel; score: number }[] = [
  { number: 479, title: "Add pagination to /pull-requests", author: "jrs-dev", risk: "MEDIUM", score: 30 },
  { number: 481, title: "Bump eslint to 9.12", author: "priyaverma", risk: "LOW", score: 10 },
  { number: 477, title: "Fix typo in onboarding email copy", author: "kwan-oss", risk: "LOW", score: 0 },
];

const FEATURES = [
  { icon: ShieldCheckIcon, title: "Scored on open", text: "Every PR gets a 0–100 risk score the moment it's opened." },
  { icon: SparkleIcon, title: "Explained, not guessed", text: "See exactly which files and rules drove the score." },
  { icon: LockIcon, title: "Read-only by design", text: "A GitHub App with read access to the repos you choose." },
];

export function LoginPage() {
  const [searchParams] = useSearchParams();
  const oauthFailed = searchParams.get("error") === "oauth_failed";

  return (
    <PublicLayout backdrop={<LandingBackdrop />}>
    <main className="mx-auto grid min-h-[calc(100vh-11rem)] max-w-6xl grid-cols-1 items-center gap-14 px-6 py-14 sm:px-10 lg:grid-cols-2 lg:gap-20">
      <div className="mx-auto w-full max-w-md animate-fade-in-up lg:mx-0">
        <p className="inline-flex items-center gap-2 rounded-full border border-line-strong bg-white/[0.03] px-3 py-1 text-xs font-medium text-slate-300">
          <span className="relative flex size-1.5">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex size-1.5 rounded-full bg-emerald-400" />
          </span>
          Pull request risk, at a glance
        </p>

        <h1 className="mt-6 text-4xl font-semibold leading-[1.1] tracking-tight text-white sm:text-5xl">
          Review what matters.{" "}
          <span className="bg-gradient-to-r from-emerald-300 via-teal-200 to-sky-300 bg-clip-text text-transparent">
            Skim the rest.
          </span>
        </h1>

        <p className="mt-5 text-base leading-relaxed text-slate-400">
          DevPulse scores every pull request against real risk signals — sensitive code, migrations,
          dependencies, missing tests — so your team spends review time where it counts.
        </p>

        {oauthFailed && (
          <div className="mt-6">
            <Banner tone="error">
              <AlertIcon size={15} /> Sign-in didn't complete. Please try again.
            </Banner>
          </div>
        )}

        <a
          href={githubLoginUrl()}
          className={buttonClasses("primary", "md", "group mt-8 h-11 w-full px-5 text-[15px] sm:w-auto")}
        >
          <GithubIcon size={17} />
          Continue with GitHub
          <span className="transition-transform group-hover:translate-x-0.5" aria-hidden="true">→</span>
        </a>

        <p className="mt-3 flex items-center gap-1.5 text-xs text-slate-500">
          <LockIcon size={12} />
          Read-only access. See what we store in our{" "}
          <Link to="/privacy" className="text-slate-300 underline decoration-slate-600 underline-offset-2 hover:text-white">
            privacy policy
          </Link>
        </p>

        <ul className="mt-10 space-y-4">
          {FEATURES.map(({ icon: Icon, title, text }) => (
            <li key={title} className="flex gap-3">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-line bg-white/[0.03] text-slate-300">
                <Icon size={15} />
              </span>
              <div>
                <p className="text-sm font-medium text-slate-200">{title}</p>
                <p className="text-[13px] text-slate-500">{text}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>

      <ProductPreview />
    </main>
    </PublicLayout>
  );
}

function LandingBackdrop() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      <div className="absolute left-[5%] top-[-15%] h-[36rem] w-[36rem] animate-blob-drift rounded-full bg-emerald-500/[0.12] blur-[140px]" />
      <div className="absolute right-[-8%] top-[35%] h-[30rem] w-[30rem] animate-blob-drift-slow rounded-full bg-indigo-500/[0.12] blur-[130px]" />
      <div
        className="absolute inset-0 opacity-[0.05]"
        style={{
          backgroundImage:
            "linear-gradient(to right, white 1px, transparent 1px), linear-gradient(to bottom, white 1px, transparent 1px)",
          backgroundSize: "56px 56px",
          maskImage: "radial-gradient(ellipse 70% 60% at 30% 40%, black 30%, transparent 100%)",
          WebkitMaskImage: "radial-gradient(ellipse 70% 60% at 30% 40%, black 30%, transparent 100%)",
        }}
      />
    </div>
  );
}

function ProductPreview() {
  return (
    <div className="relative mx-auto w-full max-w-md animate-fade-in-up [animation-delay:120ms]" aria-hidden="true">
      <div className="absolute -inset-6 -z-10 rounded-[32px] bg-gradient-to-br from-emerald-500/15 via-transparent to-indigo-500/15 blur-2xl" />

      <div className="overflow-hidden rounded-2xl border border-line-strong bg-surface/80 shadow-2xl shadow-black/60 backdrop-blur-xl">
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <div className="flex gap-1.5">
            <span className="size-2.5 rounded-full bg-white/10" />
            <span className="size-2.5 rounded-full bg-white/10" />
            <span className="size-2.5 rounded-full bg-white/10" />
          </div>
          <span className="font-mono text-[11px] text-slate-500">acme/api · review queue</span>
        </div>

        <div className="flex items-center gap-5 border-b border-line p-5">
          <ScoreRing score={60} level="HIGH" size={96} stroke={8} />
          <div className="min-w-0">
            <p className="text-xs text-slate-500">#482 · priyaverma</p>
            <p className="mt-1 text-sm font-medium leading-snug text-slate-100">Rework session refresh to avoid token race</p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              <SignalChip icon={<LockIcon size={11} />} label="auth/" />
              <SignalChip icon={<DatabaseIcon size={11} />} label="migration" />
              <SignalChip icon={<FlaskIcon size={11} />} label="no tests" />
            </div>
          </div>
        </div>

        <ul className="divide-y divide-line">
          {PREVIEW_PULLS.map((pr, i) => (
            <li
              key={pr.number}
              className="flex animate-fade-in items-center justify-between gap-3 px-4 py-3"
              style={{ animationDelay: `${300 + i * 120}ms` }}
            >
              <div className="min-w-0">
                <p className="truncate text-sm text-slate-200">{pr.title}</p>
                <p className="mt-0.5 font-mono text-[11px] text-slate-500">
                  #{pr.number} · {pr.author}
                </p>
              </div>
              <RiskBadge level={pr.risk} score={pr.score} size="sm" />
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function SignalChip({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-md bg-orange-400/10 px-1.5 py-0.5 font-mono text-[11px] text-orange-200 ring-1 ring-inset ring-orange-400/20">
      {icon}
      {label}
    </span>
  );
}
