"use client";

import { useState } from "react";

interface LineData {
  name: string;
  description: string;
  strength: string;
}

interface MountData {
  name: string;
  description: string;
  prominence: string;
}

interface AnalysisResult {
  majorLines: LineData[];
  minorLines: { name: string; description: string }[];
  mounts: MountData[];
  insights: { label: string; text: string }[];
  fingerAnalysis: { finger: string; interpretation: string }[];
}

interface PalmDiagramProps {
  analysis: AnalysisResult | null;
  onFeatureSelect?: (feature: { type: "line" | "mount"; name: string }) => void;
  selectedFeature?: string | null;
}

const LINE_COLORS: Record<string, string> = {
  "Heart Line": "#f43f5e",
  "Head Line": "#3b82f6",
  "Life Line": "#22c55e",
  "Fate Line": "#a855f7",
  "Sun Line": "#f59e0b",
};

const LINE_PATHS: Record<string, string> = {
  "Heart Line": "M 72,168 Q 120,148 155,152 Q 190,156 220,168 Q 240,176 255,182",
  "Head Line": "M 72,200 Q 110,190 145,192 Q 180,194 210,200 Q 235,208 252,216",
  "Life Line": "M 105,148 Q 95,180 88,210 Q 80,250 78,290 Q 76,320 80,350",
  "Fate Line": "M 160,350 Q 158,310 157,280 Q 156,250 155,220 Q 154,200 155,180",
  "Sun Line": "M 200,280 Q 198,250 196,230 Q 194,210 192,195",
};

const LINE_LABELS: Record<string, { x: number; y: number; anchor: "start" | "middle" | "end" }> = {
  "Heart Line": { x: 262, y: 178, anchor: "start" },
  "Head Line": { x: 260, y: 214, anchor: "start" },
  "Life Line": { x: 58, y: 290, anchor: "end" },
  "Fate Line": { x: 162, y: 356, anchor: "start" },
  "Sun Line": { x: 204, y: 284, anchor: "start" },
};

const MOUNT_POSITIONS: Record<string, { cx: number; cy: number }> = {
  "Mount of Jupiter": { cx: 120, cy: 140 },
  "Mount of Saturn": { cx: 158, cy: 132 },
  "Mount of Apollo": { cx: 196, cy: 136 },
  "Mount of Venus": { cx: 95, cy: 270 },
};

const MOUNT_LABELS: Record<string, string> = {
  "Mount of Jupiter": "Jupiter",
  "Mount of Saturn": "Saturn",
  "Mount of Apollo": "Apollo",
  "Mount of Venus": "Venus",
};

const FINGER_LABELS = [
  { name: "Thumb", x: 52, y: 235 },
  { name: "Index", x: 100, y: 72 },
  { name: "Middle", x: 148, y: 52 },
  { name: "Ring", x: 196, y: 62 },
  { name: "Little", x: 238, y: 92 },
];

function getStrengthStyle(strength: string) {
  switch ((strength || "").toLowerCase()) {
    case "strong":
      return { strokeWidth: 3, opacity: 1 };
    case "moderate":
      return { strokeWidth: 2.2, opacity: 0.8 };
    case "weak":
      return { strokeWidth: 1.5, opacity: 0.5 };
    default:
      return { strokeWidth: 2, opacity: 0.7 };
  }
}

function getProminenceRadius(prominence: string) {
  switch ((prominence || "").toLowerCase()) {
    case "high":
      return 18;
    case "medium":
      return 14;
    case "low":
      return 10;
    default:
      return 14;
  }
}

