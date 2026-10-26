import { tokenVar } from "../../theme/theme";

// Colours for marks, as CSS values that follow the theme without re-rendering.
export const TONE = {
  teal: tokenVar("teal"),
  amber: tokenVar("amber"),
  red: tokenVar("red"),
  blue: tokenVar("blue"),
  violet: tokenVar("violet"),
  ink: tokenVar("ink"),
  ink2: tokenVar("ink-2"),
  ink3: tokenVar("ink-3"),
  line: tokenVar("line"),
  line2: tokenVar("line-2"),
  sunk: tokenVar("sunk"),
};

// Categories without a meaning of their own (leave types, event types...).
// Amber and red are left out: they are reserved for exceptions.
export const CATEGORICAL = [TONE.teal, TONE.blue, TONE.violet, TONE.ink3, tokenVar("teal", 0.45), tokenVar("blue", 0.45), tokenVar("violet", 0.45)];

export const categorical = (i) => CATEGORICAL[i % CATEGORICAL.length];

// Number formatting shared by marks and tables.
export const fmt = {
  int: (n) => (n == null ? "—" : Math.round(n).toLocaleString("en-GB")),
  one: (n) => (n == null ? "—" : (Math.round(n * 10) / 10).toLocaleString("en-GB", { maximumFractionDigits: 1 })),
  pct: (n) => (n == null ? "—" : `${(Math.round(n * 10) / 10).toLocaleString("en-GB", { maximumFractionDigits: 1 })} %`),
  hours: (n) => (n == null ? "—" : `${(Math.round(n * 10) / 10).toLocaleString("en-GB", { maximumFractionDigits: 1 })} h`),
  clock: (m) => (m == null ? "—" : `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(Math.round(m % 60)).padStart(2, "0")}`),
};
