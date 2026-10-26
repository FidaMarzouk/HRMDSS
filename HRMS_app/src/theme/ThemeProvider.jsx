import { useCallback, useEffect, useMemo, useState } from "react";
import { THEME_MODES, THEME_STORAGE_KEY, ThemeContext } from "./theme";

const darkQuery = () => window.matchMedia("(prefers-color-scheme: dark)");

const readMode = () => {
  try {
    const saved = localStorage.getItem(THEME_STORAGE_KEY);
    return THEME_MODES.includes(saved) ? saved : "auto";
  } catch {
    return "auto";
  }
};

// Sets <html data-theme> directly so colour tokens are correct before React re-renders.
const applyMode = (mode) => {
  const root = document.documentElement;
  if (mode === "auto") root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", mode);
};

const resolve = (mode) => (mode === "auto" ? (darkQuery().matches ? "dark" : "light") : mode);

export default function ThemeProvider({ children }) {
  const [mode, setModeState] = useState(readMode);
  const [resolved, setResolved] = useState(() => resolve(readMode()));

  const setMode = useCallback((next) => {
    if (!THEME_MODES.includes(next)) return;
    applyMode(next);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // Private mode or blocked storage: the choice still applies to this tab.
    }
    setModeState(next);
    setResolved(resolve(next));
  }, []);

  // In auto mode, follow OS changes while the app is open.
  useEffect(() => {
    if (mode !== "auto") return undefined;
    const query = darkQuery();
    const onChange = () => setResolved(query.matches ? "dark" : "light");
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, [mode]);

  // Browser UI colour (mobile address bar) follows the ground colour.
  useEffect(() => {
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", resolved === "dark" ? "#0D1112" : "#EEF2F1");
  }, [resolved]);

  const value = useMemo(() => ({ mode, resolved, setMode }), [mode, resolved, setMode]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
