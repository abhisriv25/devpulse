import type { ReactNode } from "react";
import { PublicLayout } from "../components/PublicLayout";
import {
  FileIcon,
  GithubIcon,
  GlobeIcon,
  LinkedInIcon,
  MailIcon,
  PullRequestIcon,
  RepoIcon,
  ShieldCheckIcon,
  XIcon,
} from "../components/icons";
import { buttonClasses, cx } from "../components/ui";
import { githubLoginUrl } from "../lib/api";
import { CREATORS, SITE, type Creator, type CreatorLinks } from "../lib/site";

const STEPS = [
  {
    icon: <RepoIcon size={16} />,
    title: "Connect",
    text: "Install the read-only GitHub App on the repositories you want DevPulse to watch.",
  },
  {
    icon: <PullRequestIcon size={16} />,
    title: "Score",
    text: "Every pull request is scored 0–100 the moment it opens, from signals like sensitive paths, migrations, dependencies and missing tests.",
  },
  {
    icon: <ShieldCheckIcon size={16} />,
    title: "Review",
    text: "Your team sees which PRs need a careful look — and exactly why — so review time goes where it matters.",
  },
];

const STACK = ["React", "TypeScript", "Tailwind CSS", "Node.js", "Express", "PostgreSQL + pgvector", "Redis", "AWS", "Vercel"];

/** Links always shown on a creator card, even before they're filled in. */
const PRIMARY_LINKS: { key: keyof CreatorLinks; label: string; icon: ReactNode }[] = [
  { key: "linkedin", label: "LinkedIn", icon: <LinkedInIcon size={14} /> },
  { key: "x", label: "X", icon: <XIcon size={13} /> },
  { key: "github", label: "GitHub", icon: <GithubIcon size={14} /> },
  { key: "resume", label: "Resume", icon: <FileIcon size={14} /> },
];

/** Extra links shown only once they have a value. */
const OPTIONAL_LINKS: { key: keyof CreatorLinks; label: string; icon: ReactNode }[] = [
  { key: "website", label: "Website", icon: <GlobeIcon size={14} /> },
  { key: "email", label: "Email", icon: <MailIcon size={14} /> },
];

