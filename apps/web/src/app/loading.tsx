export default function Loading() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-primary-500" />
        <p className="text-xs text-surface-50/30">Loading...</p>
      </div>
    </div>
  );
}
