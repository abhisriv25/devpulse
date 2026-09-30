import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { LogoMark } from "../components/icons";
import { useCurrentUser } from "../lib/use-current-user";

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { data: user, isLoading, isError } = useCurrentUser();

  if (isLoading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-50 dark:bg-canvas" role="status">
        <LogoMark size={48} className="animate-pulse rounded-xl" />
        <span className="sr-only">Checking your session…</span>
      </div>
    );
  }

  if (isError || !user) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}