export default function PalmDiagram({
  analysis,
  onFeatureSelect,
  selectedFeature,
}: PalmDiagramProps) {
  const [hoveredFeature, setHoveredFeature] = useState<string | null>(null);
  const [tooltip, setTooltip] = useState<{
    text: string;
    x: number;
    y: number;
  } | null>(null);

  const isGuideMode = !analysis;

  const getLineStrength = (lineName: string): string => {
    if (!analysis) return "";
    const found = analysis.majorLines.find((l) => l.name === lineName);
    return found?.strength || "";
  };

  const getMountProminence = (mountName: string): string => {
    if (!analysis) return "";
    const found = analysis.mounts.find((m) => m.name === mountName);
    return found?.prominence || "";
  };

  const getLineDescription = (lineName: string): string => {
    if (!analysis) return "";
    const found = analysis.majorLines.find((l) => l.name === lineName);
    return found?.description || "";
  };

  const getMountDescription = (mountName: string): string => {
    if (!analysis) return "";
    const found = analysis.mounts.find((m) => m.name === mountName);
    return found?.description || "";
  };

  const handleLineClick = (lineName: string) => {
    onFeatureSelect?.({ type: "line", name: lineName });
  };

  const handleMountClick = (mountName: string) => {
    onFeatureSelect?.({ type: "mount", name: mountName });
  };

  const handleMouseEnter = (name: string, x: number, y: number, description: string) => {
    setHoveredFeature(name);
    if (description) {
      setTooltip({ text: description, x, y });
    }
  };

  const handleMouseLeave = () => {
    setHoveredFeature(null);
    setTooltip(null);
  };

  return (
    <div className="relative">
      <svg
        viewBox="0 0 320 430"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full max-w-[280px] mx-auto"
      >
        {/* Glow filter for selected/hovered elements */}
        <defs>
          <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="glowStrong" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Hand outline */}
        <path
          d={`
            M 160,400
            C 70,400 40,340 40,290
            L 40,245
            C 40,235 32,218 28,210
            C 18,190 15,180 20,175
            C 25,170 35,175 42,185
            L 55,210
            L 55,160
            C 55,148 62,138 72,138
            C 82,138 90,148 90,160
            L 90,100
            C 90,86 98,76 108,76
            C 118,76 126,86 126,100
            L 126,55
            C 126,40 134,28 145,28
            C 156,28 164,40 164,55
            L 164,90
            C 170,80 180,74 190,74
            C 202,74 210,84 210,100
            L 210,110
            C 216,100 226,94 236,96
            C 248,98 255,110 255,125
            L 255,240
            C 255,300 230,340 200,370
            C 185,385 172,395 160,400
            Z
          `}
          stroke="rgba(255,255,255,0.2)"
          strokeWidth="1.5"
          fill="rgba(255,255,255,0.02)"
        />

        {/* Finger separator lines (subtle) */}
        <line x1="90" y1="138" x2="90" y2="160" stroke="rgba(255,255,255,0.06)" strokeWidth="0.5" />
        <line x1="126" y1="100" x2="126" y2="55" stroke="rgba(255,255,255,0.06)" strokeWidth="0.5" />
        <line x1="164" y1="90" x2="164" y2="55" stroke="rgba(255,255,255,0.06)" strokeWidth="0.5" />
        <line x1="210" y1="110" x2="210" y2="100" stroke="rgba(255,255,255,0.06)" strokeWidth="0.5" />

        {/* Mount regions */}
        {Object.entries(MOUNT_POSITIONS).map(([name, pos]) => {
          const prominence = getMountProminence(name);
          const radius = isGuideMode ? 14 : getProminenceRadius(prominence);
          const isActive = selectedFeature === name || hoveredFeature === name;
          const desc = getMountDescription(name);

          return (
            <g
              key={name}
              className="cursor-pointer"
              onClick={() => handleMountClick(name)}
              onMouseEnter={() => handleMouseEnter(name, pos.cx, pos.cy - 25, desc)}
              onMouseLeave={handleMouseLeave}
            >
              <circle
                cx={pos.cx}
                cy={pos.cy}
                r={radius}
                fill={isActive ? "rgba(168,85,247,0.2)" : isGuideMode ? "rgba(255,255,255,0.03)" : "rgba(168,85,247,0.08)"}
                stroke={isActive ? "rgba(168,85,247,0.6)" : isGuideMode ? "rgba(255,255,255,0.1)" : "rgba(168,85,247,0.25)"}
                strokeWidth="1"
                strokeDasharray={isGuideMode ? "3 2" : "none"}
                filter={isActive ? "url(#glow)" : "none"}
              />
              <text
                x={pos.cx}
                y={pos.cy + 3}
                textAnchor="middle"
                fill={isActive ? "rgba(168,85,247,0.9)" : isGuideMode ? "rgba(255,255,255,0.25)" : "rgba(168,85,247,0.6)"}
                fontSize="7"
                fontWeight="500"
              >
                {MOUNT_LABELS[name]}
              </text>
            </g>
          );
        })}

        {/* Palm lines */}
        {Object.entries(LINE_PATHS).map(([name, path]) => {
          const color = LINE_COLORS[name] || "#fff";
          const strength = getLineStrength(name);
          const style = isGuideMode
            ? { strokeWidth: 1.5, opacity: 0.3 }
            : getStrengthStyle(strength);
          const isActive = selectedFeature === name || hoveredFeature === name;
          const label = LINE_LABELS[name];
          const desc = getLineDescription(name);

          return (
            <g
              key={name}
              className="cursor-pointer"
              onClick={() => handleLineClick(name)}
              onMouseEnter={() =>
                handleMouseEnter(name, label?.x || 0, label?.y || 0, desc)
              }
              onMouseLeave={handleMouseLeave}
            >
              {/* Hit area (invisible wider path) */}
              <path
                d={path}
                stroke="transparent"
                strokeWidth="12"
                fill="none"
              />
              {/* Visible line */}
              <path
                d={path}
                stroke={color}
                strokeWidth={isActive ? style.strokeWidth + 1 : style.strokeWidth}
                strokeLinecap="round"
                fill="none"
                opacity={isActive ? 1 : style.opacity}
                strokeDasharray={isGuideMode ? "6 3" : "none"}
                filter={isActive ? "url(#glowStrong)" : "none"}
              />
              {/* Label */}
              {label && (
                <text
                  x={label.x}
                  y={label.y}
                  textAnchor={label.anchor}
                  fill={isActive ? color : isGuideMode ? "rgba(255,255,255,0.25)" : color}
                  opacity={isActive ? 1 : isGuideMode ? 0.4 : 0.7}
                  fontSize="8"
                  fontWeight="500"
                >
                  {name}
                </text>
              )}
            </g>
          );
        })}

        {/* Finger labels (guide mode only or always subtle) */}
        {isGuideMode &&
          FINGER_LABELS.map((f) => (
            <text
              key={f.name}
              x={f.x}
              y={f.y}
              textAnchor="middle"
              fill="rgba(255,255,255,0.2)"
              fontSize="7"
            >
              {f.name}
            </text>
          ))}
      </svg>

      {/* Tooltip */}
      {tooltip && !isGuideMode && (
        <div className="absolute left-1/2 -translate-x-1/2 bottom-0 w-full px-2">
          <div className="surface-card p-2.5 rounded-lg text-center">
            <p className="text-xs text-surface-50/70 leading-relaxed line-clamp-2">
              {tooltip.text}
            </p>
          </div>
        </div>
      )}

      {/* Legend */}
      <div className={`flex flex-wrap justify-center gap-x-3 gap-y-1 mt-3 ${isGuideMode ? "opacity-40" : ""}`}>
        {Object.entries(LINE_COLORS).map(([name, color]) => (
          <div
            key={name}
            className="flex items-center gap-1 cursor-pointer"
            onClick={() => !isGuideMode && handleLineClick(name)}
            onMouseEnter={() => setHoveredFeature(name)}
            onMouseLeave={handleMouseLeave}
          >
            <span
              className="inline-block w-3 h-0.5 rounded-full"
              style={{ backgroundColor: color, opacity: selectedFeature === name || hoveredFeature === name ? 1 : 0.7 }}
            />
            <span
              className="text-[9px]"
              style={{
                color: selectedFeature === name || hoveredFeature === name ? color : "rgba(255,255,255,0.4)",
              }}
            >
              {name.replace(" Line", "")}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
