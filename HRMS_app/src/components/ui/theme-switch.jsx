import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "../../theme/theme";
import { cn } from "../../lib/utils";

const OPTIONS = [
  { value: "light", label: "Light", Icon: Sun },
  { value: "dark", label: "Dark", Icon: Moon },
  { value: "auto", label: "Auto", Icon: Monitor },
];

// Light / dark / auto (follow the OS). `compact` shows icons only.
export function ThemeSwitch({ compact = false, className }) {
  const { mode, setMode } = useTheme();
  return (
    <div role="group" aria-label="Colour theme" className={cn("inline-flex rounded-full border border-line bg-sunk p-[3px]", className)}>
      {OPTIONS.map(({ value, label, Icon }) => {
        const pressed = mode === value;
        return (
          <button
            key={value}
            type="button"
            aria-pressed={pressed}
            aria-label={compact ? `${label} theme` : undefined}
            title={compact ? `${label} theme` : undefined}
            onClick={() => setMode(value)}
            className={cn(
              "inline-flex h-8 items-center justify-center gap-1.5 rounded-full font-mono text-[11px] uppercase tracking-[0.08em] transition-colors",
              compact ? "w-9" : "min-w-[44px] px-3",
              pressed ? "bg-teal text-on-accent" : "text-ink-2 hover:text-ink"
            )}
          >
            {compact ? <Icon className="h-3.5 w-3.5" aria-hidden="true" /> : label}
          </button>
        );
      })}
    </div>
  );
}
