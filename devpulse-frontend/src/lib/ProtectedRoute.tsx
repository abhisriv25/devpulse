import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { PulseMark } from "../components/icons";
import { useCurrentUser } from "../lib/use-current-user";

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { data: user, isLoading, isError } = useCurrentUser();

  if (isLoading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-50 dark:bg-canvas" role="status">
        <span className="flex size-11 animate-pulse items-center justify-center rounded-xl border border-emerald-600/20 dark:border-emerald-400/25 bg-emerald-50 dark:bg-emerald-400/10 text-emerald-700 dark:text-emerald-300">
          <PulseMark size={22} />
        </span>
        <span className="sr-only">Checking your session…</span>
      </div>
    );
  }

  if (isError || !user) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}
