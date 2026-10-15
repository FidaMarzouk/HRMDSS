import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

const PrivateRoute = ({ allowedRoles }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="p-6 bg-gray-800 rounded-lg shadow-lg border border-[#23A49B]/30">
          <div className="flex flex-col items-center">
            <div className="w-16 h-16 border-4 border-t-[#23A49B] border-[#23A49B]/30 rounded-full animate-spin mb-4"></div>
            <p className="text-white text-lg">Initializing system...</p>
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
