"use client";

/**
 * PalmWireframe — the sci-fi neon rendering of the USER'S OWN palm.
 *
 * Unlike PalmDiagram (a fixed schematic), every stroke here comes from
 * measured/extracted geometry of the analysed photo:
 *  - the hand skeleton + palm web from the 21 MediaPipe landmarks,
 *  - the crease lines from the vision-extracted polylines (optionally
 *    edge-snapped onto the photo's actual creases),
 *  - the labels are crisp SVG text (never garbled, unlike AI-generated art).
 *
 * Renders on a near-black HUD backdrop with neon glows; exports to PNG.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { smoothPath, snapPointsToEdges, sobelMagnitude, toGrayscale, type Point } from "@/lib/palm/wireframePath";

// ─── Data shapes (mirror analysisData.geometry/verification from the API) ────
export interface PalmGeometryData {
  landmarks: { x: number; y: number; z: number }[];
  handedness: "Left" | "Right";
  metrics: {
    palmAspect: number;
    fingerRatio: number;
    handShape: string;
  } | null;
  polylines: {
    name: string;
    kind: "major" | "minor" | "sub";
    points: [number, number][];
    confidence: number;
  }[];
}

export interface PalmVerificationData {
  verificationId: string;
  groundednessScore: number;
  authentic: boolean;
  authenticReason?: string;
  duplicateOf?: { readingId: string; createdAt: string } | null;
  checks: { code: string; expected: string; observed: string; pass: boolean }[];
}

interface PalmWireframeProps {
  geometry: PalmGeometryData;
  /** Data URL of the analysed photo — enables edge-snap + the underlay toggle. */
  sourceImage?: string | null;
  onFeatureSelect?: (feature: { type: "line" | "mount"; name: string }) => void;
  selectedFeature?: string | null;
  labels: {
    title: string;
    download: string;
    showPhoto: string;
    measured: string;
    major: string;
    minor: string;
    skeleton: string;
  };
}

// Same palette as PalmDiagram so line colors stay consistent across both views.
const LINE_COLORS: Record<string, string> = {
  "heart line": "#f43f5e",
  "head line": "#3b82f6",
  "life line": "#22c55e",
  "fate line": "#a855f7",
  "sun line": "#f59e0b",
};
const MINOR_COLOR = "#2dd4bf"; // teal
const SUB_COLOR = "#67e8f9"; // light cyan
const SKELETON_COLOR = "#22d3ee"; // neon cyan
const BG = "#05080f";

const W = 1000; // viewBox width; height derives from the photo aspect

// MediaPipe hand topology (bone chains).
const BONE_CHAINS = [
  [0, 1, 2, 3, 4], // thumb
  [0, 5, 6, 7, 8], // index
  [0, 9, 10, 11, 12], // middle
  [0, 13, 14, 15, 16], // ring
  [0, 17, 18, 19, 20], // little
];
const KNUCKLE_ROW = [5, 9, 13, 17];

function lineColor(name: string, kind: string): string {
  const c = LINE_COLORS[name.toLowerCase()];
  if (c) return c;
  return kind === "sub" ? SUB_COLOR : MINOR_COLOR;
}

