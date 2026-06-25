// Generate the raster brand icon set from the MyAstro360 Shatkona mark.
//
// Browser tabs, iOS home screens, and Android/PWA installs can't all use the
// SVG favicon (iOS ignores SVG; Lighthouse wants 192/512 PNGs; some crawlers
// fetch /favicon.ico). This script rasterizes the mark — on the brand ink
// plate — into that set using `sharp` (already a Next.js dependency, so no new
// install). Re-run after any mark change:
//
//   node apps/web/scripts/gen-icons.mjs
//
// Outputs (committed) to apps/web/public/:
//   favicon.ico            16 + 32 px (PNG-in-ICO)
//   apple-touch-icon.png   180 px, opaque ink bg (iOS rounds corners itself)
//   icon-192.png           192 px, maskable (content inside the safe zone)
//   icon-512.png           512 px, maskable
import sharp from 'sharp';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const PUBLIC = join(dirname(fileURLToPath(import.meta.url)), '..', 'public');
const INK = '#14100c';

// Mark drawn in the native 0..100 space, in the warm sunrise palette,
// brightened for legibility on the dark plate.
const DEFS = `
  <defs>
    <linearGradient id="g-ring" gradientUnits="userSpaceOnUse" x1="14" y1="14" x2="86" y2="86">
      <stop offset="0" stop-color="#ffd089"/><stop offset="0.5" stop-color="#ffb627"/><stop offset="1" stop-color="#ff7a40"/>
    </linearGradient>
    <linearGradient id="g-star" gradientUnits="userSpaceOnUse" x1="30" y1="30" x2="70" y2="70">
      <stop offset="0" stop-color="#ffc56b"/><stop offset="1" stop-color="#ff7a40"/>
    </linearGradient>
  </defs>`;

const MARK = `
  <circle cx="50" cy="50" r="40" fill="none" stroke="url(#g-ring)" stroke-width="2.8" opacity="0.9"/>
  <g stroke="url(#g-ring)" stroke-width="3.4" stroke-linecap="round" opacity="0.75">
    <line x1="84" y1="50" x2="90" y2="50"/><line x1="79.4" y1="67" x2="84.6" y2="70"/>
    <line x1="67" y1="79.4" x2="70" y2="84.6"/><line x1="50" y1="84" x2="50" y2="90"/>
    <line x1="33" y1="79.4" x2="30" y2="84.6"/><line x1="20.6" y1="67" x2="15.4" y2="70"/>
    <line x1="16" y1="50" x2="10" y2="50"/><line x1="20.6" y1="33" x2="15.4" y2="30"/>
    <line x1="33" y1="20.6" x2="30" y2="15.4"/><line x1="50" y1="16" x2="50" y2="10"/>
    <line x1="67" y1="20.6" x2="70" y2="15.4"/><line x1="79.4" y1="33" x2="84.6" y2="30"/>
  </g>
  <path d="M50 24 L73 64 L27 64 Z" fill="none" stroke="url(#g-star)" stroke-width="4.8" stroke-linejoin="round"/>
  <path d="M50 76 L27 36 L73 36 Z" fill="none" stroke="url(#g-star)" stroke-width="4.8" stroke-linejoin="round"/>
  <circle cx="50" cy="50" r="4" fill="url(#g-star)"/>`;

// Full-bleed ink square with the mark scaled about center. `radius` rounds the
// plate (favicon only); maskable/apple icons stay square so the platform mask
// owns the corners. `scale` keeps the mark inside the maskable safe zone.
const squareSvg = ({ scale, radius = 0 }) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">${DEFS}
    <rect width="100" height="100" rx="${radius}" fill="${INK}"/>
    <g transform="translate(50 50) scale(${scale}) translate(-50 -50)">${MARK}</g>
  </svg>`;

const renderPng = (svg, size) =>
  sharp(Buffer.from(svg)).resize(size, size).png().toBuffer();

// Vista+ ICO container: each entry is a full PNG, sizes read from the PNG IHDR.
function icoFromPngs(pngs) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(1, 2); // type = icon
  header.writeUInt16LE(pngs.length, 4);
  const dir = Buffer.alloc(16 * pngs.length);
  let offset = 6 + 16 * pngs.length;
  pngs.forEach((p, i) => {
    const w = p.readUInt32BE(16);
    const h = p.readUInt32BE(20);
    const e = dir.subarray(i * 16);
    e.writeUInt8(w >= 256 ? 0 : w, 0);
    e.writeUInt8(h >= 256 ? 0 : h, 1);
    e.writeUInt16LE(1, 4); // color planes
    e.writeUInt16LE(32, 6); // bits per pixel
    e.writeUInt32LE(p.length, 8);
    e.writeUInt32LE(offset, 12);
    offset += p.length;
  });
  return Buffer.concat([header, dir, ...pngs]);
}

const write = (name, buf) => {
  writeFileSync(join(PUBLIC, name), buf);
  console.log('wrote', name, buf.length, 'bytes');
};

const maskable = squareSvg({ scale: 0.74 });
write('icon-192.png', await renderPng(maskable, 192));
write('icon-512.png', await renderPng(maskable, 512));
write('apple-touch-icon.png', await renderPng(squareSvg({ scale: 0.8 }), 180));

const fav = squareSvg({ scale: 0.8, radius: 22 });
write('favicon.ico', icoFromPngs([await renderPng(fav, 16), await renderPng(fav, 32)]));
