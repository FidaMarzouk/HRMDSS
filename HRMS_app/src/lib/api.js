import axios from "axios";

// In development, Vite proxies /api, /uploads and /socket.io to the backend
// (see vite.config.js), so relative URLs work and the auth cookie is first-party.
// For other deployments, set VITE_API_URL to the backend origin.
export const API_URL = import.meta.env.VITE_API_URL || "";

const api = axios.create({
  baseURL: API_URL,
  withCredentials: true,
});

const PUBLIC_PATHS = ["/", "/forgot-password", "/reset-password"];
const isPublicPage = () =>
  PUBLIC_PATHS.some((p) => (p === "/" ? window.location.pathname === "/" : window.location.pathname.startsWith(p)));

// An expired or missing session anywhere in the app sends the user back to login.
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && !isPublicPage() && !error.config?.skipAuthRedirect) {
      window.location.assign("/");
    }
    return Promise.reject(error);
  }
);

// Best human-readable message from an axios error.
export const errorMessage = (error, fallback = "Something went wrong. Please try again.") =>
  error?.response?.data?.message ||
  error?.response?.data?.errors?.[0]?.msg ||
  fallback;

// Absolute URL for files served from the backend's /uploads folder.
export const uploadUrl = (path) => {
  if (!path) return "/default-avatar.svg";
  if (/^(https?:|blob:|data:)/.test(path)) return path;
  return `${API_URL}${path}`;
};

export default api;
