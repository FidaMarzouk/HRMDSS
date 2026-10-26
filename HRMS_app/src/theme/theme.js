import { createContext, useContext, useMemo } from "react";

// Theme mode is "light", "dark", "auto" (follow the OS) or "shift" (light during
// your working day, dark once you have punched out). The resolved theme is
// always "light" or "dark". index.html applies the saved mode before first paint.
export const THEME_STORAGE_KEY = "pulse-theme";
// Last resolved colour in "shift" mode, for the first paint.
export const THEME_SHIFT_KEY = "pulse-theme-shift";
export const THEME_MODES = ["light", "dark", "auto", "shift"];

// Outside 07:00-19:00 counts as off-shift when no punch says otherwise.
export const offShiftByClock = (now = new Date()) => now.getHours() < 7 || now.getHours() >= 19;

export const ThemeContext = createContext(null);

export const useTheme = () => {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used inside <ThemeProvider>");
  return ctx;
};

const TOKEN_NAMES = ["ground", "panel", "raise", "sunk", "line", "line-2", "edge", "ink", "ink-2", "ink-3", "teal", "teal-hi", "on-accent", "amber", "red", "blue", "violet"];

const camel = (name) => name.replace(/-(\w)/g, (_, c) => c.toUpperCase());

// Resolved colours ("rgb(11 115 106)") for code that cannot use CSS classes,
// such as SVG chart attributes. Recomputed whenever the theme changes.
export const useTokens = () => {
  const { resolved } = useTheme();
  return useMemo(() => {
    const style = getComputedStyle(document.documentElement);
    return Object.fromEntries(
      TOKEN_NAMES.map((name) => [camel(name), `rgb(${style.getPropertyValue(`--${name}`).trim()})`])
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resolved]);
};

// CSS value for inline styles; follows theme changes without re-rendering.
export const tokenVar = (name, alpha) => (alpha == null ? `rgb(var(--${name}))` : `rgb(var(--${name}) / ${alpha})`);
