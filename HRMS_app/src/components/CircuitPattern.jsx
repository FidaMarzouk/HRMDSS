// Decorative circuit-board background used across the dashboards.
const CircuitPattern = ({ id = "circuit" }) => (
  <div className="absolute inset-0 z-0 opacity-10 pointer-events-none">
    <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
      <pattern id={id} x="0" y="0" width="100" height="100" patternUnits="userSpaceOnUse">
        <path d="M20 40 L40 40 L40 20 L60 20 L60 40 L80 40" stroke="#3baca5" fill="none" strokeWidth="2" />
        <path d="M20 60 L40 60 L40 80 L60 80 L60 60 L80 60" stroke="#3baca5" fill="none" strokeWidth="2" />
        <circle cx="20" cy="40" r="3" fill="#3baca5" />
        <circle cx="80" cy="40" r="3" fill="#3baca5" />
        <circle cx="20" cy="60" r="3" fill="#3baca5" />
        <circle cx="80" cy="60" r="3" fill="#3baca5" />
      </pattern>
      <rect width="100%" height="100%" fill={`url(#${id})`} />
    </svg>
  </div>
);

export default CircuitPattern;
