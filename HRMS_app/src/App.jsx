import { lazy, Suspense } from "react";
import { BrowserRouter as Router, Navigate, Routes, Route, useSearchParams } from "react-router-dom";
import { QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider, useAuth } from "./context/AuthContext.jsx";
import { SocketProvider } from "./context/SocketContext.jsx";
import ThemeProvider from "./theme/ThemeProvider.jsx";
import { FeedbackHost } from "./components/ui/feedback-host.jsx";
import { queryClient } from "./lib/queries.js";
import { DEFAULT_PAGE, legacyPageKey, pathFor } from "./config/navigation.js";
import Login from "./pages/auth/login.jsx";
import PrivateRoute from "./pages/auth/PrivateRoute.jsx";
import ForgotPassword from "./pages/auth/ForgotPassword.jsx";
import ResetPassword from "./pages/auth/ResetPassword.jsx";
import { NotFoundPage, UnauthorizedPage } from "./pages/StatusPage.jsx";

const AppShell = lazy(() => import("./layouts/AppShell.jsx"));

const ALL_ROLES = ["admin", "manager", "employee", "superAdmin"];

const PageLoader = () => (
  <div className="flex min-h-screen items-center justify-center bg-ground" role="status" aria-label="Loading">
    <div className="h-10 w-10 animate-spin rounded-full border-4 border-line border-t-teal" />
  </div>
);

// /admin-dashboard?page=leave and friends, from before the single /app shell.
function LegacyRedirect() {
  const { user } = useAuth();
  const [params] = useSearchParams();
  return <Navigate to={pathFor(legacyPageKey(user?.role, params.get("page")))} replace />;
}

function App() {
  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <Router>
          <AuthProvider>
            <SocketProvider>
              <Suspense fallback={<PageLoader />}>
                <Routes>
                  <Route path="/" element={<Login />} />
                  <Route path="/forgot-password" element={<ForgotPassword />} />
                  <Route path="/reset-password/:token" element={<ResetPassword />} />

                  <Route path="/app" element={<PrivateRoute allowedRoles={ALL_ROLES} />}>
                    <Route index element={<Navigate to={DEFAULT_PAGE} replace />} />
                    <Route path=":page" element={<AppShell />} />
                  </Route>

                  <Route element={<PrivateRoute allowedRoles={ALL_ROLES} />}>
                    {["/admin-dashboard", "/manager-dashboard", "/employee-dashboard", "/ceo-dashboard"].map((path) => (
                      <Route key={path} path={path} element={<LegacyRedirect />} />
                    ))}
                  </Route>

                  <Route path="/unauthorized" element={<UnauthorizedPage />} />
                  <Route path="*" element={<NotFoundPage />} />
                </Routes>
              </Suspense>
            </SocketProvider>
          </AuthProvider>
        </Router>
        <FeedbackHost />
      </QueryClientProvider>
    </ThemeProvider>
  );
}

export default App;
