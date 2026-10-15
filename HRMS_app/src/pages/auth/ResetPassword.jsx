import { useState, useEffect } from "react";
import api, { errorMessage } from "../../lib/api";
import { useParams, useNavigate, Link } from "react-router-dom";
import { Lock, ArrowRight, KeyRound, Eye, EyeOff } from "lucide-react";

const ResetPassword = () => {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isVerifying, setIsVerifying] = useState(true);
  const [isValid, setIsValid] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const { token } = useParams();
  const navigate = useNavigate();

  useEffect(() => {
    // Verify token validity on component mount
    const verifyToken = async () => {
      try {
        const { data } = await api.get(`/api/auth/reset-password/${token}`);
        if (data.valid) {
          setIsValid(true);
        } else {
          setError("This link is invalid or has expired");
        }
      } catch (error) {
        setError(errorMessage(error, "This link is invalid or has expired"));
      } finally {
        setIsVerifying(false);
      }
    };

    verifyToken();
  }, [token]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");
    
    // Validate passwords
    if (password.length < 6) {
      setError("Password must be at least 6 characters long");
      setIsLoading(false);
      return;
    }
    
    if (password !== confirmPassword) {
      setError("Passwords do not match");
      setIsLoading(false);
      return;
    }
    
    try {
      const { data } = await api.post(`/api/auth/reset-password/${token}`, { password, confirmPassword });
      setMessage(data.message);
      setIsComplete(true);
      // Redirect to login after a few seconds
      setTimeout(() => {
        navigate('/');
      }, 5000);
    } catch (error) {
      setError(errorMessage(error));
    } finally {
      setIsLoading(false);
    }
  };

  // Password requirements indicators
  const hasMinLength = password.length >= 6;

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
              Reset Password
            </h3>
            <p className="text-ink-2 text-sm sm:text-base">
              Create a new secure password
            </p>
          </div>

          {isVerifying ? (
            <div className="flex justify-center py-8">
              <div className="w-10 h-10 border-2 border-teal border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : isValid ? (
            isComplete ? (
              <div className="text-center space-y-6">
                <div className="p-4 bg-teal/10 border border-line rounded-lg">
                  <p className="text-teal text-sm sm:text-base">{message}</p>
                  <p className="text-ink-2 mt-2 text-xs sm:text-sm">Redirecting to login...</p>
                </div>
                
                <Link 
                  to="/" 
                  className="inline-block text-teal hover:text-teal transition-colors text-sm sm:text-base"
                >
                  Return to login now
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
                    <label className="text-sm sm:text-base text-ink-2">New Password</label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-teal w-4 h-4 sm:w-5 sm:h-5" />
                      <input
                        type={showPassword ? "text" : "password"}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full bg-panel border border-line rounded-lg pl-10 pr-10 p-3 text-ink focus:outline-none focus:border-teal transition-colors text-sm sm:text-base"
                        placeholder="Enter new password"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-2"
                      >
                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                    
                    {/* Password requirements */}
                    <div className="mt-2 space-y-1">
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${hasMinLength ? 'bg-teal' : 'bg-ink-3'}`}></div>
                        <span className={`text-xs ${hasMinLength ? 'text-teal' : 'text-ink-3'}`}>
                          At least 6 characters
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm sm:text-base text-ink-2">Confirm Password</label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-teal w-4 h-4 sm:w-5 sm:h-5" />
                      <input
                        type={showConfirmPassword ? "text" : "password"}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="w-full bg-panel border border-line rounded-lg pl-10 pr-10 p-3 text-ink focus:outline-none focus:border-teal transition-colors text-sm sm:text-base"
                        placeholder="Confirm new password"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-2"
                      >
                        {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                    
                    {/* Password match indicator */}
                    {confirmPassword && (
                      <div className="mt-1">
                        <div className="flex items-center gap-2">
                          <div className={`w-2 h-2 rounded-full ${password === confirmPassword ? 'bg-teal' : 'bg-red'}`}></div>
                          <span className={`text-xs ${password === confirmPassword ? 'text-teal' : 'text-red'}`}>
                            {password === confirmPassword ? 'Passwords match' : 'Passwords do not match'}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>

                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full bg-teal text-on-accent py-3 rounded-lg relative overflow-hidden group transition-shadow text-sm sm:text-base"
                  >
                    <span className="relative z-10 flex items-center justify-center gap-2">
                      {isLoading ? "Processing..." : "Reset Password"}
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
            )
          ) : (
            <div className="text-center space-y-6">
              <div className="p-4 bg-red/10 border border-red/20 rounded-lg">
                <p className="text-red text-sm">{error || "This reset link is invalid or has expired"}</p>
              </div>
              
              <div className="space-y-4">
                <p className="text-ink-2 text-sm">Need a new reset link?</p>
                <Link 
                  to="/forgot-password" 
                  className="inline-block bg-teal/10 hover:bg-teal/15 text-teal py-2 px-4 rounded-lg transition-colors text-sm"
                >
                  Request a new link
                </Link>
              </div>
              
              <Link 
                to="/" 
                className="inline-block text-teal hover:text-teal transition-colors text-sm sm:text-base"
              >
                Return to login
              </Link>
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes pulse { 0%, 100% { opacity: 0.2; } 50% { opacity: 0.4; } }
      `}</style>
    </div>
  );
};

export default ResetPassword;