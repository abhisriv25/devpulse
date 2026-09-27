import { useQueryClient } from "@tanstack/react-query";
import { Link, useLocation } from "react-router-dom";
import { logout } from "../lib/api";
import { useCurrentUser } from "../lib/use-current-user";

export function AppHeader() {
  const { data: user } = useCurrentUser();
  const location = useLocation();
  const queryClient = useQueryClient();

  async function handleLogout() {
    await logout();
    queryClient.removeQueries({ queryKey: ["currentUser"] });
    window.location.href = "/login";
  }

  return (
    <header className="sticky top-0 z-10 border-b border-slate-800/80 bg-slate-950/70 px-6 py-4 backdrop-blur-xl">
      <div className="mx-auto flex max-w-6xl items-center justify-between">
        <div className="flex items-center gap-2">
          <Link to="/" className="flex items-center gap-2">
            <PulseMark className="h-5 w-5 text-emerald-400" />
            <span className="text-lg font-semibold tracking-tight text-white">DevPulse</span>
          </Link>
        </div>

        <div className="flex items-center gap-3">
          <NavLink to="/" active={location.pathname === "/"}>
            Dashboard
          </NavLink>
          <NavLink to="/repositories" active={location.pathname.startsWith("/repositories")}>
            Repositories
          </NavLink>

          {user?.avatarUrl && (
            <img
              src={user.avatarUrl}
              alt=""
              className="h-7 w-7 rounded-full ring-2 ring-slate-700 transition-all duration-300 hover:ring-emerald-400/60"
            />
          )}
          <button
            onClick={handleLogout}
            className="rounded-md border border-slate-700 px-3 py-1.5 text-xs text-slate-300 transition-all duration-200 hover:-translate-y-0.5 hover:border-slate-600 hover:bg-slate-800"
          >
            Sign out
          </button>
        </div>
      </div>
    </header>
  );
}

function NavLink({ to, active, children }: { to: string; active?: boolean; children: React.ReactNode }) {
  return (
    <Link
      to={to}
      className={`hidden rounded-md px-3 py-1.5 text-sm transition-colors sm:inline-block ${
        active ? "bg-slate-800/80 text-white" : "text-slate-400 hover:text-slate-200"
      }`}
    >
      {children}
    </Link>
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
