import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import api, { errorMessage } from "../../lib/api";
import { useAuth, DASHBOARD_PATHS } from "../../context/AuthContext";
import { Typography } from "@material-tailwind/react";
import { Mail, Lock, ArrowRight, Power } from "lucide-react";

const RoboticLogin = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const { refresh } = useAuth();

  const handleLogin = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    try {
      const { data } = await api.post("/api/auth/login", { email, password });
      await refresh();
      navigate(DASHBOARD_PATHS[data.role] || "/unauthorized", { replace: true });
    } catch (error) {
      setError(errorMessage(error, "Authentication failed"));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 relative overflow-hidden flex items-center justify-center p-4 w-full">
      {/* Animated circuit board background */}
      <div className="absolute inset-0 opacity-20">
        {[...Array(20)].map((_, i) => (
          <div
            key={i}
            className="absolute bg-[#23A49B]/20 h-px"
            style={{
              top: `${Math.random() * 100}%`,
              left: 0,
              right: 0,
              animation: `pulse 3s ${Math.random() * 2}s infinite`
            }}
          />
        ))}
        {[...Array(20)].map((_, i) => (
          <div
            key={i}
            className="absolute bg-[#23A49B]/20 w-px"
            style={{
              left: `${Math.random() * 100}%`,
              top: 0,
              bottom: 0,
              animation: `pulse 3s ${Math.random() * 2}s infinite`
            }}
          />
        ))}
      </div>

      {/* Main container - Made responsive */}
      <div className="w-full max-w-7xl px-4 sm:px-6 lg:px-8 relative">
        <div className="absolute inset-0 bg-gradient-to-r from-[#23A49B]/20 to-transparent blur-3xl" />
        
        <div className="relative bg-gray-800/50 backdrop-blur-xl rounded-2xl border border-[#23A49B]/30 overflow-hidden">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8">
            {/* Left side - Brand section */}
            <div className="flex flex-col justify-center items-center relative py-8 lg:py-16 px-6">
              <div className="absolute inset-0">
                <div className="absolute inset-0 bg-gradient-to-br from-[#23A49B]/20 to-transparent animate-pulse" />
              </div>
              
              {/* Logo and company name */}
              <div className="relative z-10 text-center space-y-4 sm:space-y-6">
                <div className="w-24 h-24 sm:w-32 sm:h-32 md:w-36 md:h-36 lg:w-40 lg:h-40 mx-auto relative">
                  <div className="absolute inset-0 bg-[#23A49B] rounded-full blur animate-pulse opacity-50" />
                  <Power className="w-full h-full text-[#23A49B] relative z-10 p-5 sm:p-6" />
                </div>
                <Typography variant="h2" className="text-white font-bold text-2xl sm:text-3xl lg:text-4xl">
                  ENOVA ROBOTICS
                </Typography>
                <Typography className="text-gray-400 text-base sm:text-lg">
                  Advanced Robotics Solutions
                </Typography>
              </div>
            </div>

            {/* Right side - Login form */}
            <div className="space-y-6 sm:space-y-8 py-8 lg:py-16 px-6 lg:px-8">
              <div className="text-center">
                <Typography variant="h3" className="text-white mb-2 sm:mb-4 text-xl sm:text-2xl lg:text-3xl">
                  System Access Portal
                </Typography>
                <Typography className="text-gray-400 text-sm sm:text-base lg:text-lg">
                  Initialize authentication sequence
                </Typography>
              </div>

              {error && (
                <div className="p-4 sm:p-5 bg-red-500/10 border border-red-500/20 rounded-lg">
                  <p className="text-red-400 text-sm">{error}</p>
                </div>
              )}

              <form onSubmit={handleLogin} className="space-y-6">
                <div className="space-y-2">
                  <label className="text-sm sm:text-base text-gray-400">Authentication ID</label>
                  <div className="relative">
                    <Mail className="absolute left-3 sm:left-4 top-1/2 -translate-y-1/2 text-[#23A49B] w-4 h-4 sm:w-5 sm:h-5" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full bg-gray-900/50 border border-[#23A49B]/30 rounded-lg pl-10 sm:pl-12 p-3 sm:p-4 text-white focus:outline-none focus:border-[#23A49B] transition-colors text-sm sm:text-base"
                      placeholder="Enter your email"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm sm:text-base text-gray-400">Security Key</label>
                  <div className="relative">
                    <Lock className="absolute left-3 sm:left-4 top-1/2 -translate-y-1/2 text-[#23A49B] w-4 h-4 sm:w-5 sm:h-5" />
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full bg-gray-900/50 border border-[#23A49B]/30 rounded-lg pl-10 sm:pl-12 p-3 sm:p-4 text-white focus:outline-none focus:border-[#23A49B] transition-colors text-sm sm:text-base"
                      placeholder="Enter your password"
                    />
                  </div>
                </div>

                {/* New forgotten password link */}
                <div className="flex justify-end">
                  <Link 
                    to="/forgot-password" 
                    className="text-sm text-[#23A49B] hover:text-[#2c8f8a] transition-colors"
                  >
                    Forgot password?
                  </Link>
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full bg-[#23A49B] text-white py-3 sm:py-4 rounded-lg relative overflow-hidden group hover:shadow-[0_0_15px_rgba(35,164,155,0.5)] transition-shadow text-sm sm:text-base mt-4"
                >
                  <span className="relative z-10 flex items-center justify-center gap-2 sm:gap-3">
                    {isLoading ? "Authenticating..." : "Initialize Access"}
                    <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5 lg:w-6 lg:h-6 group-hover:translate-x-1 transition-transform" />
                  </span>
                  <div className="absolute inset-0 bg-gradient-to-r from-[#23A49B] to-[#2c8f8a] opacity-0 group-hover:opacity-100 transition-opacity" />
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 0.2; }
          50% { opacity: 0.4; }
        }
      `}</style>
    </div>
  );
};

export default RoboticLogin;