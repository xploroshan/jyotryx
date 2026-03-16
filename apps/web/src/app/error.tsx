"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        <div className="text-6xl mb-4">🔮</div>
        <h2 className="text-2xl font-bold text-white mb-2">Something went wrong</h2>
        <p className="text-gray-400 mb-6">
          The stars seem misaligned. Please try again.
        </p>
        <button
          onClick={reset}
          className="px-6 py-3 rounded-xl bg-gradient-to-r from-primary-600 to-mystic-600 text-white font-semibold hover:from-primary-500 hover:to-mystic-500 transition-all"
        >
          Try Again
        </button>
      </div>
    </div>
  );
}
