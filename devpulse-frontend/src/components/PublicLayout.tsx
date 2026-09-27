import type { ReactNode } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { githubLoginUrl } from "../lib/api";
import { SITE } from "../lib/site";
import { GithubIcon, PulseMark } from "./icons";
import { buttonClasses, cx } from "./ui";

const LINKS = [
  { to: "/about", label: "About" },
  { to: "/privacy", label: "Privacy" },
  { to: "/terms", label: "Terms" },
];

/** Header + footer shared by the landing page and the public info pages. */
export function PublicLayout({ children, backdrop }: { children: ReactNode; backdrop?: ReactNode }) {
  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-canvas text-slate-100">
      {backdrop ?? <SoftBackdrop />}
      <PublicHeader />
      <div className="relative flex-1">{children}</div>
      <PublicFooter />
    </div>
  );
}

function PublicHeader() {
  const onLanding = useLocation().pathname === "/login";

  return (
    <header className="relative z-10 mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-6 pt-7 sm:px-10">
      <Link to="/login" className="group flex items-center gap-2.5">
        <span className="flex size-8 items-center justify-center rounded-lg border border-emerald-400/25 bg-emerald-400/10 text-emerald-300 transition-shadow group-hover:shadow-glow">
          <PulseMark size={18} />
        </span>
        <span className="text-[15px] font-semibold tracking-tight text-white">{SITE.name}</span>
      </Link>

      <nav className="flex items-center gap-1 sm:gap-2" aria-label="Site">
        {LINKS.slice(0, 2).map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            className={({ isActive }) =>
              cx(
                "rounded-lg px-2.5 py-1.5 text-sm transition-colors",
                isActive ? "text-white" : "text-slate-400 hover:text-slate-100",
              )
            }
          >
            {link.label}
          </NavLink>
        ))}
        {!onLanding && (
          <a href={githubLoginUrl()} className={buttonClasses("secondary", "sm", "ml-1")}>
            <GithubIcon size={13} />
            Sign in
          </a>
        )}
      </nav>
    </header>
  );
}

function PublicFooter() {
  return (
    <footer className="relative z-10 border-t border-line">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-6 py-7 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between sm:px-10">
        <p>
          © {new Date().getFullYear()} {SITE.name}. Read-only by design — we never store your source code.
        </p>
        <nav className="flex flex-wrap items-center gap-x-5 gap-y-2" aria-label="Footer">
          {LINKS.map((link) => (
            <Link key={link.to} to={link.to} className="transition-colors hover:text-slate-200">
              {link.label}
            </Link>
          ))}
          <a href={SITE.sourceUrl} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 transition-colors hover:text-slate-200">
            <GithubIcon size={12} />
            Source
          </a>
        </nav>
      </div>
    </footer>
  );
}

function SoftBackdrop() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      <div className="absolute left-1/2 top-[-18rem] h-[34rem] w-[48rem] -translate-x-1/2 rounded-full bg-emerald-500/[0.08] blur-[140px]" />
      <div
        className="absolute inset-0 opacity-[0.035]"
        style={{
          backgroundImage:
            "linear-gradient(to right, white 1px, transparent 1px), linear-gradient(to bottom, white 1px, transparent 1px)",
          backgroundSize: "56px 56px",
          maskImage: "radial-gradient(ellipse 60% 40% at 50% 0%, black 10%, transparent 80%)",
          WebkitMaskImage: "radial-gradient(ellipse 60% 40% at 50% 0%, black 10%, transparent 80%)",
        }}
      />
    </div>
  );
}

/** Long-form page wrapper for Privacy / Terms: title block + readable column. */
export function DocumentPage({
  eyebrow,
  title,
  intro,
  children,
}: {
  eyebrow: string;
  title: string;
  intro: ReactNode;
  children: ReactNode;
}) {
  return (
    <PublicLayout>
      <main className="mx-auto max-w-3xl px-6 pb-20 pt-14 sm:px-10 sm:pt-20">
        <div className="animate-fade-in-up">
          <p className="text-xs font-medium uppercase tracking-wider text-emerald-300">{eyebrow}</p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight text-white sm:text-5xl">{title}</h1>
          <div className="mt-5 text-base leading-relaxed text-slate-400">{intro}</div>
          <p className="mt-4 text-xs text-slate-500">Last updated {SITE.policiesUpdated}</p>
        </div>
        <div className="mt-12 animate-fade-in-up space-y-12 [animation-delay:80ms]">{children}</div>
      </main>
    </PublicLayout>
  );
}

export function DocSection({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section id={id} className="scroll-mt-8">
      <h2 className="text-lg font-semibold text-white">
        <a href={`#${id}`} className="group inline-flex items-center gap-2">
          {title}
          <span className="text-slate-600 opacity-0 transition-opacity group-hover:opacity-100" aria-hidden="true">
            #
          </span>
        </a>
      </h2>
      <div className="mt-3 space-y-3 text-[15px] leading-relaxed text-slate-400 [&_strong]:font-medium [&_strong]:text-slate-200 [&_ul]:space-y-2 [&_ul]:pl-1 [&_li]:flex [&_li]:gap-2.5 [&_li]:before:mt-[0.6em] [&_li]:before:size-1.5 [&_li]:before:shrink-0 [&_li]:before:rounded-full [&_li]:before:bg-slate-600 [&_li]:before:content-['']">
        {children}
      </div>
    </section>
  );
}

export function ContactLine() {
  return SITE.contactEmail ? (
    <>
      email{" "}
      <a href={`mailto:${SITE.contactEmail}`} className="text-emerald-300 hover:underline">
        {SITE.contactEmail}
      </a>
    </>
  ) : (
    <>
      reach the creators through the links on the{" "}
      <Link to="/about" className="text-emerald-300 hover:underline">
        About page
      </Link>
    </>
  );
}
