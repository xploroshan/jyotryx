/**
 * Lightweight astrology animation for the hero section.
 * Pure SVG + CSS animations — no external deps, ~3KB.
 *
 * Layers (outermost → innermost):
 *   1. Zodiac ring    : 12 zodiac glyphs slowly rotating clockwise
 *   2. Planet orbit   : 5 planet dots counter-rotating on a dashed ring
 *   3. Central glow   : pulsing Om/sun symbol
 *   4. Twinkling stars: scattered randomly across the viewport
 */

const ZODIAC_SYMBOLS = [
  "♈", "♉", "♊", "♋", "♌", "♍",
  "♎", "♏", "♐", "♑", "♒", "♓",
];

// Fixed pseudo-random star positions (deterministic to avoid hydration issues)
const STARS = [
  { x: 8, y: 18, r: 0.8, d: 0 },
  { x: 92, y: 22, r: 1.1, d: 1.2 },
  { x: 15, y: 72, r: 0.6, d: 2.5 },
  { x: 88, y: 78, r: 0.9, d: 0.6 },
  { x: 45, y: 10, r: 0.7, d: 3.1 },
  { x: 55, y: 88, r: 1.0, d: 1.8 },
  { x: 22, y: 40, r: 0.5, d: 2.2 },
  { x: 78, y: 48, r: 0.8, d: 0.4 },
  { x: 35, y: 28, r: 0.6, d: 3.4 },
  { x: 68, y: 68, r: 0.7, d: 2.8 },
  { x: 12, y: 55, r: 0.9, d: 1.5 },
  { x: 90, y: 58, r: 0.6, d: 0.9 },
  { x: 50, y: 45, r: 0.4, d: 2.0 },
  { x: 28, y: 85, r: 0.7, d: 1.3 },
  { x: 72, y: 15, r: 0.8, d: 2.7 },
];

