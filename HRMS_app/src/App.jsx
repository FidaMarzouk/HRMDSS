import { lazy, Suspense } from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext.jsx";
import { SocketProvider } from "./context/SocketContext.jsx";
import ThemeProvider from "./theme/ThemeProvider.jsx";
import { FeedbackHost } from "./components/ui/feedback-host.jsx";
import Login from "./pages/auth/login.jsx";
import PrivateRoute from "./pages/auth/PrivateRoute.jsx";
import ForgotPassword from "./pages/auth/ForgotPassword.jsx";
import ResetPassword from "./pages/auth/ResetPassword.jsx";
import { NotFoundPage, UnauthorizedPage } from "./pages/StatusPage.jsx";

// Each user only ever loads their own role's dashboard.
const AdminDashboard = lazy(() => import("./pages/dashboards/Admin_Dashboard/AdminDashboard.jsx"));
const ManagerDashboard = lazy(() => import("./pages/dashboards/Manager_Dashboard/ManagerDashboard.jsx"));
const EmployeeDashboard = lazy(() => import("./pages/dashboards/Employee_Dashboard/EmployeeDashboard.jsx"));
const CEODashboard = lazy(() => import("./pages/dashboards/CEO_Dashboard/CEO_Dashboard.jsx"));

const PageLoader = () => (
  <div className="flex min-h-screen items-center justify-center bg-ground" role="status" aria-label="Loading">
    <div className="h-10 w-10 animate-spin rounded-full border-4 border-line border-t-teal" />
  </div>
);

function App() {
  return (
    <ThemeProvider>
      <Router>
        <AuthProvider>
          <SocketProvider>
            <Suspense fallback={<PageLoader />}>
              <Routes>
                <Route path="/" element={<Login />} />
                <Route path="/forgot-password" element={<ForgotPassword />} />
                <Route path="/reset-password/:token" element={<ResetPassword />} />

                <Route path="/admin-dashboard" element={<PrivateRoute allowedRoles={['admin']} />}>
                  <Route index element={<AdminDashboard />} />
                </Route>
                <Route path="/manager-dashboard" element={<PrivateRoute allowedRoles={['manager']} />}>
                  <Route index element={<ManagerDashboard />} />
                </Route>
                <Route path="/employee-dashboard" element={<PrivateRoute allowedRoles={['employee']} />}>
                  <Route index element={<EmployeeDashboard />} />
                </Route>
                <Route path="/ceo-dashboard" element={<PrivateRoute allowedRoles={['superAdmin']} />}>
                  <Route index element={<CEODashboard />} />
                </Route>

                <Route path="/unauthorized" element={<UnauthorizedPage />} />
                <Route path="*" element={<NotFoundPage />} />
              </Routes>
            </Suspense>
          </SocketProvider>
        </AuthProvider>
      </Router>
      <FeedbackHost />
    </ThemeProvider>
  );
}

export default App;
