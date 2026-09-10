import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { LoginPage } from "./pages/LoginPage";
import { DashboardPage } from "./pages/DashboardPage";
import { RepositoriesPage } from "./pages/RepositoriesPage";
import { PullRequestsPage } from "./pages/PullRequestsPage";
import { PullRequestDetailPage } from "./pages/PullRequestDetailPage";
import { ProtectedRoute } from "./lib/ProtectedRoute";

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <DashboardPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/repositories"
          element={
            <ProtectedRoute>
              <RepositoriesPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/repositories/:repoId/pulls"
          element={
            <ProtectedRoute>
              <PullRequestsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/pulls/:pullId"
          element={
            <ProtectedRoute>
              <PullRequestDetailPage />
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
