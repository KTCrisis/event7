// Dashboard skeleton — shown during page transitions
// Next.js automatically wraps page content in Suspense with this as fallback

export default function DashboardLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Header skeleton */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-7 w-48 bg-slate-800 rounded-md" />
          <div className="h-4 w-72 bg-slate-800/60 rounded-md" />
        </div>
        <div className="h-9 w-28 bg-slate-800 rounded-md" />
      </div>

      {/* KPI cards skeleton */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="rounded-xl border border-slate-800/60 bg-slate-900/30 p-5"
          >
            <div className="h-3 w-16 bg-slate-800 rounded mb-3" />
            <div className="h-8 w-12 bg-slate-800/80 rounded" />
          </div>
        ))}
      </div>

      {/* Content skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-xl border border-slate-800/60 bg-slate-900/30 p-6 h-64" />
        <div className="rounded-xl border border-slate-800/60 bg-slate-900/30 p-6 h-64" />
      </div>
    </div>
  );
}
