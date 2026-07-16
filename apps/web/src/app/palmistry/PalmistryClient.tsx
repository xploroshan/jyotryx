"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import PalmDiagram from "@/components/palmistry/PalmDiagram";
import PalmWireframe, {
  type PalmGeometryData,
  type PalmVerificationData,
} from "@/components/palmistry/PalmWireframe";
import { ShowYourWork, type ChartFactor } from "@/components/transparency/ShowYourWork";
import CameraCapture from "@/components/palmistry/CameraCapture";
import { useTranslation } from "@/i18n";
import { usePricingConfig } from "@/lib/usePricingConfig";
import { Toast } from "@/components/ui/Toast";
import { ScrollableRow } from "@/components/ui/ScrollableRow";
import { Sparkles, Compass, Heart, Flag } from "lucide-react";
import Interpretation from "@/components/interpretation/Interpretation";

interface SpecialMarking {
  name: string;
  location: string;
  interpretation: string;
}

interface TimingInsight {
  ageRange: string;
  area: string;
  description: string;
}

interface HandShape {
  type: string;
  description: string;
}

interface AtAGlance {
  strengths: string;
  lifePath: string;
  love: string;
  bestSuitedFor: string;
}

interface HandOverview {
  handType: string;
  palmShape: string;
  fingers: string;
  thumb: string;
  dominantHand: string;
}

interface MajorLine {
  name: string;
  subtitle?: string;
  description: string;
  observations: string[];
  strength: "strong" | "moderate" | "weak";
}

interface AnalysisResult {
  atAGlance: AtAGlance | null;
  handOverview: HandOverview | null;
  handShape: HandShape | null;
  majorLines: MajorLine[];
  minorLines: { name: string; description: string; strength?: "strong" | "moderate" | "weak" }[];
  mounts: { name: string; description: string; prominence: "high" | "medium" | "low" }[];
  insights: { label: string; text: string }[];
  fingerAnalysis: { finger: string; interpretation: string; length?: string }[];
  specialMarkings: SpecialMarking[];
  timingInsights: TimingInsight[];
  cautions: string;
  closingAffirmation: string;
  /** Measured/extracted geometry of the user's own palm (wireframe source). */
  geometry: PalmGeometryData | null;
  /** Authenticity: verification id, hashes, grounding checks, honesty flags. */
  verification: PalmVerificationData | null;
  /** Deterministic "Show Your Work" factors. */
  factors: ChartFactor[];
}

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ACCEPTED_MIME = /^image\/(jpeg|jpg|png|webp|heic)$/i;
const POLL_INTERVAL_MS = 3000;
const POLL_MAX_ATTEMPTS = 40; // ~2 minutes

const MAJOR_LINE_KEYWORDS = ["heart", "head", "life", "fate", "sun"];

function normalizeName(name: string): string {
  return name.toLowerCase().replace(/\s+/g, " ").trim();
}

function isMajorLine(lineName: string): boolean {
  const normalized = normalizeName(lineName);
  return MAJOR_LINE_KEYWORDS.some((keyword) => normalized.includes(keyword));
}

type StrengthCode = "strong" | "moderate" | "weak";
function normalizeStrength(s: string): StrengthCode {
  const lower = (s || "").toLowerCase();
  if (lower === "strong" || lower === "prominent" || lower === "deep") return "strong";
  if (lower === "moderate" || lower === "medium" || lower === "normal" || lower === "average") return "moderate";
  return "weak";
}

type ProminenceCode = "high" | "medium" | "low";
function normalizeProminence(p: string): ProminenceCode {
  const lower = (p || "").toLowerCase();
  if (lower === "elevated" || lower === "high" || lower === "prominent") return "high";
  if (lower === "flat" || lower === "low" || lower === "underdeveloped") return "low";
  return "medium";
}

