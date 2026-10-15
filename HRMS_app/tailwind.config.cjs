// Colours come only from the ENOVA Pulse tokens in src/styles/tokens.css, so every
// class follows the light/dark theme. The default Tailwind palette is replaced,
// not extended: a class like `text-gray-400` produces no CSS on purpose.
const token = (name) => `rgb(var(--${name}) / <alpha-value>)`;

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./index.html", "./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    colors: {
      transparent: "transparent",
      current: "currentColor",
      inherit: "inherit",
      white: "#fff",
      black: "#000",
      ground: token("ground"),
      panel: token("panel"),
      raise: token("raise"),
      sunk: token("sunk"),
      line: { DEFAULT: token("line"), 2: token("line-2") },
      edge: token("edge"),
      ink: { DEFAULT: token("ink"), 2: token("ink-2"), 3: token("ink-3") },
      teal: { DEFAULT: token("teal"), hi: token("teal-hi") },
      "on-accent": token("on-accent"),
      amber: token("amber"),
      red: token("red"),
      blue: token("blue"),
      violet: token("violet"),
      scrim: "var(--scrim)",
    },
    fontFamily: {
      sans: ['"IBM Plex Sans"', "system-ui", "-apple-system", '"Segoe UI"', "sans-serif"],
      display: ['"IBM Plex Sans Condensed"', '"IBM Plex Sans"', '"Arial Narrow"', "sans-serif"],
      mono: ['"IBM Plex Mono"', "ui-monospace", '"Cascadia Mono"', "Consolas", "monospace"],
    },
    extend: {
      boxShadow: {
        pop: "var(--shadow)",
      },
      minHeight: {
        target: "44px",
      },
      minWidth: {
        target: "44px",
      },
    },
  },
  plugins: [],
};
