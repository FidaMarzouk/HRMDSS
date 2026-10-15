import { Link } from "react-router-dom";
import { useAuth, DASHBOARD_PATHS } from "../context/AuthContext";

// Shared full-page message used for 404 and unauthorized routes.
const StatusPage = ({ code, title, message }) => {
  const { user } = useAuth();
  const home = user ? DASHBOARD_PATHS[user.role] || "/" : "/";

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
      <div className="max-w-md w-full text-center bg-gray-800/60 border border-[#23A49B]/30 rounded-2xl p-8">
        <p className="text-6xl font-bold text-[#23A49B]">{code}</p>
        <h1 className="mt-4 text-2xl font-semibold text-white">{title}</h1>
        <p className="mt-2 text-gray-400">{message}</p>
        <Link
          to={home}
          className="inline-block mt-6 px-5 py-2.5 rounded-lg bg-[#23A49B] text-white hover:bg-[#1d8a82] transition-colors"
        >
          {user ? "Back to my dashboard" : "Go to login"}
        </Link>
      </div>
    </div>
  );
};

export const NotFoundPage = () => (
  <StatusPage code="404" title="Page not found" message="The page you are looking for doesn't exist." />
);

export const UnauthorizedPage = () => (
  <StatusPage code="403" title="Access denied" message="Your account doesn't have permission to view this page." />
);
