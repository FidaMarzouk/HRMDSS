import { useState } from "react";
import api, { errorMessage } from "../../lib/api";
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
    <div className="min-h-screen bg-ground relative overflow-hidden flex items-center justify-center p-4 w-full">
      {/* Animated circuit board background - same as login page */}
      <div className="absolute inset-0 opacity-20">
        {[...Array(20)].map((_, i) => (
          <div
            key={i}
            className="absolute bg-teal/10 h-px"
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
            className="absolute bg-teal/10 w-px"
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
        <div className="absolute inset-0 bg-teal/10 blur-3xl" />
        
        <div className="relative bg-raise backdrop-blur-xl rounded-2xl border border-line overflow-hidden p-6 sm:p-8">
          <div className="text-center mb-6">
            <div className="w-20 h-20 mx-auto relative mb-4">
              <div className="absolute inset-0 bg-teal rounded-full blur animate-pulse opacity-50" />
              <KeyRound className="w-full h-full text-teal relative z-10 p-4" />
            </div>
            <h3 className="font-semibold text-ink mb-2 text-xl sm:text-2xl">
              Password Recovery
            </h3>
            <p className="text-ink-2 text-sm sm:text-base">
              Enter your email to receive a reset link
            </p>
          </div>

          {isSubmitted ? (
            <div className="text-center space-y-6">
              <div className="p-4 bg-teal/10 border border-line rounded-lg">
                <p className="text-teal text-sm sm:text-base">{message}</p>
              </div>
              
              <Link 
                to="/" 
                className="inline-block text-teal hover:text-teal transition-colors text-sm sm:text-base"
              >
                Return to login
              </Link>
            </div>
          ) : (
            <>
              {error && (
                <div className="p-4 mb-6 bg-red/10 border border-red/20 rounded-lg">
                  <p className="text-red text-sm">{error}</p>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-2">
                  <label className="text-sm sm:text-base text-ink-2">Email Address</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-teal w-4 h-4 sm:w-5 sm:h-5" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full bg-panel border border-line rounded-lg pl-10 p-3 text-ink focus:outline-none focus:border-teal transition-colors text-sm sm:text-base"
                      placeholder="Enter your email"
                      required
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full bg-teal text-on-accent py-3 rounded-lg relative overflow-hidden group transition-shadow text-sm sm:text-base"
                >
                  <span className="relative z-10 flex items-center justify-center gap-2">
                    {isLoading ? "Processing..." : "Send Reset Link"}
                    <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5 group-hover:translate-x-1 transition-transform" />
                  </span>
                  <div className="absolute inset-0 bg-teal opacity-0 group-hover:opacity-100 transition-opacity" />
                </button>
              </form>

              <div className="mt-6 text-center">
                <Link 
                  to="/" 
                  className="text-teal hover:text-teal transition-colors text-sm sm:text-base"
                >
                  Return to login
                </Link>
              </div>
            </>
          )}
        </div>
      </div>

      <style>{`
        @keyframes pulse { 0%, 100% { opacity: 0.2; } 50% { opacity: 0.4; } }
      `}</style>
    </div>
  );
};

export default ForgotPassword;