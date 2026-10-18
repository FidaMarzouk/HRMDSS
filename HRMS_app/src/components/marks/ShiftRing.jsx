// Shift ring: worked time (teal) and breaks (grey) around the expected day,
// with a faint dotted outer scale. Minutes in, SVG out.
const R = 80;
const C = 2 * Math.PI * R;

export function ShiftRing({ workedMinutes = 0, breakMinutes = 0, expectedMinutes = 510, size = 170, children, label }) {
  const total = Math.max(expectedMinutes, workedMinutes + breakMinutes);
  const workLen = (Math.min(workedMinutes, total) / total) * C;
  const breakLen = (Math.min(breakMinutes, total) / total) * C;
  return (
    <div className="relative flex-none" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox="0 0 200 200" role="img" aria-label={label}>
        <circle cx="100" cy="100" r={R} fill="none" stroke="rgb(var(--sunk))" strokeWidth="14" />
        <circle
          cx="100" cy="100" r={R} fill="none" stroke="rgb(var(--teal))" strokeWidth="14"
          strokeDasharray={`${workLen} ${C}`} transform="rotate(-90 100 100)"
        />
        {breakLen > 0 && (
          <circle
            cx="100" cy="100" r={R} fill="none" stroke="rgb(var(--ink-3))" strokeWidth="14"
            strokeDasharray={`0 ${workLen} ${breakLen} ${C}`} transform="rotate(-90 100 100)"
          />
        )}
        <circle cx="100" cy="100" r="95" fill="none" stroke="rgb(var(--line-2))" strokeWidth="1" strokeDasharray="1 8.95" />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">{children}</div>
    </div>
  );
}