export function AboutPage() {
  return (
    <PublicLayout>
      <main className="mx-auto max-w-5xl px-6 pb-20 pt-14 sm:px-10 sm:pt-20">
        {/* Intro */}
        <section className="mx-auto max-w-2xl animate-fade-in-up text-center">
          <p className="text-xs font-medium uppercase tracking-wider text-emerald-300">About DevPulse</p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight text-white sm:text-5xl">
            Calmer code reviews,{" "}
            <span className="bg-gradient-to-r from-emerald-300 via-teal-200 to-sky-300 bg-clip-text text-transparent">
              by design.
            </span>
          </h1>
          <p className="mt-5 text-base leading-relaxed text-slate-400 sm:text-lg">
            Not every pull request deserves the same attention. A typo fix and an auth rewrite shouldn't wait in the
            same queue. DevPulse scores each PR by risk so reviewers can skim the routine and focus on the changes
            that can actually hurt.
          </p>
        </section>

        {/* How it works */}
        <section className="mt-16 animate-fade-in-up [animation-delay:60ms]" aria-labelledby="how-it-works">
          <h2 id="how-it-works" className="text-center text-sm font-medium text-slate-400">
            How it works
          </h2>
          <ol className="mt-6 grid gap-4 md:grid-cols-3">
            {STEPS.map((step, i) => (
              <li key={step.title} className="relative rounded-xl border border-line bg-surface p-5 shadow-card">
                <div className="flex items-center justify-between">
                  <span className="flex size-9 items-center justify-center rounded-lg bg-emerald-400/10 text-emerald-300">
                    {step.icon}
                  </span>
                  <span className="font-mono text-xs text-slate-600">0{i + 1}</span>
                </div>
                <h3 className="mt-4 text-base font-medium text-white">{step.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-slate-400">{step.text}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* Team */}
        <section className="mt-20 animate-fade-in-up [animation-delay:120ms]" aria-labelledby="team">
          <div className="text-center">
            <h2 id="team" className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">
              Made by
            </h2>
            <p className="mt-2 text-sm text-slate-400">The people who built DevPulse.</p>
          </div>
          <ul className="mx-auto mt-8 grid max-w-3xl gap-5 sm:grid-cols-2">
            {CREATORS.map((creator) => (
              <CreatorCard key={creator.name} creator={creator} />
            ))}
          </ul>
        </section>

        {/* Stack */}
        <section className="mx-auto mt-20 max-w-3xl text-center" aria-labelledby="stack">
          <h2 id="stack" className="text-sm font-medium text-slate-400">
            Built with
          </h2>
          <ul className="mt-4 flex flex-wrap justify-center gap-2">
            {STACK.map((tech) => (
              <li
                key={tech}
                className="rounded-full border border-line bg-white/[0.02] px-3 py-1 text-xs text-slate-300"
              >
                {tech}
              </li>
            ))}
          </ul>
        </section>

        {/* CTA */}
        <section className="relative mx-auto mt-20 max-w-3xl overflow-hidden rounded-2xl border border-line-strong bg-surface p-8 text-center shadow-card sm:p-10">
          <div className="pointer-events-none absolute inset-x-0 -top-24 mx-auto h-48 w-2/3 rounded-full bg-emerald-400/10 blur-3xl" aria-hidden="true" />
          <h2 className="relative text-2xl font-semibold tracking-tight text-white">Try it on your repos</h2>
          <p className="relative mx-auto mt-2 max-w-md text-sm text-slate-400">
            Sign in with GitHub, connect a repository, and your next pull request is scored automatically.
          </p>
          <div className="relative mt-6 flex flex-col justify-center gap-3 sm:flex-row">
            <a href={githubLoginUrl()} className={buttonClasses("primary", "md", "h-10 px-5")}>
              <GithubIcon size={15} />
              Continue with GitHub
            </a>
            <a href={SITE.sourceUrl} target="_blank" rel="noreferrer" className={buttonClasses("secondary", "md", "h-10 px-5")}>
              View the source
            </a>
          </div>
        </section>
      </main>
    </PublicLayout>
  );
}

function CreatorCard({ creator }: { creator: Creator }) {
  const optional = OPTIONAL_LINKS.filter((l) => creator.links[l.key]);

  return (
    <li className="flex flex-col rounded-2xl border border-line bg-surface p-6 shadow-card">
      <div className="flex items-center gap-4">
        <CreatorAvatar creator={creator} />
        <div className="min-w-0">
          <h3 className="truncate text-lg font-semibold text-white">{creator.name}</h3>
          <p className="text-sm text-emerald-300">{creator.role}</p>
        </div>
      </div>

      {creator.bio && <p className="mt-4 text-sm leading-relaxed text-slate-400">{creator.bio}</p>}

      <div className="mt-5 flex flex-wrap gap-2 border-t border-line pt-5">
        {[...PRIMARY_LINKS, ...optional].map((link) => (
          <SocialLink key={link.key} href={hrefFor(link.key, creator.links[link.key])} label={link.label} icon={link.icon} name={creator.name} />
        ))}
      </div>
    </li>
  );
}

function hrefFor(key: keyof CreatorLinks, value: string): string {
  if (!value) return "";
  return key === "email" && !value.startsWith("mailto:") ? `mailto:${value}` : value;
}

function SocialLink({ href, label, icon, name }: { href: string; label: string; icon: ReactNode; name: string }) {
  const classes = "inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium transition-colors";

  if (!href) {
    return (
      <span
        className={cx(classes, "cursor-default border border-dashed border-line-strong text-slate-600")}
        title={`${name}'s ${label} — coming soon`}
        aria-label={`${label} link coming soon`}
      >
        {icon}
        {label}
        <span className="text-[10px] uppercase tracking-wide">soon</span>
      </span>
    );
  }

  return (
    <a
      href={href}
      target={href.startsWith("mailto:") ? undefined : "_blank"}
      rel="noreferrer"
      className={cx(classes, "border border-line-strong bg-white/[0.03] text-slate-200 hover:border-emerald-400/40 hover:text-white")}
      aria-label={`${name} on ${label}`}
    >
      {icon}
      {label}
    </a>
  );
}

function CreatorAvatar({ creator }: { creator: Creator }) {
  const initials = creator.name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2);

  return (
    <span className="relative shrink-0">
      <span className="absolute -inset-1 rounded-full bg-gradient-to-br from-emerald-400/40 to-indigo-400/40 blur-sm" aria-hidden="true" />
      {creator.photo ? (
        <img
          src={creator.photo}
          alt={creator.name}
          width={64}
          height={64}
          className="relative size-16 rounded-full object-cover ring-2 ring-canvas"
        />
      ) : (
        <span className="relative flex size-16 items-center justify-center rounded-full bg-gradient-to-br from-emerald-400/30 to-indigo-500/40 text-xl font-semibold text-white ring-2 ring-canvas">
          {initials}
        </span>
      )}
    </span>
  );
}
