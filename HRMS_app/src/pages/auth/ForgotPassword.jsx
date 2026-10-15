import { useState } from "react";
import api, { errorMessage } from "../../lib/api";
import { Typography } from "@material-tailwind/react";
import { Mail, ArrowRight, KeyRound } from "lucide-react";
import { Link } from "react-router-dom";

const ForgotPassword = () => {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");
    setMessage("");
    
    try {
      const { data } = await api.post("/api/auth/forgot-password", { email });
      setMessage(data.message);
      setIsSubmitted(true);
    } catch (error) {
      setError(errorMessage(error));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 relative overflow-hidden flex items-center justify-center p-4 w-full">
      {/* Animated circuit board background - same as login page */}
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

      {/* Main container */}
      <div className="w-full max-w-md px-4 sm:px-6 relative">
        <div className="absolute inset-0 bg-gradient-to-r from-[#23A49B]/20 to-transparent blur-3xl" />
        
        <div className="relative bg-gray-800/50 backdrop-blur-xl rounded-2xl border border-[#23A49B]/30 overflow-hidden p-6 sm:p-8">
          <div className="text-center mb-6">
            <div className="w-20 h-20 mx-auto relative mb-4">
              <div className="absolute inset-0 bg-[#23A49B] rounded-full blur animate-pulse opacity-50" />
              <KeyRound className="w-full h-full text-[#23A49B] relative z-10 p-4" />
            </div>
            <Typography variant="h3" className="text-white mb-2 text-xl sm:text-2xl">
              Password Recovery
            </Typography>
            <Typography className="text-gray-400 text-sm sm:text-base">
              Enter your email to receive a reset link
            </Typography>
          </div>

          {isSubmitted ? (
            <div className="text-center space-y-6">
              <div className="p-4 bg-[#23A49B]/10 border border-[#23A49B]/20 rounded-lg">
                <p className="text-[#23A49B] text-sm sm:text-base">{message}</p>
              </div>
              
              <Link 
                to="/" 
                className="inline-block text-[#23A49B] hover:text-[#2c8f8a] transition-colors text-sm sm:text-base"
              >
                Return to login
              </Link>
            </div>
          ) : (
            <>
              {error && (
                <div className="p-4 mb-6 bg-red-500/10 border border-red-500/20 rounded-lg">
                  <p className="text-red-400 text-sm">{error}</p>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-2">
                  <label className="text-sm sm:text-base text-gray-400">Email Address</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-[#23A49B] w-4 h-4 sm:w-5 sm:h-5" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full bg-gray-900/50 border border-[#23A49B]/30 rounded-lg pl-10 p-3 text-white focus:outline-none focus:border-[#23A49B] transition-colors text-sm sm:text-base"
                      placeholder="Enter your email"
                      required
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full bg-[#23A49B] text-white py-3 rounded-lg relative overflow-hidden group hover:shadow-[0_0_15px_rgba(35,164,155,0.5)] transition-shadow text-sm sm:text-base"
                >
                  <span className="relative z-10 flex items-center justify-center gap-2">
                    {isLoading ? "Processing..." : "Send Reset Link"}
                    <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5 group-hover:translate-x-1 transition-transform" />
                  </span>
                  <div className="absolute inset-0 bg-gradient-to-r from-[#23A49B] to-[#2c8f8a] opacity-0 group-hover:opacity-100 transition-opacity" />
                </button>
              </form>

              <div className="mt-6 text-center">
                <Link 
                  to="/" 
                  className="text-[#23A49B] hover:text-[#2c8f8a] transition-colors text-sm sm:text-base"
                >
                  Return to login
                </Link>
              </div>
            </>
          )}
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

export default ForgotPassword;