export default function PalmWireframe({
  geometry,
  sourceImage,
  onFeatureSelect,
  selectedFeature,
  labels,
}: PalmWireframeProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [showPhoto, setShowPhoto] = useState(false);
  const [hovered, setHovered] = useState<string | null>(null);
  // Edge-snapped polylines (falls back to the raw model trace until ready).
  const [snapped, setSnapped] = useState<Record<string, Point[]> | null>(null);

  const hasLandmarks = geometry.landmarks?.length === 21;
  // Photo aspect is unknown here; landmarks+polylines are normalized to the
  // image, so we render square-ish 4:5 (portrait palm) — H chosen so labels fit.
  const H = 1250;

  const sx = useCallback((nx: number) => nx * W, []);
  const sy = useCallback((ny: number) => ny * H, [H]);

  // ── Edge-snap refinement: nudge the model's trace onto the photo's actual
  // creases (pure JS Sobel on a ≤512px grayscale copy; best-effort). ──
  useEffect(() => {
    let cancelled = false;
    setSnapped(null);
    if (!sourceImage || geometry.polylines.length === 0) return;
    const img = new Image();
    img.onload = () => {
      try {
        if (cancelled) return;
        const scale = Math.min(1, 512 / Math.max(img.naturalWidth, img.naturalHeight));
        const cw = Math.max(2, Math.round(img.naturalWidth * scale));
        const ch = Math.max(2, Math.round(img.naturalHeight * scale));
        const canvas = document.createElement("canvas");
        canvas.width = cw;
        canvas.height = ch;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        ctx.drawImage(img, 0, 0, cw, ch);
        const data = ctx.getImageData(0, 0, cw, ch);
        const mag = sobelMagnitude(toGrayscale(data.data, cw, ch), cw, ch);
        const next: Record<string, Point[]> = {};
        for (const line of geometry.polylines) {
          next[`${line.name}|${line.kind}`] = snapPointsToEdges(line.points, mag, cw, ch, 6);
        }
        if (!cancelled) setSnapped(next);
      } catch {
        // Snapping is a refinement — the raw trace still renders.
      }
    };
    img.src = sourceImage;
    return () => {
      cancelled = true;
    };
  }, [sourceImage, geometry.polylines]);

  const paths = useMemo(
    () =>
      geometry.polylines.map((line) => {
        const pts = snapped?.[`${line.name}|${line.kind}`] ?? line.points;
        return {
          ...line,
          d: smoothPath(pts.map(([x, y]) => [sx(x), sy(y)] as Point)),
          end: pts[pts.length - 1],
          mid: pts[Math.floor(pts.length / 2)],
        };
      }),
    [geometry.polylines, snapped, sx, sy],
  );

  // Label placement: majors right side stack, alternate leader anchors.
  const majorPaths = paths.filter((p) => p.kind === "major");
  const minorPaths = paths.filter((p) => p.kind !== "major");

  const handleDownload = useCallback(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const xml = new XMLSerializer().serializeToString(svg);
    const blob = new Blob([xml], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = W * 2;
      canvas.height = H * 2;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.fillStyle = BG;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      canvas.toBlob((png) => {
        if (!png) return;
        const a = document.createElement("a");
        a.href = URL.createObjectURL(png);
        a.download = "palm-wireframe.png";
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 5000);
      }, "image/png");
    };
    img.src = url;
  }, [H]);

  const strokeFor = (kind: string, name: string) => {
    const isSelected = selectedFeature === name || hovered === name;
    const base = kind === "major" ? 5 : kind === "minor" ? 3 : 2;
    return isSelected ? base + 2 : base;
  };

  return (
    <div className="rounded-2xl overflow-hidden border border-cyan-500/20 bg-[#05080f]">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-cyan-500/15">
        <p className="text-xs font-semibold tracking-[0.2em] uppercase text-cyan-300/90">
          {labels.title} <span aria-hidden className="text-cyan-500/60">::</span>
        </p>
        <div className="flex items-center gap-3">
          {sourceImage && (
            <label className="flex items-center gap-1.5 text-[11px] text-cyan-200/70 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={showPhoto}
                onChange={(e) => setShowPhoto(e.target.checked)}
                className="accent-cyan-400 h-3 w-3"
              />
              {labels.showPhoto}
            </label>
          )}
          <button
            type="button"
            onClick={handleDownload}
            className="text-[11px] font-medium text-cyan-300 hover:text-cyan-100 border border-cyan-500/30 rounded-lg px-2.5 py-1 transition-colors"
          >
            {labels.download}
          </button>
        </div>
      </div>

      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        className="w-full h-auto block"
        role="img"
        aria-label={labels.title}
      >
        {/* Backdrop */}
        <rect x="0" y="0" width={W} height={H} fill={BG} />
        {/* Subtle HUD grid */}
        <g opacity="0.08" stroke="#38bdf8" strokeWidth="1">
          {Array.from({ length: 9 }, (_, i) => (
            <line key={`gv${i}`} x1={((i + 1) * W) / 10} y1="0" x2={((i + 1) * W) / 10} y2={H} />
          ))}
          {Array.from({ length: 11 }, (_, i) => (
            <line key={`gh${i}`} x1="0" y1={((i + 1) * H) / 12} x2={W} y2={((i + 1) * H) / 12} />
          ))}
        </g>
        {/* HUD corner ticks */}
        <g stroke="#22d3ee" strokeWidth="3" opacity="0.7" fill="none">
          <path d={`M 20,60 L 20,20 L 60,20`} />
          <path d={`M ${W - 60},20 L ${W - 20},20 L ${W - 20},60`} />
          <path d={`M 20,${H - 60} L 20,${H - 20} L 60,${H - 20}`} />
          <path d={`M ${W - 60},${H - 20} L ${W - 20},${H - 20} L ${W - 20},${H - 60}`} />
        </g>

        <defs>
          <filter id="wfGlow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="wfGlowStrong" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="8" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Optional photo underlay (local data URL — same-origin, no taint) */}
        {showPhoto && sourceImage && (
          <image href={sourceImage} x="0" y="0" width={W} height={H} preserveAspectRatio="xMidYMid slice" opacity="0.35" />
        )}

        {/* ── The hand as a soft glowing silhouette (elegant, not skeletal):
            each finger drawn as a thick rounded translucent stroke + a filled
            palm shape, matching the user's actual proportions. ── */}
        {hasLandmarks && (() => {
          const lm = geometry.landmarks;
          // Finger thickness derived from the user's own palm width.
          const palmW = Math.hypot(
            sx(lm[5].x) - sx(lm[17].x),
            sy(lm[5].y) - sy(lm[17].y),
          );
          const fingerW = Math.max(20, palmW / 4.2);
          const palmPath =
            `M ${sx(lm[0].x - 0.07)},${sy(lm[0].y)} ` +
            [5, 9, 13, 17]
              .map((i) => `L ${sx(lm[i].x)},${sy(lm[i].y)}`)
              .join(" ") +
            ` L ${sx(lm[0].x + 0.07)},${sy(lm[0].y)} Z`;
          return (
            <g>
              {/* Soft body fill */}
              <g opacity="0.14" filter="url(#wfGlow)">
                {BONE_CHAINS.map((chain, ci) => (
                  <polyline
                    key={`body${ci}`}
                    points={chain.map((i) => `${sx(lm[i].x)},${sy(lm[i].y)}`).join(" ")}
                    fill="none"
                    stroke={SKELETON_COLOR}
                    strokeWidth={fingerW}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                ))}
                <path d={palmPath} fill={SKELETON_COLOR} stroke={SKELETON_COLOR} strokeWidth={fingerW} strokeLinejoin="round" />
              </g>
              {/* Delicate contour highlight */}
              <g opacity="0.3">
                {BONE_CHAINS.map((chain, ci) => (
                  <polyline
                    key={`ctr${ci}`}
                    points={chain.map((i) => `${sx(lm[i].x)},${sy(lm[i].y)}`).join(" ")}
                    fill="none"
                    stroke={SKELETON_COLOR}
                    strokeWidth="1.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                ))}
                <polyline
                  points={KNUCKLE_ROW.map((i) => `${sx(lm[i].x)},${sy(lm[i].y)}`).join(" ")}
                  fill="none"
                  stroke={SKELETON_COLOR}
                  strokeWidth="1"
                />
              </g>
              {/* Subtle fingertip sparks (small, friendly — not joints) */}
              {[4, 8, 12, 16, 20].map((i) => (
                <circle key={`tip${i}`} cx={sx(lm[i].x)} cy={sy(lm[i].y)} r="3.5" fill={SKELETON_COLOR} opacity="0.6" filter="url(#wfGlow)" />
              ))}
            </g>
          );
        })()}

        {/* ── Crease lines (the user's actual palm lines) ── */}
        {minorPaths.map((p) => (
          <path
            key={`${p.name}-${p.kind}`}
            d={p.d}
            fill="none"
            stroke={lineColor(p.name, p.kind)}
            strokeWidth={strokeFor(p.kind, p.name)}
            strokeLinecap="round"
            opacity={p.kind === "sub" ? 0.55 : 0.8}
            filter="url(#wfGlow)"
            style={{ cursor: onFeatureSelect ? "pointer" : undefined }}
            onClick={() => onFeatureSelect?.({ type: "line", name: p.name })}
            onMouseEnter={() => setHovered(p.name)}
            onMouseLeave={() => setHovered(null)}
          >
            <title>{p.name}</title>
          </path>
        ))}
        {majorPaths.map((p) => (
          <path
            key={`${p.name}-${p.kind}`}
            d={p.d}
            fill="none"
            stroke={lineColor(p.name, p.kind)}
            strokeWidth={strokeFor(p.kind, p.name)}
            strokeLinecap="round"
            filter="url(#wfGlowStrong)"
            style={{ cursor: onFeatureSelect ? "pointer" : undefined }}
            onClick={() => onFeatureSelect?.({ type: "line", name: p.name })}
            onMouseEnter={() => setHovered(p.name)}
            onMouseLeave={() => setHovered(null)}
          >
            <title>{p.name}</title>
          </path>
        ))}

        {/* ── Crisp labels with SHORT leader lines beside each line's end
            (crossing leaders read as a spider web — keep them local). ── */}
        {(() => {
          // Anchor each label at its line-end height, on the nearer side, then
          // push overlapping labels apart vertically.
          const placed = majorPaths
            .filter((p) => p.end)
            .map((p) => {
              const onLeft = p.end![0] < 0.5;
              return {
                p,
                onLeft,
                ex: sx(p.end![0]),
                ey: sy(p.end![1]),
                ly: Math.min(H - 120, Math.max(90, sy(p.end![1]))),
              };
            })
            .sort((a, b) => a.ly - b.ly);
          const MIN_GAP = 54;
          for (let i = 1; i < placed.length; i++) {
            if (placed[i].ly - placed[i - 1].ly < MIN_GAP) placed[i].ly = placed[i - 1].ly + MIN_GAP;
          }
          return placed.map(({ p, onLeft, ex, ey, ly }) => {
            const lx = onLeft ? 30 : W - 30;
            const elbowX = onLeft ? Math.max(60, ex - 60) : Math.min(W - 60, ex + 60);
            return (
              <g key={`lbl-${p.name}`} opacity={hovered && hovered !== p.name ? 0.45 : 1}>
                <path
                  d={`M ${ex},${ey} L ${elbowX},${ly - 8} L ${onLeft ? lx + 6 : lx - 6},${ly - 8}`}
                  fill="none"
                  stroke={lineColor(p.name, p.kind)}
                  strokeWidth="1"
                  opacity="0.35"
                />
                <circle cx={ex} cy={ey} r="5" fill={lineColor(p.name, p.kind)} filter="url(#wfGlow)" />
                <text
                  x={lx}
                  y={ly}
                  textAnchor={onLeft ? "start" : "end"}
                  fill={lineColor(p.name, p.kind)}
                  fontSize="26"
                  fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
                  fontWeight="600"
                  letterSpacing="2"
                  style={{ textTransform: "uppercase" }}
                >
                  {p.name.toUpperCase()}
                </text>
              </g>
            );
          });
        })()}

        {/* Measured-ratio readout (real measurements, HUD style) */}
        {geometry.metrics && (
          <g fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace" fontSize="20" fill="#67e8f9" opacity="0.9">
            <text x="30" y={H - 84} letterSpacing="1">
              {labels.measured.toUpperCase()}
            </text>
            <text x="30" y={H - 52} opacity="0.8">
              {`ASPECT ${geometry.metrics.palmAspect.toFixed(2)} · FINGER ${Math.round(geometry.metrics.fingerRatio * 100)}% · ${geometry.metrics.handShape.toUpperCase()} · ${geometry.handedness.toUpperCase()}`}
            </text>
          </g>
        )}
      </svg>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 px-4 py-2.5 border-t border-cyan-500/15">
        {majorPaths.map((p) => (
          <span key={`lg-${p.name}`} className="flex items-center gap-1.5 text-[11px] text-cyan-100/80">
            <span className="inline-block h-1 w-4 rounded-full" style={{ background: lineColor(p.name, p.kind) }} aria-hidden />
            {p.name}
          </span>
        ))}
        {minorPaths.length > 0 && (
          <span className="flex items-center gap-1.5 text-[11px] text-cyan-100/60">
            <span className="inline-block h-1 w-4 rounded-full" style={{ background: MINOR_COLOR }} aria-hidden />
            {labels.minor}
          </span>
        )}
        {hasLandmarks && (
          <span className="flex items-center gap-1.5 text-[11px] text-cyan-100/60">
            <span className="inline-block h-1 w-4 rounded-full" style={{ background: SKELETON_COLOR }} aria-hidden />
            {labels.skeleton}
          </span>
        )}
      </div>
    </div>
  );
}
