import { createContext, useContext, useMemo } from "react";

// Theme mode is "light", "dark" or "auto" (follow the OS). The resolved theme is
// always "light" or "dark". index.html applies the saved mode before first paint.
export const THEME_STORAGE_KEY = "pulse-theme";
export const THEME_MODES = ["light", "dark", "auto"];

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

// Colours for the legacy Recharts dashboards (replaced by the Pulse marks in
// Phase 6). Same shape as the old hard-coded `colors` objects.
export const useChartColors = () => {
  const t = useTokens();
  return useMemo(
    () => ({
      primary: t.teal,
      secondary: t.tealHi,
      accent: t.teal,
      background: t.raise,
      card: t.panel,
      text: t.ink,
      textSecondary: t.ink3,
      border: t.line2,
      grid: t.line,
      axis: t.ink3,
      danger: t.red,
      chartColors: [t.teal, t.blue, t.red, t.amber, t.violet, t.ink3, t.tealHi],
    }),
    [t]
  );
};
