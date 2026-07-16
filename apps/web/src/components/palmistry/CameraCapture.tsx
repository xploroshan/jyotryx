"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { evaluateCapturedStill, evaluateHandPose, landmarkMovement, measureFrameQuality } from "@/lib/palm/quality";

interface CameraCaptureProps {
  onCapture: (file: File) => void;
  onClose: () => void;
  /** Which physical palm we expect (Vedic: male → Right, female → Left). */
  expectedHand?: "Left" | "Right" | null;
  labels: {
    title: string;
    capture: string;
    retake: string;
    use: string;
    cancel: string;
    switchCamera: string;
    error: string;
    starting: string;
    overlayHint: string;
    gateHand: string;
    gateWrongHand: string;
    gateCloser: string;
    gateLight: string;
    gateSharp: string;
    gateSteady: string;
    gateReady: string;
    confirmFailed: string;
  };
}

type GateState = {
  hand: boolean;
  correctHand: boolean;
  coverage: boolean;
  brightness: boolean;
  sharpness: boolean;
  steady: boolean;
};

const TICK_MS = 250;
const STEADY_THRESHOLD = 0.012; // mean normalized landmark movement per tick
const PASS_TICKS_TO_CAPTURE = 3; // ~750ms of everything green → auto-capture

export default function CameraCapture({ onCapture, onClose, expectedHand = null, labels }: CameraCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(true);
  const [facingMode, setFacingMode] = useState<"user" | "environment">("environment");
  const [snapshot, setSnapshot] = useState<{ dataUrl: string; blob: Blob } | null>(null);
  const [hasMultipleCameras, setHasMultipleCameras] = useState(false);

  // ── Guided-scan state. `guided` flips false if the landmarker can't load —
  // the modal then behaves exactly like the classic manual capture. ──
  const [guided, setGuided] = useState(true);
  const [gates, setGates] = useState<GateState | null>(null);
  const [readyProgress, setReadyProgress] = useState(0); // 0..1 toward auto-capture
  const landmarkerRef = useRef<{ detectVideo: (v: HTMLVideoElement, ts: number) => { landmarks: { x: number; y: number; z: number }[]; handedness: "Left" | "Right"; score: number } | null } | null>(null);
  const prevLandmarksRef = useRef<{ x: number; y: number }[] | null>(null);
  const passStreakRef = useRef(0);
  const capturedRef = useRef(false);
  const measureCanvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function start() {
      setStarting(true);
      setError(null);
      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          throw new Error("unsupported");
        }
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: facingMode }, width: { ideal: 1280 }, height: { ideal: 1280 } },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
        }
        try {
          const devices = await navigator.mediaDevices.enumerateDevices();
          const cams = devices.filter((d) => d.kind === "videoinput");
          if (!cancelled) setHasMultipleCameras(cams.length > 1);
        } catch {
          // ignore
        }
        if (!cancelled) setStarting(false);
      } catch {
        if (!cancelled) {
          setError(labels.error);
          setStarting(false);
        }
      }
    }

    start();

    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, [facingMode, labels.error]);

  // Clear the pending confirm-message timer on unmount.
  useEffect(
    () => () => {
      if (confirmClearRef.current) clearTimeout(confirmClearRef.current);
    },
    [],
  );

  // Load the (self-hosted) landmarker for the guided loop; degrade gracefully.
  useEffect(() => {
    let cancelled = false;
    import("@/lib/palm/handLandmarker")
      .then((m) => m.getHandLandmarker("VIDEO"))
      .then((lm) => {
        if (!cancelled) landmarkerRef.current = lm;
      })
      .catch(() => {
        if (!cancelled) setGuided(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const [confirmFailed, setConfirmFailed] = useState(false);
  const confirmClearRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleCapture = useCallback(async () => {
    const video = videoRef.current;
    if (!video) return;
    const w = video.videoWidth || 1280;
    const h = video.videoHeight || 1280;
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, w, h);

    // Post-capture confirmation on the EXACT still (IMAGE mode). The live
    // gates run in VIDEO mode, whose temporal tracking can carry a stale or
    // borderline lock straight through the shutter — in the dorsal-capture
    // incident every chip was green while the captured still wasn't even
    // detectable as a hand in IMAGE mode. Confirm on the still; on failure,
    // resume scanning instead of shipping a doomed photo to a paid analysis.
    if (guided) {
      try {
        const { getHandLandmarker } = await import("@/lib/palm/handLandmarker");
        const imageLandmarker = await getHandLandmarker("IMAGE");
        const det = imageLandmarker.detectImage(canvas);
        const verdict = evaluateCapturedStill(det, expectedHand);
        if (!verdict.ok) {
          setConfirmFailed(true);
          if (confirmClearRef.current) clearTimeout(confirmClearRef.current);
          confirmClearRef.current = setTimeout(() => setConfirmFailed(false), 4000);
          passStreakRef.current = 0;
          setReadyProgress(0);
          capturedRef.current = false; // let the guided loop try again
          return;
        }
      } catch {
        // Confirmation unavailable (model failed to load in IMAGE mode) —
        // fall through to a plain capture; the server re-validates anyway.
      }
    }

    setConfirmFailed(false);
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        const dataUrl = canvas.toDataURL("image/jpeg", 0.92);
        setSnapshot({ dataUrl, blob });
      },
      "image/jpeg",
      0.92,
    );
  }, [guided, expectedHand]);

  // ── The guided tick: pose gates + frame-quality gates + steadiness →
  // auto-capture after a short all-green streak. ──
  useEffect(() => {
    if (!guided || snapshot || starting || error) return;
    capturedRef.current = false;
    const interval = setInterval(() => {
      const video = videoRef.current;
      const landmarker = landmarkerRef.current;
      if (!video || !landmarker || video.readyState < 2) return;
      try {
        const det = landmarker.detectVideo(video, performance.now());
        const mirrored = facingMode === "user";
        const pose = evaluateHandPose(det?.landmarks ?? null, {
          expectedHand,
          detectedHand: det?.handedness ?? null,
          mirrored,
        });

        let brightness = false;
        let sharpness = false;
        if (det && pose.handPresent) {
          // Measure ONLY the hand's bounding box so background light doesn't
          // skew the stats (fairer across skin tones and rooms).
          const xs = det.landmarks.map((p) => p.x);
          const ys = det.landmarks.map((p) => p.y);
          const pad = 0.03;
          const x0 = Math.max(0, Math.min(...xs) - pad);
          const y0 = Math.max(0, Math.min(...ys) - pad);
          const x1 = Math.min(1, Math.max(...xs) + pad);
          const y1 = Math.min(1, Math.max(...ys) + pad);
          const roiW = 160;
          const roiH = Math.max(16, Math.round((roiW * (y1 - y0)) / Math.max(0.01, x1 - x0)));
          if (!measureCanvasRef.current) measureCanvasRef.current = document.createElement("canvas");
          const canvas = measureCanvasRef.current;
          canvas.width = roiW;
          canvas.height = roiH;
          const ctx = canvas.getContext("2d", { willReadFrequently: true });
          if (ctx) {
            const vw = video.videoWidth || 1280;
            const vh = video.videoHeight || 1280;
            ctx.drawImage(video, x0 * vw, y0 * vh, (x1 - x0) * vw, (y1 - y0) * vh, 0, 0, roiW, roiH);
            const q = measureFrameQuality(ctx.getImageData(0, 0, roiW, roiH).data, roiW, roiH);
            brightness = q.brightnessOk;
            sharpness = q.sharpnessOk;
          }
        }

        const movement = landmarkMovement(prevLandmarksRef.current, det?.landmarks ?? null);
        const steady = movement < STEADY_THRESHOLD;
        prevLandmarksRef.current = det?.landmarks ?? null;

        const next: GateState = {
          hand: pose.handPresent,
          correctHand: pose.handPresent && pose.correctHand && pose.palmFacing,
          coverage: pose.coverageOk,
          brightness,
          sharpness,
          steady,
        };
        setGates(next);

        const allPass = Object.values(next).every(Boolean);
        passStreakRef.current = allPass ? passStreakRef.current + 1 : 0;
        setReadyProgress(Math.min(1, passStreakRef.current / PASS_TICKS_TO_CAPTURE));
        if (allPass && passStreakRef.current >= PASS_TICKS_TO_CAPTURE && !capturedRef.current) {
          capturedRef.current = true;
          handleCapture();
        }
      } catch {
        // A single bad tick is fine; persistent failure just means the user
        // uses the manual shutter.
      }
    }, TICK_MS);
    return () => clearInterval(interval);
  }, [guided, snapshot, starting, error, facingMode, expectedHand, handleCapture]);

  const handleUse = () => {
    if (!snapshot) return;
    const file = new File([snapshot.blob], `palm-${Date.now()}.jpg`, { type: "image/jpeg" });
    onCapture(file);
  };

  const handleRetake = () => {
    passStreakRef.current = 0;
    setReadyProgress(0);
    setSnapshot(null);
  };

  const switchCamera = () => setFacingMode((m) => (m === "user" ? "environment" : "user"));

  const allGreen = gates ? Object.values(gates).every(Boolean) : false;

  const chip = (ok: boolean | undefined, textOk: string, textBad: string, key: string) => (
    <span
      key={key}
      className={`px-2 py-1 rounded-full text-[11px] font-medium border ${
        ok
          ? "bg-emerald-500/20 text-emerald-300 border-emerald-400/40"
          : "bg-white/10 text-white/80 border-white/20"
      }`}
    >
      {ok ? `${textOk} ✓` : textBad}
    </span>
  );

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={labels.title}
      className="fixed inset-0 z-50 flex flex-col bg-black"
    >
      <div className="relative flex-1 flex items-center justify-center overflow-hidden">
        {snapshot ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={snapshot.dataUrl} alt={labels.title} className="max-h-full max-w-full object-contain" />
        ) : (
          <video
            ref={videoRef}
            playsInline
            muted
            autoPlay
            className="max-h-full max-w-full object-contain"
          />
        )}

        {/* Hand outline overlay — dashed white while scanning, solid neon
            green once every gate holds. */}
        {!snapshot && !starting && !error && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <svg viewBox="0 0 320 430" className="h-[80%] w-auto" style={{ opacity: allGreen ? 0.75 : 0.3 }}>
              <path
                d={`M 160,400 C 70,400 40,340 40,290 L 40,245 C 40,235 32,218 28,210 C 18,190 15,180 20,175 C 25,170 35,175 42,185 L 55,210 L 55,160 C 55,148 62,138 72,138 C 82,138 90,148 90,160 L 90,100 C 90,86 98,76 108,76 C 118,76 126,86 126,100 L 126,55 C 126,40 134,28 145,28 C 156,28 164,40 164,55 L 164,90 C 170,80 180,74 190,74 C 202,74 210,84 210,100 L 210,110 C 216,100 226,94 236,96 C 248,98 255,110 255,125 L 255,240 C 255,300 230,340 200,370 C 185,385 172,395 160,400 Z`}
                fill="none"
                stroke={allGreen ? "#34d399" : "white"}
                strokeWidth={allGreen ? 3 : 2}
                strokeDasharray={allGreen ? undefined : "6 4"}
              />
            </svg>
          </div>
        )}

        {/* Guided-scan gate chips */}
        {guided && !snapshot && !starting && !error && (
          <div className="absolute top-4 left-0 right-0 px-4 flex flex-wrap justify-center gap-1.5">
            {gates ? (
              <>
                {chip(gates.hand, labels.gateHand, labels.gateHand, "hand")}
                {chip(gates.correctHand, labels.gateHand, labels.gateWrongHand, "correct")}
                {chip(gates.coverage, labels.gateCloser, labels.gateCloser, "coverage")}
                {chip(gates.brightness, labels.gateLight, labels.gateLight, "light")}
                {chip(gates.sharpness, labels.gateSharp, labels.gateSharp, "sharp")}
                {chip(gates.steady, labels.gateSteady, labels.gateSteady, "steady")}
              </>
            ) : (
              chip(false, labels.gateHand, labels.gateHand, "init")
            )}
          </div>
        )}

        {/* Post-capture confirmation failed → explain and keep scanning */}
        {guided && confirmFailed && !snapshot && !starting && !error && (
          <div className="absolute bottom-40 left-0 right-0 px-6 text-center">
            <span className="inline-block px-3 py-1.5 rounded-full bg-amber-500/25 border border-amber-400/50 text-amber-200 text-xs font-semibold">
              {labels.confirmFailed}
            </span>
          </div>
        )}

        {/* Auto-capture progress ring text */}
        {guided && !snapshot && !starting && !error && readyProgress > 0 && (
          <div className="absolute bottom-32 left-0 right-0 text-center">
            <span className="inline-block px-3 py-1.5 rounded-full bg-emerald-500/25 border border-emerald-400/50 text-emerald-200 text-xs font-semibold">
              {labels.gateReady} {Math.round(readyProgress * 100)}%
            </span>
          </div>
        )}

        {!snapshot && !starting && !error && (
          <div className="absolute bottom-24 left-0 right-0 px-4 text-center text-sm text-emphasis">
            {labels.overlayHint}
          </div>
        )}

        {starting && !error && (
          <div className="absolute inset-0 flex items-center justify-center text-sm text-emphasis">
            {labels.starting}
          </div>
        )}

        {error && (
          <div className="absolute inset-0 flex items-center justify-center px-6 text-center text-sm text-red-300">
            {error}
          </div>
        )}
      </div>

      <div className="flex items-center justify-between gap-3 bg-black/90 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <button
          onClick={onClose}
          className="focus-ring rounded-xl bg-white/10 px-4 py-2.5 text-sm font-medium text-surface-950"
        >
          {labels.cancel}
        </button>

        {snapshot ? (
          <div className="flex items-center gap-2">
            <button
              onClick={handleRetake}
              className="focus-ring rounded-xl bg-white/10 px-4 py-2.5 text-sm font-medium text-surface-950"
            >
              {labels.retake}
            </button>
            <button
              onClick={handleUse}
              className="focus-ring rounded-xl bg-primary-500 px-4 py-2.5 text-sm font-semibold text-white"
            >
              {labels.use}
            </button>
          </div>
        ) : (
          <button
            onClick={handleCapture}
            disabled={starting || !!error}
            aria-label={labels.capture}
            className="focus-ring h-16 w-16 rounded-full border-4 border-white bg-white/20 transition active:scale-95 disabled:opacity-40"
          >
            <span className="block h-full w-full rounded-full border-2 border-white bg-white" />
          </button>
        )}

        {hasMultipleCameras && !snapshot ? (
          <button
            onClick={switchCamera}
            aria-label={labels.switchCamera}
            className="focus-ring rounded-xl bg-white/10 p-2.5 text-surface-950"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 4v5h.582M20 20v-5h-.581M5.582 9A7.003 7.003 0 0 1 12 5c1.933 0 3.683.78 4.95 2.05M19.418 15A7.003 7.003 0 0 1 12 19a7 7 0 0 1-4.95-2.05"
              />
            </svg>
          </button>
        ) : (
          <span className="w-10" aria-hidden />
        )}
      </div>
    </div>
  );
}
