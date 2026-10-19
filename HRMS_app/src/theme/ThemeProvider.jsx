import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { THEME_MODES, THEME_SHIFT_KEY, THEME_STORAGE_KEY, ThemeContext, offShiftByClock } from "./theme";

const darkQuery = () => window.matchMedia("(prefers-color-scheme: dark)");

const read = (key) => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};
const write = (key, value) => {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Private mode or blocked storage: the choice still applies to this tab.
  }
};

const readMode = () => {
  const saved = read(THEME_STORAGE_KEY);
  return THEME_MODES.includes(saved) ? saved : "auto";
};
const readShiftDark = () => {
  const saved = read(THEME_SHIFT_KEY);
  return saved === "dark" ? true : saved === "light" ? false : offShiftByClock();
};

const resolve = (mode, shiftDark) =>
  mode === "auto" ? (darkQuery().matches ? "dark" : "light") : mode === "shift" ? (shiftDark ? "dark" : "light") : mode;

// Sets <html data-theme> directly so colour tokens are correct before React re-renders.
const applyMode = (mode, resolved) => {
  const root = document.documentElement;
  if (mode === "auto") root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", resolved);
};

/**
 * Theme mode: "light", "dark", "auto" (follow the OS) or "shift" (light during
 * your working day, dark once you have punched out; the shell reports the
 * shift state with setShiftDark). The mode is cached in localStorage for the
 * first paint and saved to the profile through the function registered with
 * registerRemote (see features/shell/useThemeSync.js).
 */
export default function ThemeProvider({ children }) {
  const [mode, setModeState] = useState(readMode);
  const [shiftDark, setShiftDarkState] = useState(readShiftDark);
  const [systemDark, setSystemDark] = useState(() => darkQuery().matches);
  const remote = useRef(null);
  const resolved = mode === "auto" ? (systemDark ? "dark" : "light") : resolve(mode, shiftDark);

  useEffect(() => {
    applyMode(mode, resolved);
    if (mode === "shift") write(THEME_SHIFT_KEY, resolved);
  }, [mode, resolved]);

  const setMode = useCallback((next, { save = true } = {}) => {
    if (!THEME_MODES.includes(next)) return;
    write(THEME_STORAGE_KEY, next);
    setModeState(next);
    if (save) remote.current?.(next);
  }, []);

  const setShiftDark = useCallback((dark) => setShiftDarkState(Boolean(dark)), []);

  const registerRemote = useCallback((fn) => {
    remote.current = fn;
    return () => {
      if (remote.current === fn) remote.current = null;
    };
  }, []);

  // In auto mode, follow OS changes while the app is open.
  useEffect(() => {
    if (mode !== "auto") return undefined;
    const query = darkQuery();
    const onChange = () => setSystemDark(query.matches);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, [mode]);

  // Browser UI colour (mobile address bar) follows the ground colour.
  useEffect(() => {
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", resolved === "dark" ? "#0D1112" : "#EEF2F1");
  }, [resolved]);

  const value = useMemo(() => ({ mode, resolved, setMode, setShiftDark, registerRemote }), [mode, resolved, setMode, setShiftDark, registerRemote]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
