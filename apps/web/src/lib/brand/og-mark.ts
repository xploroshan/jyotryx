/**
 * Brand Shatkona mark as a base64 data URI, for embedding in next/og (Satori)
 * social cards via `<img>`. Satori rasterizes an SVG `<img>` reliably, whereas
 * inline stroked SVG + gradients render inconsistently across Satori versions.
 * Brightened strokes so it reads on the dark brand card. Node runtime only
 * (uses `Buffer`); both OG routes declare `runtime = "nodejs"`.
 */
const MARK_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" fill="none">
  <defs>
    <linearGradient id="r" gradientUnits="userSpaceOnUse" x1="14" y1="14" x2="86" y2="86">
      <stop offset="0" stop-color="#a5b4fc"/><stop offset="0.5" stop-color="#818cf8"/><stop offset="1" stop-color="#a78bfa"/>
    </linearGradient>
    <linearGradient id="s" gradientUnits="userSpaceOnUse" x1="30" y1="30" x2="70" y2="70">
      <stop offset="0" stop-color="#c4b5fd"/><stop offset="1" stop-color="#a78bfa"/>
    </linearGradient>
  </defs>
  <circle cx="50" cy="50" r="40" fill="none" stroke="url(#r)" stroke-width="2.4" opacity="0.9"/>
  <g stroke="url(#r)" stroke-width="3" stroke-linecap="round" opacity="0.75">
    <line x1="84" y1="50" x2="90" y2="50"/><line x1="79.4" y1="67" x2="84.6" y2="70"/>
    <line x1="67" y1="79.4" x2="70" y2="84.6"/><line x1="50" y1="84" x2="50" y2="90"/>
    <line x1="33" y1="79.4" x2="30" y2="84.6"/><line x1="20.6" y1="67" x2="15.4" y2="70"/>
    <line x1="16" y1="50" x2="10" y2="50"/><line x1="20.6" y1="33" x2="15.4" y2="30"/>
    <line x1="33" y1="20.6" x2="30" y2="15.4"/><line x1="50" y1="16" x2="50" y2="10"/>
    <line x1="67" y1="20.6" x2="70" y2="15.4"/><line x1="79.4" y1="33" x2="84.6" y2="30"/>
  </g>
  <path d="M50 24 L73 64 L27 64 Z" fill="none" stroke="url(#s)" stroke-width="4.2" stroke-linejoin="round"/>
  <path d="M50 76 L27 36 L73 36 Z" fill="none" stroke="url(#s)" stroke-width="4.2" stroke-linejoin="round"/>
  <circle cx="50" cy="50" r="3.6" fill="url(#s)"/>
</svg>`;

export const OG_MARK_DATA_URI = `data:image/svg+xml;base64,${Buffer.from(MARK_SVG).toString("base64")}`;

/** The gradient "360" treatment — text-clipped indigo→violet→fuchsia. */
export const GRADIENT_360_STYLE = {
  backgroundImage: "linear-gradient(90deg, #818cf8, #a78bfa, #d946ef)",
  backgroundClip: "text",
  WebkitBackgroundClip: "text",
  color: "transparent",
} as const;

/** Brand ink card background — the cool counterpart of the warm legacy card. */
export const OG_INK_BG = "linear-gradient(135deg, #0c0c1a 0%, #15102e 55%, #08080c 100%)";