function mapAnalysis(result: any, t: any): AnalysisResult {
  const lines = Array.isArray(result?.lines) ? result.lines : [];
  const majorLines: MajorLine[] = lines
    .filter((l: any) => isMajorLine(l.name || ""))
    .map((l: any) => ({
      name: l.name,
      subtitle: typeof l.subtitle === "string" ? l.subtitle : undefined,
      description: l.interpretation || l.description || "",
      observations: Array.isArray(l.observations)
        ? l.observations.filter((o: unknown) => typeof o === "string" && o.trim().length > 0)
        : [],
      strength: normalizeStrength(l.strength),
    }));
  const minorLines = lines
    .filter((l: any) => !isMajorLine(l.name || ""))
    .map((l: any) => ({
      name: l.name,
      description: l.interpretation || l.description || "",
      strength: l.strength ? normalizeStrength(l.strength) : undefined,
    }));

  const mounts = (Array.isArray(result?.mounts) ? result.mounts : []).map((mt: any) => ({
    name: mt.name,
    description: mt.interpretation || mt.description || "",
    prominence: normalizeProminence(mt.prominence),
  }));

  const insights: { label: string; text: string }[] = [];
  if (result?.overallReading) insights.push({ label: t.palmistry.insightOverall, text: result.overallReading });
  if (result?.healthInsights) insights.push({ label: t.palmistry.insightHealth, text: result.healthInsights });
  if (result?.careerInsights) insights.push({ label: t.palmistry.insightCareer, text: result.careerInsights });
  if (result?.relationshipInsights) insights.push({ label: t.palmistry.insightRelationships, text: result.relationshipInsights });
  if (result?.spiritualInsights) insights.push({ label: t.palmistry.insightSpirituality, text: result.spiritualInsights });

  const fingerAnalysis = (Array.isArray(result?.fingerAnalysis) ? result.fingerAnalysis : [])
    .filter((f: any) => f && f.interpretation)
    .map((f: any) => ({ finger: f.finger, interpretation: f.interpretation, length: f.length }));

  const specialMarkings: SpecialMarking[] = (Array.isArray(result?.specialMarkings) ? result.specialMarkings : [])
    .filter((m: any) => m && (m.name || m.interpretation))
    .map((m: any) => ({
      name: m.name || "",
      location: m.location || "",
      interpretation: m.interpretation || "",
    }));

  const timingInsights: TimingInsight[] = (Array.isArray(result?.timingInsights) ? result.timingInsights : [])
    .filter((ti: any) => ti && (ti.description || ti.ageRange))
    .map((ti: any) => ({
      ageRange: ti.ageRange || "",
      area: ti.area || "",
      description: ti.description || "",
    }));

  const handShape: HandShape | null = result?.handShape && (result.handShape.type || result.handShape.description)
    ? { type: result.handShape.type || "", description: result.handShape.description || "" }
    : null;

  const atAGlance: AtAGlance | null = result?.atAGlance && (
    result.atAGlance.strengths || result.atAGlance.lifePath || result.atAGlance.love || result.atAGlance.bestSuitedFor
  )
    ? {
        strengths: result.atAGlance.strengths || "",
        lifePath: result.atAGlance.lifePath || "",
        love: result.atAGlance.love || "",
        bestSuitedFor: result.atAGlance.bestSuitedFor || "",
      }
    : null;

  const handOverview: HandOverview | null = result?.handOverview && (
    result.handOverview.handType || result.handOverview.palmShape || result.handOverview.fingers || result.handOverview.thumb || result.handOverview.dominantHand
  )
    ? {
        handType: result.handOverview.handType || "",
        palmShape: result.handOverview.palmShape || "",
        fingers: result.handOverview.fingers || "",
        thumb: result.handOverview.thumb || "",
        dominantHand: result.handOverview.dominantHand || "",
      }
    : null;

  // ── Wireframe geometry / verification / factors (defensive parsing) ──
  const rawGeo = result?.geometry;
  const geometry: PalmGeometryData | null =
    rawGeo && (Array.isArray(rawGeo.landmarks) || Array.isArray(rawGeo.polylines))
      ? {
          landmarks: Array.isArray(rawGeo.landmarks) ? rawGeo.landmarks : [],
          handedness: rawGeo.handedness === "Left" ? "Left" : "Right",
          metrics:
            rawGeo.metrics && Number.isFinite(rawGeo.metrics.palmAspect)
              ? {
                  palmAspect: rawGeo.metrics.palmAspect,
                  fingerRatio: rawGeo.metrics.fingerRatio,
                  handShape: String(rawGeo.metrics.handShape || ""),
                }
              : null,
          polylines: (Array.isArray(rawGeo.polylines) ? rawGeo.polylines : []).filter(
            (p: any) => typeof p?.name === "string" && Array.isArray(p?.points) && p.points.length >= 2,
          ),
        }
      : null;

  const rawVer = result?.verification;
  const verification: PalmVerificationData | null = rawVer
    ? {
        verificationId: String(rawVer.verificationId || ""),
        groundednessScore: Number.isFinite(rawVer.groundednessScore) ? rawVer.groundednessScore : 0,
        authentic: rawVer.authentic !== false,
        authenticReason: typeof rawVer.authenticReason === "string" ? rawVer.authenticReason : undefined,
        duplicateOf: rawVer.duplicateOf ?? null,
        checks: Array.isArray(rawVer.checks) ? rawVer.checks : [],
      }
    : null;

  const factors: ChartFactor[] = (Array.isArray(result?.factors) ? result.factors : []).filter(
    (f: any) => typeof f?.code === "string" && typeof f?.label === "string",
  );

  return {
    atAGlance,
    handOverview,
    handShape,
    majorLines,
    minorLines,
    mounts,
    insights,
    fingerAnalysis,
    specialMarkings,
    timingInsights,
    cautions: typeof result?.cautions === "string" ? result.cautions : "",
    closingAffirmation: typeof result?.closingAffirmation === "string" ? result.closingAffirmation : "",
    geometry,
    verification,
    factors,
  };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function buildReportHtml(analysis: AnalysisResult, t: any): string {
  const e = escapeHtml;
  const dateStr = new Date().toLocaleDateString();

  const atAGlanceHtml = analysis.atAGlance
    ? `
      <section class="at-a-glance">
        <h2>${e(t.palmistry.atAGlance)}</h2>
        <div class="grid">
          ${analysis.atAGlance.strengths ? `<div class="cell"><div class="label">${e(t.palmistry.atAGlanceStrengths)}</div><div class="value">${e(analysis.atAGlance.strengths)}</div></div>` : ""}
          ${analysis.atAGlance.lifePath ? `<div class="cell"><div class="label">${e(t.palmistry.atAGlanceLifePath)}</div><div class="value">${e(analysis.atAGlance.lifePath)}</div></div>` : ""}
          ${analysis.atAGlance.love ? `<div class="cell"><div class="label">${e(t.palmistry.atAGlanceLove)}</div><div class="value">${e(analysis.atAGlance.love)}</div></div>` : ""}
          ${analysis.atAGlance.bestSuitedFor ? `<div class="cell"><div class="label">${e(t.palmistry.atAGlanceBestSuitedFor)}</div><div class="value">${e(analysis.atAGlance.bestSuitedFor)}</div></div>` : ""}
        </div>
      </section>`
    : "";

  const handOverviewHtml = analysis.handOverview
    ? `
      <section class="hand-overview">
        <h2>${e(t.palmistry.handOverview)}</h2>
        <div class="grid">
          ${analysis.handOverview.handType ? `<div class="cell"><div class="label">${e(t.palmistry.handOverviewType)}</div><div class="value">${e(analysis.handOverview.handType)}</div></div>` : ""}
          ${analysis.handOverview.palmShape ? `<div class="cell"><div class="label">${e(t.palmistry.handOverviewShape)}</div><div class="value">${e(analysis.handOverview.palmShape)}</div></div>` : ""}
          ${analysis.handOverview.fingers ? `<div class="cell"><div class="label">${e(t.palmistry.handOverviewFingers)}</div><div class="value">${e(analysis.handOverview.fingers)}</div></div>` : ""}
          ${analysis.handOverview.thumb ? `<div class="cell"><div class="label">${e(t.palmistry.handOverviewThumb)}</div><div class="value">${e(analysis.handOverview.thumb)}</div></div>` : ""}
          ${analysis.handOverview.dominantHand ? `<div class="cell"><div class="label">${e(t.palmistry.handOverviewDominantHand)}</div><div class="value">${e(analysis.handOverview.dominantHand)}</div></div>` : ""}
        </div>
      </section>`
    : "";

  const majorLinesHtml = analysis.majorLines.length
    ? `
      <section>
        <h2>${e(t.palmistry.majorLines)}</h2>
        <div class="lines-grid">
          ${analysis.majorLines
            .map(
              (l) => `
            <article class="line-card">
              <h3>${e(l.name)}</h3>
              ${l.subtitle ? `<div class="subtitle">${e(l.subtitle)}</div>` : ""}
              ${
                l.observations.length
                  ? `<ul>${l.observations.map((o) => `<li>${e(o)}</li>`).join("")}</ul>`
                  : ""
              }
              <p>${e(l.description)}</p>
            </article>`,
            )
            .join("")}
        </div>
      </section>`
    : "";

  const minorLinesHtml = analysis.minorLines.length
    ? `
      <section>
        <h2>${e(t.palmistry.minorLines)}</h2>
        ${analysis.minorLines
          .map(
            (l) =>
              `<div class="row"><div class="row-name">${e(l.name)}</div><div class="row-text">${e(l.description)}</div></div>`,
          )
          .join("")}
      </section>`
    : "";

  const mountsHtml = analysis.mounts.length
    ? `
      <section>
        <h2>${e(t.palmistry.mounts)}</h2>
        ${analysis.mounts
          .map(
            (m) =>
              `<div class="row"><div class="row-name">${e(m.name)} <span class="tag">${e(m.prominence)}</span></div><div class="row-text">${e(m.description)}</div></div>`,
          )
          .join("")}
      </section>`
    : "";

  const fingerHtml = analysis.fingerAnalysis.length
    ? `
      <section>
        <h2>${e(t.palmistry.fingerAnalysis)}</h2>
        ${analysis.fingerAnalysis
          .map(
            (f) =>
              `<div class="row"><div class="row-name">${e(f.finger)}${f.length ? ` <span class="tag">${e(f.length)}</span>` : ""}</div><div class="row-text">${e(f.interpretation)}</div></div>`,
          )
          .join("")}
      </section>`
    : "";

  const insightsHtml = analysis.insights.length
    ? `
      <section>
        <h2>${e(t.palmistry.insights)}</h2>
        ${analysis.insights
          .map((i) => `<h3>${e(i.label)}</h3><p>${e(i.text)}</p>`)
          .join("")}
      </section>`
    : "";

  const markingsHtml = analysis.specialMarkings.length
    ? `
      <section>
        <h2>${e(t.palmistry.specialMarkings)}</h2>
        ${analysis.specialMarkings
          .map(
            (m) =>
              `<div class="row"><div class="row-name">${e(m.name)}${m.location ? ` <span class="tag">${e(m.location)}</span>` : ""}</div><div class="row-text">${e(m.interpretation)}</div></div>`,
          )
          .join("")}
      </section>`
    : "";

  const timingHtml = analysis.timingInsights.length
    ? `
      <section>
        <h2>${e(t.palmistry.timingInsights)}</h2>
        ${analysis.timingInsights
          .map(
            (ti) =>
              `<div class="row"><div class="row-name">${e(ti.ageRange)}${ti.area ? ` <span class="tag">${e(ti.area)}</span>` : ""}</div><div class="row-text">${e(ti.description)}</div></div>`,
          )
          .join("")}
      </section>`
    : "";

  const cautionsHtml = analysis.cautions
    ? `
      <section class="cautions">
        <h2>${e(t.palmistry.cautions)}</h2>
        <p>${e(analysis.cautions)}</p>
      </section>`
    : "";

  const closingHtml = analysis.closingAffirmation
    ? `<div class="closing">${e(analysis.closingAffirmation)}</div>`
    : "";

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>${e(`${t.palmistry.title} ${t.palmistry.titleHighlight}`)}</title>
<style>
  :root { color-scheme: light; }
  * { box-sizing: border-box; }
  body { margin: 0; font-family: 'Georgia', 'Iowan Old Style', serif; background: #fafaf7; color: #1f1f1f; line-height: 1.55; }
  .page { max-width: 880px; margin: 0 auto; padding: 56px 40px; background: #fff; box-shadow: 0 0 0 1px rgba(0,0,0,0.04); }
  header { text-align: center; border-bottom: 1px solid #e6e3dc; padding-bottom: 24px; margin-bottom: 32px; }
  header h1 { margin: 0 0 4px; font-size: 36px; letter-spacing: 0.5px; font-weight: 400; }
  header .subtitle { color: #8a8478; font-size: 11px; letter-spacing: 4px; text-transform: uppercase; }
  header .meta { color: #a39d92; font-size: 11px; margin-top: 12px; letter-spacing: 1px; }
  h2 { font-size: 18px; letter-spacing: 1.2px; text-transform: uppercase; color: #5a534a; border-bottom: 1px solid #e6e3dc; padding-bottom: 8px; margin: 36px 0 18px; font-weight: 500; }
  h3 { font-size: 15px; margin: 14px 0 4px; color: #2a2722; font-family: -apple-system, system-ui, sans-serif; font-weight: 600; letter-spacing: 0.3px; }
  .subtitle { font-size: 11px; letter-spacing: 1.5px; text-transform: uppercase; color: #a09680; margin-bottom: 8px; }
  p { margin: 4px 0 12px; font-size: 14px; }
  ul { margin: 4px 0 10px; padding-left: 20px; font-size: 13px; }
  ul li { margin: 2px 0; }
  .grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 14px 24px; }
  .cell { padding: 10px 0; border-bottom: 1px dotted #e6e3dc; }
  .cell .label { font-size: 11px; letter-spacing: 1.5px; text-transform: uppercase; color: #a09680; margin-bottom: 4px; font-family: -apple-system, system-ui, sans-serif; }
  .cell .value { font-size: 14px; color: #2a2722; }
  .lines-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; }
  .line-card { padding: 14px 16px; border: 1px solid #ebe7df; border-radius: 6px; background: #fdfcf8; }
  .line-card h3 { margin-top: 0; }
  .row { display: grid; grid-template-columns: 200px 1fr; gap: 16px; padding: 8px 0; border-bottom: 1px dotted #ebe7df; font-size: 13px; }
  .row:last-child { border-bottom: 0; }
  .row-name { font-family: -apple-system, system-ui, sans-serif; font-weight: 600; color: #2a2722; }
  .tag { font-size: 10px; padding: 2px 6px; border-radius: 3px; background: #efece4; color: #6b6557; letter-spacing: 0.5px; text-transform: uppercase; margin-left: 4px; font-weight: 500; }
  .cautions { background: #fbf6ec; border-left: 3px solid #c9a96a; padding: 14px 18px; border-radius: 0 6px 6px 0; }
  .cautions h2 { border: 0; padding: 0; margin: 0 0 8px; }
  .closing { text-align: center; font-style: italic; font-size: 16px; color: #6b6557; margin: 40px 0 0; padding-top: 24px; border-top: 1px solid #e6e3dc; }
  footer { text-align: center; margin-top: 40px; font-size: 10px; color: #a39d92; letter-spacing: 1px; }
  @media print {
    body { background: #fff; }
    .page { box-shadow: none; padding: 24px; }
  }
</style>
</head>
<body>
  <div class="page">
    <header>
      <h1>${e(t.palmistry.title)} ${e(t.palmistry.titleHighlight)}</h1>
      <div class="subtitle">${e(t.palmistry.reportSubtitle)}</div>
      <div class="meta">${e(dateStr)}</div>
    </header>
    ${atAGlanceHtml}
    ${handOverviewHtml}
    ${majorLinesHtml}
    ${minorLinesHtml}
    ${mountsHtml}
    ${fingerHtml}
    ${insightsHtml}
    ${markingsHtml}
    ${timingHtml}
    ${cautionsHtml}
    ${closingHtml}
    <footer>${e(t.palmistry.disclaimer)}</footer>
  </div>
</body>
</html>`;
}

const PALM_PENDING_IMAGE = "palm_pending_image";
const PALM_PENDING_GENDER = "palm_pending_gender";

export default function PalmistryPage() {
  const { t, locale } = useTranslation();
  const router = useRouter();
  const searchParams = useSearchParams();
  const pricing = usePricingConfig();
  const [image, setImage] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [progressMessage, setProgressMessage] = useState<string>("");
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [activeTab, setActiveTab] = useState("major");
  const [error, setError] = useState("");
  const [errorRetryable, setErrorRetryable] = useState(false);
  const [gender, setGender] = useState<"male" | "female" | null>(null);
  const [selectedFeature, setSelectedFeature] = useState<string | null>(null);
  const [showCamera, setShowCamera] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const pollAbortRef = useRef<{ cancelled: boolean } | null>(null);
  // Hand landmarks detected client-side (MediaPipe, self-hosted) for the
  // prepared photo. Best-effort: null when detection fails/unsupported — the
  // reading proceeds without the wireframe geometry.
  const landmarksRef = useRef<{
    landmarks: { x: number; y: number; z: number }[];
    handedness: "Left" | "Right";
    score: number;
  } | null>(null);
  // Generation token: detection is async and un-cancellable — if the user
  // swaps photos while photo A's detection is still running, A's landmarks
  // must never be attached to photo B's analysis (they'd corrupt the
  // grounding/fingerprint of the "verified" layer).
  const landmarkGenRef = useRef(0);

  // Cancel any in-flight polling on unmount
  useEffect(() => {
    return () => {
      if (pollAbortRef.current) pollAbortRef.current.cancelled = true;
    };
  }, []);

  const handleFeatureSelect = useCallback(
    (feature: { type: "line" | "mount"; name: string }) => {
      setSelectedFeature(feature.name);
      if (feature.type === "mount") {
        setActiveTab("mounts");
      } else {
        setActiveTab(isMajorLine(feature.name) ? "major" : "minor");
      }
    },
    [],
  );

  const validateFile = (file: File): string | null => {
    if (!ACCEPTED_MIME.test(file.type)) return t.palmistry.invalidFileType;
    if (file.size > MAX_FILE_SIZE) return t.palmistry.fileTooLarge;
    return null;
  };

  const handleFile = async (file: File) => {
    const validationError = validateFile(file);
    if (validationError) {
      setError(validationError);
      setErrorRetryable(false);
      return;
    }
    setError("");
    try {
      // Normalize before anything else: applies EXIF orientation (phone photos
      // are often stored sideways — landmarks/overlays would misalign),
      // downscales to a bounded long edge, and re-encodes HEIC to JPEG where
      // the browser can decode it (Safari).
      const { prepareImage, ImagePrepError } = await import("@/lib/image-prep");
      try {
        const prepared = await prepareImage(file);
        setImageFile(prepared.file);
        setImage(prepared.dataUrl);
        setAnalysis(null);
        // Kick off hand-landmark detection in the background (self-hosted
        // MediaPipe). Fire-and-forget: the result enriches the analyze call
        // with real geometry; failure just means no wireframe.
        landmarksRef.current = null;
        const gen = ++landmarkGenRef.current;
        import("@/lib/palm/handLandmarker")
          .then((m) => m.detectPalmLandmarks(prepared.dataUrl))
          .then((det) => {
            if (gen === landmarkGenRef.current) landmarksRef.current = det;
          })
          .catch(() => {
            if (gen === landmarkGenRef.current) landmarksRef.current = null;
          });
      } catch (prepErr) {
        if (prepErr instanceof ImagePrepError && prepErr.code === "decode_failed") {
          // Typically HEIC on a non-Safari browser: actionable message.
          setError(t.palmistry.invalidFileType);
        } else {
          setError(t.palmistry.invalidImage);
        }
        setErrorRetryable(false);
      }
    } catch {
      // Module load failed (offline?): fall back to the raw file so the
      // feature still works — the server re-validates anyway.
      setImageFile(file);
      const reader = new FileReader();
      reader.onload = (e) => {
        setImage(e.target?.result as string);
        setAnalysis(null);
      };
      reader.onerror = () => {
        setError(t.palmistry.invalidImage);
        setErrorRetryable(false);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]);
  };

  const handleCameraCapture = (file: File) => {
    setShowCamera(false);
    handleFile(file);
  };

  const pollForResult = async (
    readingId: string,
    api: any,
  ): Promise<any | null> => {
    const token = { cancelled: false };
    pollAbortRef.current = token;
    for (let attempt = 0; attempt < POLL_MAX_ATTEMPTS; attempt++) {
      if (token.cancelled) return null;
      await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
      if (token.cancelled) return null;
      try {
        const res: { id: string; status: string; analysis?: any } = await api.get(
          `/palmistry/${readingId}/status`,
        );
        if (res?.status === "completed" && res.analysis) {
          return res.analysis;
        }
        if (res?.status === "failed") {
          // Tag as terminal so the catch below rethrows instead of swallowing
          // it and polling a dead reading for the full 2-minute window. The
          // failCode carries the vision model's specific verdict (e.g. the
          // photo showed the BACK of the hand) so the user gets actionable
          // advice instead of the generic "try a clearer photo".
          const failed: any = new Error(
            (res as any)?.failCode === "back_of_hand"
              ? t.palmistry.backOfHandError
              : (res as any)?.failCode === "not_a_hand"
                ? t.palmistry.notAHandError
                : t.palmistry.analysisFailed,
          );
          failed.status = 422;
          throw failed;
        }
      } catch (e: any) {
        // 5xx / network errors: keep polling, otherwise rethrow
        if (e?.status && e.status >= 400 && e.status < 500) throw e;
      }
    }
    throw new Error(t.palmistry.analysisTimeout);
  };

  const handleAnalyze = async (fileArg?: File) => {
    const file = fileArg ?? imageFile;
    if (!file) {
      setError(t.palmistry.uploadFirst);
      setErrorRetryable(false);
      return;
    }
    setAnalyzing(true);
    setError("");
    setErrorRetryable(false);
    setProgressMessage(t.palmistry.uploadingImage);
    try {
      const { useAuthStore } = await import("@/lib/store");
      if (!useAuthStore.getState().accessToken) {
        setError(t.palmistry.loginRequired);
        setAnalyzing(false);
        setProgressMessage("");
        return;
      }
      const { api } = await import("@/lib/api");
      const formData = new FormData();
      formData.append("image", file);
      if (locale !== "en") formData.append("locale", locale);
      if (gender) formData.append("gender", gender);
      // Real hand geometry measured client-side — powers the wireframe and
      // the deterministic grounding checks server-side. Optional by design.
      if (landmarksRef.current) {
        formData.append("landmarks", JSON.stringify(landmarksRef.current));
      }

      const initial = await api.upload<any>("/palmistry/analyze", formData);
      let result = initial;

      // If the backend queued the job, poll until it completes
      const queuedStatus =
        initial?.status === "processing" ||
        (Array.isArray(initial?.lines) && initial.lines.length === 0 && initial?.id);

      if (queuedStatus && initial?.id) {
        setProgressMessage(t.palmistry.processingMessage);
        result = await pollForResult(initial.id, api);
      }

      if (result) {
        setAnalysis(mapAnalysis(result, t));
      } else {
        setError(t.palmistry.noResultsError);
      }
    } catch (err: any) {
      // 402 → reading not unlocked. Stash the chosen image so we can resume
      // after checkout, then route by the server's hint:
      //  - subscribe === true  → free user out of free readings → Subscribe
      //  - subscribe === false → subscriber over monthly cap → ₹100 +2 top-up
      //  - no hint (legacy)    → the one-time palmistry purchase
      if (err?.status === 402) {
        try {
          if (image) sessionStorage.setItem(PALM_PENDING_IMAGE, image);
          sessionStorage.setItem(PALM_PENDING_GENDER, gender ?? "");
        } catch {
          /* sessionStorage may be unavailable; checkout still works, user re-uploads */
        }
        const sub = err?.body?.subscribe;
        if (sub === true) router.push("/pricing");
        else if (sub === false) router.push("/checkout?type=credits&pack=overage_palmistry");
        else router.push("/checkout?type=palmistry");
        return;
      }
      // Specific image-rejection verdicts from the sync path (422 + code):
      // localized, actionable, and NOT presented as retryable-as-is — the
      // user must change what the camera sees, not just tap Retry.
      const code = err?.body?.code;
      if (code === "back_of_hand") {
        setError(t.palmistry.backOfHandError);
        setErrorRetryable(false);
        return;
      }
      if (code === "not_a_hand") {
        setError(t.palmistry.notAHandError);
        setErrorRetryable(false);
        return;
      }
      setError(err.message || t.palmistry.analysisFailed);
      setErrorRetryable(
        Boolean(err?.isNetwork || err?.isTimeout) || (err?.status ?? 0) >= 500 || !err?.status,
      );
    } finally {
      setAnalyzing(false);
      setProgressMessage("");
    }
  };

  // Returning from a successful palmistry checkout (?unlocked=1): restore
  // the stashed image and auto-run the analysis once.
  useEffect(() => {
    if (searchParams.get("unlocked") !== "1") return;
    let cancelled = false;
    (async () => {
      let dataUrl: string | null = null;
      let savedGender = "";
      try {
        dataUrl = sessionStorage.getItem(PALM_PENDING_IMAGE);
        savedGender = sessionStorage.getItem(PALM_PENDING_GENDER) ?? "";
        sessionStorage.removeItem(PALM_PENDING_IMAGE);
        sessionStorage.removeItem(PALM_PENDING_GENDER);
      } catch {
        /* ignore */
      }
      router.replace("/palmistry");
      if (!dataUrl) return;
      try {
        const blob = await (await fetch(dataUrl)).blob();
        const file = new File([blob], "palm.jpg", { type: blob.type || "image/jpeg" });
        if (cancelled) return;
        setImage(dataUrl);
        setImageFile(file);
        if (savedGender === "male" || savedGender === "female") setGender(savedGender);
        handleAnalyze(file);
      } catch {
        /* user can re-upload */
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleDownload = () => {
    if (!analysis) return;
    try {
      const html = buildReportHtml(analysis, t);
      const blob = new Blob([html], { type: "text/html;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `palmistry-report-${new Date().toISOString().slice(0, 10)}.html`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      setError(t.palmistry.downloadFailed);
      setErrorRetryable(false);
    }
  };

  const handlePrint = () => {
    if (!analysis) return;
    try {
      const html = buildReportHtml(analysis, t);
      const win = window.open("", "_blank", "noopener,noreferrer");
      if (!win) {
        setError(t.palmistry.downloadFailed);
        setErrorRetryable(false);
        return;
      }
      win.document.open();
      win.document.write(html);
      win.document.close();
      // Give the browser a moment to layout fonts before printing.
      setTimeout(() => {
        try { win.focus(); win.print(); } catch { /* ignore */ }
      }, 250);
    } catch {
      setError(t.palmistry.downloadFailed);
      setErrorRetryable(false);
    }
  };

  const tabs = [
    { id: "major", label: t.palmistry.majorLines },
    { id: "minor", label: t.palmistry.minorLines },
    { id: "mounts", label: t.palmistry.mounts },
    { id: "insights", label: t.palmistry.insights },
    { id: "timing", label: t.palmistry.timingInsights },
    { id: "markings", label: t.palmistry.specialMarkings },
  ];

  const strengthColor = (s: "strong" | "moderate" | "weak") =>
    s === "strong" ? "text-emerald-400" : s === "moderate" ? "text-accent-400" : "text-[rgba(12,8,5,0.66)]";

  const strengthLabel = (s: "strong" | "moderate" | "weak") =>
    s === "strong" ? t.palmistry.strengthStrong : s === "moderate" ? t.palmistry.strengthModerate : t.palmistry.strengthWeak;

  const prominenceLabel = (p: "high" | "medium" | "low") =>
    p === "high" ? t.palmistry.prominenceHigh : p === "medium" ? t.palmistry.prominenceMedium : t.palmistry.prominenceLow;

  const uploadHeading = gender === "male"
    ? t.palmistry.uploadRight
    : gender === "female"
      ? t.palmistry.uploadLeft
      : t.palmistry.uploadYour;

  const dragDropText = gender
    ? (gender === "male" ? t.palmistry.dragDropRight : t.palmistry.dragDropLeft)
    : t.palmistry.selectGenderFirst;

  return (
    <div className="relative min-h-screen overflow-x-hidden">
      <div aria-hidden className="absolute inset-0 pointer-events-none" style={{background: "radial-gradient(ellipse 80% 40% at 50% 0%, rgba(255,182,39,0.14) 0%, rgba(255,77,0,0.06) 35%, transparent 70%)"}} />
      <div className="absolute top-32 left-1/4 w-80 h-80 bg-accent-500/8 rounded-full blur-3xl" />
      <div className="absolute bottom-32 right-1/4 w-80 h-80 bg-primary-500/8 rounded-full blur-3xl" />

      <div className="relative z-10 mx-auto max-w-6xl px-4 py-12 fade-in-up">
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full surface-card text-sm text-secondary mb-4">
            {t.palmistry.badge}
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold mb-4">
            {t.palmistry.title} <span className="text-gradient">{t.palmistry.titleHighlight}</span>
          </h1>
          <p className="text-secondary max-w-xl mx-auto">{t.palmistry.description}</p>
        </div>

        {/* min-w-0 on the columns: grid items default to min-width:auto, so
            wide non-wrapping content (the wireframe card's header row) was
            expanding the column past the phone viewport — the card rendered
            ~555px wide on a 390px screen with its right edge cut off. */}
        <div className="grid md:grid-cols-2 gap-8">
          {/* Upload Area */}
          <div className="space-y-6 min-w-0">
            {/* Step 1: Gender */}
            <div className="surface-card p-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary-500/20 text-[10px] font-semibold text-primary-300">1</span>
                <h3 className="text-sm font-semibold text-surface-950">{t.palmistry.selectGender}</h3>
              </div>
              <p className="text-xs text-secondary mb-3">
                {gender === "male" ? t.palmistry.genderMaleNote : gender === "female" ? t.palmistry.genderFemaleNote : t.palmistry.genderDefaultNote}
              </p>
              <div role="radiogroup" aria-label={t.palmistry.selectGender} className="flex gap-3">
                <button
                  role="radio"
                  aria-checked={gender === "male"}
                  onClick={() => setGender("male")}
                  className={`focus-ring touch-target flex-1 py-3 rounded-xl text-sm font-medium transition-all ${
                    gender === "male"
                      ? "btn-primary text-white"
                      : "bg-[rgba(255,252,245,0.78)] text-emphasis hover:text-surface-950 hover:bg-[rgba(255,252,245,0.92)]"
                  }`}
                >
                  {t.palmistry.male}
                </button>
                <button
                  role="radio"
                  aria-checked={gender === "female"}
                  onClick={() => setGender("female")}
                  className={`focus-ring touch-target flex-1 py-3 rounded-xl text-sm font-medium transition-all ${
                    gender === "female"
                      ? "btn-primary text-white"
                      : "bg-[rgba(255,252,245,0.78)] text-emphasis hover:text-surface-950 hover:bg-[rgba(255,252,245,0.92)]"
                  }`}
                >
                  {t.palmistry.female}
                </button>
              </div>
            </div>

            {/* Step 2: Image */}
            <div className="surface-card p-4">
              <div className="flex items-center gap-2 mb-3">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary-500/20 text-[10px] font-semibold text-primary-300">2</span>
                <h3 className="text-sm font-semibold text-surface-950">{uploadHeading}</h3>
              </div>

              <div
                role="button"
                tabIndex={0}
                aria-label={uploadHeading}
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                onClick={() => fileRef.current?.click()}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    fileRef.current?.click();
                  }
                }}
                className={`focus-ring rounded-xl border-2 border-dashed border-[rgba(12,8,5,0.10)] p-6 flex flex-col items-center justify-center min-h-[320px] cursor-pointer transition-all ${
                  isDragging ? "border-primary-500 bg-primary-500/10" : "hover:bg-[rgba(255,252,245,0.86)]"
                }`}
              >
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/jpeg,image/jpg,image/png,image/webp,image/heic"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files?.[0]) handleFile(e.target.files[0]);
                    if (e.target) e.target.value = "";
                  }}
                />

                {image ? (
                  <div className="relative w-full">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={image} alt={uploadHeading} className="w-full max-h-[320px] object-contain rounded-xl" />
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setImage(null);
                        setImageFile(null);
                        setAnalysis(null);
                      }}
                      aria-label={t.common.close}
                      className="focus-ring absolute top-2 right-2 p-2 rounded-full bg-gray-900/80 text-emphasis hover:text-surface-950"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="w-40 mb-3">
                      <PalmDiagram analysis={null} />
                    </div>
                    <p className="text-sm text-secondary text-center mb-1">{dragDropText}</p>
                    <p className="text-[11px] text-[rgba(12,8,5,0.66)] text-center">{t.palmistry.fileFormats}</p>
                  </>
                )}
              </div>

              {/* Action buttons (camera + gallery) */}
              <div className="mt-3 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setShowCamera(true)}
                  className="focus-ring touch-target rounded-xl bg-[rgba(255,252,245,0.86)] py-2.5 text-sm font-medium text-surface-950 hover:bg-[rgba(12,8,5,0.05)] transition flex items-center justify-center gap-2"
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 0 1 2-2h2l2-2h6l2 2h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9z" />
                    <circle cx="12" cy="13" r="3.5" strokeWidth={2} />
                  </svg>
                  {t.palmistry.useCamera}
                </button>
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="focus-ring touch-target rounded-xl bg-[rgba(255,252,245,0.86)] py-2.5 text-sm font-medium text-surface-950 hover:bg-[rgba(12,8,5,0.05)] transition flex items-center justify-center gap-2"
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2 16l4-4 4 4 6-6 4 4" />
                  </svg>
                  {t.palmistry.useGallery}
                </button>
              </div>

              <div className="mt-3 flex items-center gap-2 px-3 py-2 rounded-lg bg-[rgba(255,252,245,0.70)] text-[11px] text-[rgba(12,8,5,0.72)]">
                <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z" />
                </svg>
                {t.palmistry.lightingTip}
              </div>
            </div>

            {error && (
              <Toast
                message={error}
                tone="error"
                onClose={() => { setError(""); setErrorRetryable(false); }}
                closeLabel={t.common.close}
                action={errorRetryable && imageFile ? { label: t.common.retry, onClick: () => handleAnalyze() } : undefined}
              />
            )}

            {image && !analysis && (
              <button
                onClick={() => handleAnalyze()}
                disabled={analyzing}
                className="focus-ring w-full py-4 rounded-xl btn-primary text-white font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {analyzing ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 0 1 8-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    {progressMessage || t.palmistry.analyzing}
                  </span>
                ) : pricing.subscriptionsEnabled || pricing.freeMode || !pricing.creditsEnabled ? (
                  // Subscription model / free mode: no per-use price label —
                  // palmistry is included up to the plan's reading allowance.
                  t.palmistry.analyzePalm
                ) : (
                  `${t.palmistry.analyzePalm} · ₹${pricing.palmistryPrice}`
                )}
              </button>
            )}

            {/* Tips */}
            <div className="surface-card p-6">
              <h3 className="text-sm font-semibold text-surface-950 mb-3">{t.palmistry.tipsTitle}</h3>
              <ul className="space-y-2 text-xs text-[rgba(12,8,5,0.66)]">
                <li className="flex items-start gap-2">
                  <span className="text-primary-400 mt-0.5">1.</span>
                  {gender === "male" ? t.palmistry.tipRightPalm : gender === "female" ? t.palmistry.tipLeftPalm : t.palmistry.tipSelectGender}
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary-400 mt-0.5">2.</span>
                  {t.palmistry.tipFlatPalm}
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary-400 mt-0.5">3.</span>
                  {t.palmistry.tipLighting}
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary-400 mt-0.5">4.</span>
                  {t.palmistry.tipFingers}
                </li>
              </ul>
            </div>
          </div>

          {/* Analysis Results */}
          <div className="min-w-0">
            {analysis ? (
              <div className="surface-card p-6">
                <h2 className="text-lg font-bold text-gradient mb-4">{t.palmistry.results}</h2>

                {/* Sample-reading banner — shown when the reading was NOT
                    derived from a real palm image (honesty contract). */}
                {analysis.verification && !analysis.verification.authentic && (
                  <div className="mb-5 p-4 rounded-xl bg-amber-500/10 border border-amber-500/25">
                    <p className="text-sm font-semibold text-amber-700 mb-1">{t.palmistry.sampleReadingTitle}</p>
                    <p className="text-xs text-[rgba(26,20,16,0.7)] leading-relaxed">{t.palmistry.sampleReadingBody}</p>
                  </div>
                )}

                {/* Duplicate soft-flag: same photo analysed before. */}
                {analysis.verification?.duplicateOf && (
                  <div className="mb-5 px-4 py-2.5 rounded-xl bg-sky-500/8 border border-sky-500/20">
                    <p className="text-xs text-sky-800">
                      {t.palmistry.duplicateNotice.replace(
                        "{date}",
                        new Date(analysis.verification.duplicateOf.createdAt).toLocaleDateString(),
                      )}
                    </p>
                  </div>
                )}

                {analysis.atAGlance && (
                  <section className="mb-5 p-4 rounded-xl bg-[rgba(255,252,245,0.86)] border border-[rgba(12,8,5,0.08)]">
                    <p className="text-[10px] uppercase tracking-[0.2em] text-[rgba(12,8,5,0.66)] text-center mb-3">{t.palmistry.atAGlance}</p>
                    <div className="grid grid-cols-2 gap-3">
                      {analysis.atAGlance.strengths && (
                        <div className="flex gap-2">
                          <Sparkles aria-hidden size={14} strokeWidth={1.8} className="mt-0.5 shrink-0 text-emerald-600" />
                          <div>
                            <p className="text-[10px] uppercase tracking-wider text-[rgba(12,8,5,0.66)] mb-0.5">{t.palmistry.atAGlanceStrengths}</p>
                            <p className="text-xs text-emphasis leading-snug">{analysis.atAGlance.strengths}</p>
                          </div>
                        </div>
                      )}
                      {analysis.atAGlance.lifePath && (
                        <div className="flex gap-2">
                          <Compass aria-hidden size={14} strokeWidth={1.8} className="mt-0.5 shrink-0 text-amber-600" />
                          <div>
                            <p className="text-[10px] uppercase tracking-wider text-[rgba(12,8,5,0.66)] mb-0.5">{t.palmistry.atAGlanceLifePath}</p>
                            <p className="text-xs text-emphasis leading-snug">{analysis.atAGlance.lifePath}</p>
                          </div>
                        </div>
                      )}
                      {analysis.atAGlance.love && (
                        <div className="flex gap-2">
                          <Heart aria-hidden size={14} strokeWidth={1.8} className="mt-0.5 shrink-0 text-rose-600" />
                          <div>
                            <p className="text-[10px] uppercase tracking-wider text-[rgba(12,8,5,0.66)] mb-0.5">{t.palmistry.atAGlanceLove}</p>
                            <p className="text-xs text-emphasis leading-snug">{analysis.atAGlance.love}</p>
                          </div>
                        </div>
                      )}
                      {analysis.atAGlance.bestSuitedFor && (
                        <div className="flex gap-2">
                          <Flag aria-hidden size={14} strokeWidth={1.8} className="mt-0.5 shrink-0 text-primary-700" />
                          <div>
                            <p className="text-[10px] uppercase tracking-wider text-[rgba(12,8,5,0.66)] mb-0.5">{t.palmistry.atAGlanceBestSuitedFor}</p>
                            <p className="text-xs text-emphasis leading-snug">{analysis.atAGlance.bestSuitedFor}</p>
                          </div>
                        </div>
                      )}
                    </div>
                  </section>
                )}

                {analysis.handOverview && (
                  <section className="mb-5 p-4 rounded-xl bg-primary-500/[0.04] border border-primary-500/15">
                    <p className="text-[10px] uppercase tracking-[0.2em] text-primary-300/80 text-center mb-3">{t.palmistry.handOverview}</p>
                    <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2.5">
                      {analysis.handOverview.handType && (
                        <div className="border-b border-[rgba(12,8,5,0.06)] pb-2">
                          <dt className="text-[10px] uppercase tracking-wider text-[rgba(12,8,5,0.66)] mb-0.5">{t.palmistry.handOverviewType}</dt>
                          <dd className="text-xs text-emphasis leading-snug">{analysis.handOverview.handType}</dd>
                        </div>
                      )}
                      {analysis.handOverview.palmShape && (
                        <div className="border-b border-[rgba(12,8,5,0.06)] pb-2">
                          <dt className="text-[10px] uppercase tracking-wider text-[rgba(12,8,5,0.66)] mb-0.5">{t.palmistry.handOverviewShape}</dt>
                          <dd className="text-xs text-emphasis leading-snug">{analysis.handOverview.palmShape}</dd>
                        </div>
                      )}
                      {analysis.handOverview.fingers && (
                        <div className="border-b border-[rgba(12,8,5,0.06)] pb-2">
                          <dt className="text-[10px] uppercase tracking-wider text-[rgba(12,8,5,0.66)] mb-0.5">{t.palmistry.handOverviewFingers}</dt>
                          <dd className="text-xs text-emphasis leading-snug">{analysis.handOverview.fingers}</dd>
                        </div>
                      )}
                      {analysis.handOverview.thumb && (
                        <div className="border-b border-[rgba(12,8,5,0.06)] pb-2">
                          <dt className="text-[10px] uppercase tracking-wider text-[rgba(12,8,5,0.66)] mb-0.5">{t.palmistry.handOverviewThumb}</dt>
                          <dd className="text-xs text-emphasis leading-snug">{analysis.handOverview.thumb}</dd>
                        </div>
                      )}
                      {analysis.handOverview.dominantHand && (
                        <div className="border-b border-[rgba(12,8,5,0.06)] pb-2 sm:col-span-2">
                          <dt className="text-[10px] uppercase tracking-wider text-[rgba(12,8,5,0.66)] mb-0.5">{t.palmistry.handOverviewDominantHand}</dt>
                          <dd className="text-xs text-emphasis leading-snug">{analysis.handOverview.dominantHand}</dd>
                        </div>
                      )}
                    </dl>
                  </section>
                )}

                {!analysis.handOverview && analysis.handShape && (
                  <div className="mb-4 p-3 rounded-xl bg-primary-500/[0.06] border border-primary-500/20">
                    <p className="text-[11px] uppercase tracking-wider text-primary-300/80 mb-1">{t.palmistry.handShape}</p>
                    <p className="text-sm font-semibold text-surface-950">{analysis.handShape.type}</p>
                    {analysis.handShape.description && (
                      <p className="mt-1 text-xs text-secondary leading-relaxed">{analysis.handShape.description}</p>
                    )}
                  </div>
                )}

                {/* The user's own palm as a neon wireframe when real geometry
                    exists; the classic schematic otherwise. */}
                {analysis.geometry &&
                (analysis.geometry.polylines.length > 0 || analysis.geometry.landmarks.length === 21) ? (
                  <div className="mb-6">
                    <PalmWireframe
                      geometry={analysis.geometry}
                      sourceImage={image}
                      onFeatureSelect={handleFeatureSelect}
                      selectedFeature={selectedFeature}
                      labels={{
                        title: t.palmistry.wireframeTitle,
                        download: t.palmistry.wireframeDownload,
                        showPhoto: t.palmistry.wireframeShowPhoto,
                        measured: t.palmistry.wireframeMeasured,
                        major: t.palmistry.majorLines,
                        minor: t.palmistry.minorLines,
                        skeleton: t.palmistry.wireframeSkeleton,
                      }}
                    />
                  </div>
                ) : (
                  <div className="mb-6 p-4 rounded-xl bg-[rgba(255,252,245,0.70)]">
                    <PalmDiagram
                      analysis={analysis}
                      onFeatureSelect={handleFeatureSelect}
                      selectedFeature={selectedFeature}
                    />
                  </div>
                )}

                {/* Verification badge — the report's authenticity anchor. */}
                {analysis.verification?.authentic && analysis.verification.verificationId && (
                  <div className="mb-6 flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5 rounded-xl bg-emerald-500/8 border border-emerald-500/20">
                    <span className="flex items-center gap-1.5 text-xs font-semibold text-emerald-700">
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      {t.palmistry.verifiedReading}
                    </span>
                    <span className="text-[11px] text-emerald-800/80 font-mono">
                      {t.palmistry.verificationIdLabel}: {analysis.verification.verificationId}
                    </span>
                    <span className="text-[11px] text-emerald-800/80">
                      {t.palmistry.groundednessLabel}: {Math.round(analysis.verification.groundednessScore * 100)}%
                    </span>
                  </div>
                )}

                <ScrollableRow
                  className="mb-6 rounded-xl bg-[rgba(255,252,245,0.78)] p-1"
                  fadeColor="rgb(255, 252, 245)"
                  controls={false}
                >
                  <div role="tablist" aria-label={t.palmistry.results} className="flex gap-1">
                    {tabs.map((tab) => (
                      <button
                        key={tab.id}
                        role="tab"
                        aria-selected={activeTab === tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`focus-ring flex-shrink-0 flex-1 py-2 px-3 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
                          activeTab === tab.id
                            ? "btn-primary text-white"
                            : "text-emphasis hover:text-surface-950"
                        }`}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>
                </ScrollableRow>

                <div className="space-y-4">
                  {activeTab === "major" && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {analysis.majorLines.map((line) => (
                        <div
                          key={line.name}
                          className={`p-4 rounded-xl transition-all cursor-pointer ${
                            selectedFeature === line.name
                              ? "bg-[rgba(12,8,5,0.05)] ring-1 ring-primary-500/30"
                              : "bg-[rgba(255,252,245,0.78)] hover:bg-[rgba(255,252,245,0.86)]"
                          }`}
                          onClick={() => setSelectedFeature(selectedFeature === line.name ? null : line.name)}
                        >
                          <div className="flex items-start justify-between gap-2 mb-1">
                            <div>
                              <h4 className="font-semibold text-surface-950 text-sm leading-tight">{line.name}</h4>
                              {line.subtitle && (
                                <p className="text-[10px] uppercase tracking-wider text-primary-300/70 mt-0.5">{line.subtitle}</p>
                              )}
                            </div>
                            <span className={`text-[10px] font-medium uppercase tracking-wider whitespace-nowrap ${strengthColor(line.strength)}`}>
                              {strengthLabel(line.strength)}
                            </span>
                          </div>
                          {line.observations.length > 0 && (
                            <ul className="mt-2 space-y-1">
                              {line.observations.map((obs, i) => (
                                <li key={i} className="flex items-start gap-1.5 text-[11px] text-secondary leading-snug">
                                  <span aria-hidden className="mt-1 inline-block h-1 w-1 rounded-full bg-white/40 shrink-0" />
                                  <span>{obs}</span>
                                </li>
                              ))}
                            </ul>
                          )}
                          {line.description && (
                            <p className="mt-2 text-xs text-[rgba(12,8,5,0.72)] leading-relaxed italic">{line.description}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {activeTab === "minor" && (
                    analysis.minorLines.length > 0 ? (
                      analysis.minorLines.map((line) => (
                        <div key={line.name} className="p-4 rounded-xl bg-[rgba(255,252,245,0.78)]">
                          <h4 className="font-semibold text-surface-950 text-sm mb-2">{line.name}</h4>
                          <p className="text-xs text-[rgba(12,8,5,0.66)] leading-relaxed">{line.description}</p>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-[rgba(12,8,5,0.66)] text-center py-4">{t.palmistry.noMinorLines}</p>
                    )
                  )}

                  {activeTab === "mounts" &&
                    analysis.mounts.map((mount) => (
                      <div
                        key={mount.name}
                        className={`p-4 rounded-xl transition-all cursor-pointer ${
                          selectedFeature === mount.name
                            ? "bg-[rgba(12,8,5,0.05)] ring-1 ring-purple-500/30"
                            : "bg-[rgba(255,252,245,0.78)] hover:bg-[rgba(255,252,245,0.86)]"
                        }`}
                        onClick={() => setSelectedFeature(selectedFeature === mount.name ? null : mount.name)}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="font-semibold text-surface-950 text-sm">{mount.name}</h4>
                          <span className={`text-xs font-medium ${
                            mount.prominence === "high" ? "text-emerald-400" : "text-accent-400"
                          }`}>
                            {prominenceLabel(mount.prominence)}
                          </span>
                        </div>
                        <p className="text-xs text-[rgba(12,8,5,0.66)] leading-relaxed">{mount.description}</p>
                      </div>
                    ))}

                  {activeTab === "insights" && (
                    <div className="space-y-4">
                      {analysis.insights.length > 0 ? (
                        analysis.insights.map((insight, i) => (
                          <div key={i} className="p-4 rounded-xl bg-[rgba(255,252,245,0.78)]">
                            <h4 className="font-semibold text-surface-950 text-sm mb-2">{insight.label}</h4>
                            <p className="text-xs text-[rgba(12,8,5,0.72)] leading-relaxed whitespace-pre-line">{insight.text}</p>
                          </div>
                        ))
                      ) : (
                        <p className="text-sm text-[rgba(12,8,5,0.66)] text-center py-4">{t.palmistry.noInsights}</p>
                      )}
                      {analysis.cautions && (
                        <div className="p-4 rounded-xl bg-amber-500/[0.06] border border-amber-500/20">
                          <h4 className="font-semibold text-amber-800 text-sm mb-2">{t.palmistry.cautions}</h4>
                          <p className="text-xs text-amber-900/80 leading-relaxed">{analysis.cautions}</p>
                        </div>
                      )}
                      {analysis.fingerAnalysis.length > 0 && (
                        <div className="p-4 rounded-xl bg-[rgba(255,252,245,0.78)]">
                          <h4 className="font-semibold text-surface-950 text-sm mb-3">{t.palmistry.fingerAnalysis}</h4>
                          <div className="space-y-2">
                            {analysis.fingerAnalysis.map((f, i) => (
                              <div key={i} className="flex items-start gap-2">
                                <span className="text-primary-400 text-xs font-medium min-w-[80px]">{f.finger}</span>
                                <p className="text-xs text-[rgba(12,8,5,0.66)]">{f.interpretation}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {activeTab === "timing" && (
                    analysis.timingInsights.length > 0 ? (
                      <div className="space-y-3">
                        {analysis.timingInsights.map((ti, i) => (
                          <div key={i} className="p-4 rounded-xl bg-[rgba(255,252,245,0.78)]">
                            <div className="flex items-center justify-between mb-2">
                              <h4 className="font-semibold text-surface-950 text-sm">{ti.ageRange}</h4>
                              {ti.area && (
                                <span className="text-[10px] uppercase tracking-wider text-primary-300/80">{ti.area}</span>
                              )}
                            </div>
                            <p className="text-xs text-[rgba(12,8,5,0.72)] leading-relaxed">{ti.description}</p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-[rgba(12,8,5,0.66)] text-center py-4">{t.palmistry.noTimingInsights}</p>
                    )
                  )}

                  {activeTab === "markings" && (
                    analysis.specialMarkings.length > 0 ? (
                      <div className="space-y-3">
                        {analysis.specialMarkings.map((m, i) => (
                          <div key={i} className="p-4 rounded-xl bg-[rgba(255,252,245,0.78)]">
                            <div className="flex items-center justify-between mb-2">
                              <h4 className="font-semibold text-surface-950 text-sm">{m.name}</h4>
                              {m.location && (
                                <span className="text-[10px] text-[rgba(12,8,5,0.66)]">{m.location}</span>
                              )}
                            </div>
                            <p className="text-xs text-[rgba(12,8,5,0.72)] leading-relaxed">{m.interpretation}</p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-[rgba(12,8,5,0.66)] text-center py-4">{t.palmistry.noSpecialMarkings}</p>
                    )
                  )}
                </div>

                {/* "Show Your Work" — the deterministic factors behind this
                    reading (measured geometry + observed features). */}
                {analysis.factors.length > 0 && (
                  <div className="mt-6">
                    <ShowYourWork factors={analysis.factors} />
                  </div>
                )}

                {analysis.closingAffirmation && (
                  <div className="mt-6 pt-5 border-t border-[rgba(12,8,5,0.08)] text-center">
                    <p className="text-[10px] uppercase tracking-[0.25em] text-primary-300/60 mb-2">{t.palmistry.yourPath}</p>
                    <p className="text-sm italic text-emphasis leading-relaxed max-w-md mx-auto">
                      {analysis.closingAffirmation}
                    </p>
                  </div>
                )}

                <div className="mt-5 grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <button
                    onClick={handleDownload}
                    className="focus-ring py-3 rounded-xl btn-secondary text-sm font-medium text-primary-300"
                  >
                    {t.palmistry.downloadReport}
                  </button>
                  <button
                    onClick={handlePrint}
                    className="focus-ring py-3 rounded-xl bg-[rgba(255,252,245,0.86)] text-sm font-medium text-emphasis hover:text-surface-950"
                  >
                    {t.palmistry.printReport}
                  </button>
                  <button
                    onClick={() => {
                      setAnalysis(null);
                      setImage(null);
                      setImageFile(null);
                      setSelectedFeature(null);
                    }}
                    className="focus-ring py-3 rounded-xl bg-[rgba(255,252,245,0.86)] text-sm font-medium text-emphasis hover:text-surface-950"
                  >
                    {t.palmistry.startOver}
                  </button>
                </div>

                <Interpretation
                  domain="palmistry"
                  input={{
                    handType: analysis.handOverview?.handType || analysis.handShape?.type || undefined,
                    palmShape: analysis.handOverview?.palmShape || undefined,
                    majorLines: analysis.majorLines.map((l) => ({ name: l.name, strength: l.strength })),
                    mounts: analysis.mounts.map((m) => ({ name: m.name, prominence: m.prominence })),
                  }}
                  className="mt-6 sm:mt-8"
                />
              </div>
            ) : (
              <div className="surface-card p-12 flex flex-col items-center justify-center min-h-[400px] text-center">
                <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary-500/10 text-primary-300">
                  <svg className="h-7 w-7" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8} aria-hidden>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-emphasis mb-2">{t.palmistry.analysisResults}</h3>
                <p className="text-sm text-secondary max-w-xs">{t.palmistry.uploadPrompt}</p>
              </div>
            )}
          </div>
        </div>

        {/* Disclaimer */}
        <div className="mt-12 text-center">
          <p className="text-xs text-[rgba(12,8,5,0.66)]">{t.palmistry.disclaimer}</p>
        </div>
      </div>

      {showCamera && (
        <CameraCapture
          onCapture={handleCameraCapture}
          onClose={() => setShowCamera(false)}
          // Vedic convention: male → right (active) palm, female → left.
          expectedHand={gender === "male" ? "Right" : gender === "female" ? "Left" : null}
          labels={{
            title: t.palmistry.useCamera,
            capture: t.palmistry.takePhoto,
            retake: t.palmistry.retake,
            use: t.palmistry.usePhoto,
            cancel: t.common.cancel,
            switchCamera: t.palmistry.switchCamera,
            error: t.palmistry.cameraError,
            starting: t.palmistry.cameraStarting,
            overlayHint: t.palmistry.cameraOverlayHint,
            gateHand: t.palmistry.gateHand,
            gateWrongHand: t.palmistry.gateWrongHand,
            gateCloser: t.palmistry.gateCloser,
            gateLight: t.palmistry.gateLight,
            gateSharp: t.palmistry.gateSharp,
            gateSteady: t.palmistry.gateSteady,
            gateReady: t.palmistry.gateReady,
            confirmFailed: t.palmistry.captureConfirmFailed,
          }}
        />
      )}
    </div>
  );
}
