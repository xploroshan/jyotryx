"use client";

import { useEffect, useRef, useState } from "react";

interface CameraCaptureProps {
  onCapture: (file: File) => void;
  onClose: () => void;
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
  };
}

export default function CameraCapture({ onCapture, onClose, labels }: CameraCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(true);
  const [facingMode, setFacingMode] = useState<"user" | "environment">("environment");
  const [snapshot, setSnapshot] = useState<{ dataUrl: string; blob: Blob } | null>(null);
  const [hasMultipleCameras, setHasMultipleCameras] = useState(false);

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

  const handleCapture = () => {
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
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        const dataUrl = canvas.toDataURL("image/jpeg", 0.92);
        setSnapshot({ dataUrl, blob });
      },
      "image/jpeg",
      0.92,
    );
  };

  const handleUse = () => {
    if (!snapshot) return;
    const file = new File([snapshot.blob], `palm-${Date.now()}.jpg`, { type: "image/jpeg" });
    onCapture(file);
  };

  const handleRetake = () => setSnapshot(null);

  const switchCamera = () => setFacingMode((m) => (m === "user" ? "environment" : "user"));

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

        {/* Hand outline overlay (only when previewing live) */}
        {!snapshot && !starting && !error && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <svg viewBox="0 0 320 430" className="h-[80%] w-auto opacity-30">
              <path
                d={`M 160,400 C 70,400 40,340 40,290 L 40,245 C 40,235 32,218 28,210 C 18,190 15,180 20,175 C 25,170 35,175 42,185 L 55,210 L 55,160 C 55,148 62,138 72,138 C 82,138 90,148 90,160 L 90,100 C 90,86 98,76 108,76 C 118,76 126,86 126,100 L 126,55 C 126,40 134,28 145,28 C 156,28 164,40 164,55 L 164,90 C 170,80 180,74 190,74 C 202,74 210,84 210,100 L 210,110 C 216,100 226,94 236,96 C 248,98 255,110 255,125 L 255,240 C 255,300 230,340 200,370 C 185,385 172,395 160,400 Z`}
                fill="none"
                stroke="white"
                strokeWidth="2"
                strokeDasharray="6 4"
              />
            </svg>
          </div>
        )}

        {!snapshot && !starting && !error && (
          <div className="absolute bottom-24 left-0 right-0 px-4 text-center text-sm text-white/80">
            {labels.overlayHint}
          </div>
        )}

        {starting && !error && (
          <div className="absolute inset-0 flex items-center justify-center text-sm text-white/70">
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
          className="focus-ring rounded-xl bg-white/10 px-4 py-2.5 text-sm font-medium text-white"
        >
          {labels.cancel}
        </button>

        {snapshot ? (
          <div className="flex items-center gap-2">
            <button
              onClick={handleRetake}
              className="focus-ring rounded-xl bg-white/10 px-4 py-2.5 text-sm font-medium text-white"
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
            className="focus-ring rounded-xl bg-white/10 p-2.5 text-white"
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
