import type { ReactNode } from "react";
import { BrowserRouter, Navigate, Route, Routes, useParams } from "react-router-dom";
import { LoginPage } from "./pages/LoginPage";
import { DashboardPage } from "./pages/DashboardPage";
import { RepositoriesPage } from "./pages/RepositoriesPage";
import { PullRequestsPage } from "./pages/PullRequestsPage";
import { PullRequestDetailPage } from "./pages/PullRequestDetailPage";
import { ProtectedRoute } from "./lib/ProtectedRoute";

const protect = (page: ReactNode) => <ProtectedRoute>{page}</ProtectedRoute>;

/** Old per-repo URL — now a filter on the unified pull requests page. */
function LegacyRepoPullsRedirect() {
  const { repoId } = useParams<{ repoId: string }>();
  return <Navigate to={`/pulls?repo=${repoId}`} replace />;
}

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/" element={protect(<DashboardPage />)} />
        <Route path="/pulls" element={protect(<PullRequestsPage />)} />
        <Route path="/pulls/:pullId" element={protect(<PullRequestDetailPage />)} />
        <Route path="/repositories" element={protect(<RepositoriesPage />)} />
        <Route path="/repositories/:repoId/pulls" element={<LegacyRepoPullsRedirect />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
