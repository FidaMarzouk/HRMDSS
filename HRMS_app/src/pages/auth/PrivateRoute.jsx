import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

const PrivateRoute = ({ allowedRoles }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-ground flex items-center justify-center">
        <div className="p-6 bg-raise rounded-lg shadow-lg border border-line">
          <div className="flex flex-col items-center">
            <div className="w-16 h-16 border-4 border-t-teal border-line rounded-full animate-spin mb-4"></div>
            <p className="text-ink text-lg">Initializing system...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/" replace />;
  }

  if (!allowedRoles.includes(user.role)) {
    return <Navigate to="/unauthorized" replace />;
  }

  return <Outlet />;
};

export default PrivateRoute;