export default function AstrologyAnimation() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 overflow-hidden"
    >
      {/* Twinkling star field */}
      <svg
        className="absolute inset-0 h-full w-full"
        viewBox="0 0 100 100"
        preserveAspectRatio="xMidYMid slice"
      >
        {STARS.map((s, i) => (
          <circle
            key={i}
            cx={s.x}
            cy={s.y}
            r={s.r * 0.1}
            fill="currentColor"
            className="text-white/70 [animation:astro-twinkle_3s_ease-in-out_infinite]"
            style={{ animationDelay: `${s.d}s` }}
          />
        ))}
      </svg>

      {/* Rotating zodiac wheel — centered in hero */}
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
        <div className="relative h-[520px] w-[520px] sm:h-[640px] sm:w-[640px]">
          {/* Outer zodiac ring (rotating clockwise) */}
          <div className="absolute inset-0 [animation:astro-spin_120s_linear_infinite]">
            <svg className="h-full w-full" viewBox="0 0 600 600">
              {/* Outer dashed circle */}
              <circle
                cx="300"
                cy="300"
                r="280"
                fill="none"
                stroke="currentColor"
                strokeWidth="0.5"
                strokeDasharray="2 6"
                className="text-primary-400/20"
              />
              {/* Inner fine circle */}
              <circle
                cx="300"
                cy="300"
                r="260"
                fill="none"
                stroke="currentColor"
                strokeWidth="0.3"
                className="text-primary-400/15"
              />
              {/* 12 zodiac glyphs at each 30° */}
              {ZODIAC_SYMBOLS.map((sym, i) => {
                const angle = (i * 30 - 90) * (Math.PI / 180);
                const x = 300 + Math.cos(angle) * 270;
                const y = 300 + Math.sin(angle) * 270;
                return (
                  <text
                    key={sym}
                    x={x}
                    y={y}
                    fontSize="20"
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fill="currentColor"
                    className="text-primary-300/40"
                  >
                    {sym}
                  </text>
                );
              })}
              {/* Tick marks between each sign */}
              {Array.from({ length: 12 }).map((_, i) => {
                const angle = (i * 30 + 15 - 90) * (Math.PI / 180);
                const x1 = 300 + Math.cos(angle) * 255;
                const y1 = 300 + Math.sin(angle) * 255;
                const x2 = 300 + Math.cos(angle) * 265;
                const y2 = 300 + Math.sin(angle) * 265;
                return (
                  <line
                    key={i}
                    x1={x1}
                    y1={y1}
                    x2={x2}
                    y2={y2}
                    stroke="currentColor"
                    strokeWidth="0.8"
                    className="text-primary-400/30"
                  />
                );
              })}
            </svg>
          </div>

          {/* Middle planet orbit (counter-rotating) */}
          <div className="absolute inset-0 [animation:astro-spin-rev_90s_linear_infinite]">
            <svg className="h-full w-full" viewBox="0 0 600 600">
              <circle
                cx="300"
                cy="300"
                r="180"
                fill="none"
                stroke="currentColor"
                strokeWidth="0.4"
                strokeDasharray="1 4"
                className="text-primary-400/20"
              />
              {/* 5 planet dots at unequal angles */}
              {[0, 72, 144, 216, 288].map((deg, i) => {
                const angle = (deg - 90) * (Math.PI / 180);
                const x = 300 + Math.cos(angle) * 180;
                const y = 300 + Math.sin(angle) * 180;
                const sizes = [3, 2.2, 2.8, 1.8, 2.5];
                return (
                  <circle
                    key={i}
                    cx={x}
                    cy={y}
                    r={sizes[i]}
                    fill="currentColor"
                    className="text-primary-300/50"
                  />
                );
              })}
            </svg>
          </div>

          {/* Inner slow ring (rotating clockwise, different speed) */}
          <div className="absolute inset-0 [animation:astro-spin_60s_linear_infinite]">
            <svg className="h-full w-full" viewBox="0 0 600 600">
              <circle
                cx="300"
                cy="300"
                r="100"
                fill="none"
                stroke="currentColor"
                strokeWidth="0.3"
                className="text-primary-400/15"
              />
              {/* 3 small sparks */}
              {[0, 120, 240].map((deg, i) => {
                const angle = (deg - 90) * (Math.PI / 180);
                const x = 300 + Math.cos(angle) * 100;
                const y = 300 + Math.sin(angle) * 100;
                return (
                  <circle
                    key={i}
                    cx={x}
                    cy={y}
                    r={1.2}
                    fill="currentColor"
                    className="text-accent-400/50"
                  />
                );
              })}
            </svg>
          </div>

          {/* Central pulsing glow */}
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
            <div className="relative">
              <div className="absolute inset-0 h-16 w-16 -translate-x-1/2 -translate-y-1/2 left-1/2 top-1/2 rounded-full bg-primary-500/10 blur-xl [animation:astro-pulse_4s_ease-in-out_infinite]" />
              <svg
                width="28"
                height="28"
                viewBox="0 0 24 24"
                fill="none"
                className="relative text-primary-300/60 [animation:astro-pulse_4s_ease-in-out_infinite]"
              >
                <circle
                  cx="12"
                  cy="12"
                  r="3"
                  fill="currentColor"
                />
                {/* 8 rays */}
                {Array.from({ length: 8 }).map((_, i) => {
                  const angle = (i * 45 - 90) * (Math.PI / 180);
                  const x1 = 12 + Math.cos(angle) * 5;
                  const y1 = 12 + Math.sin(angle) * 5;
                  const x2 = 12 + Math.cos(angle) * 9;
                  const y2 = 12 + Math.sin(angle) * 9;
                  return (
                    <line
                      key={i}
                      x1={x1}
                      y1={y1}
                      x2={x2}
                      y2={y2}
                      stroke="currentColor"
                      strokeWidth="1.2"
                      strokeLinecap="round"
                    />
                  );
                })}
              </svg>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
