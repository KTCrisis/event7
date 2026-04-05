// Dashboard error boundary — catches unhandled errors in any dashboard page
// Next.js automatically wraps page content with this error boundary
"use client";

import { useEffect } from "react";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";
import Link from "next/link";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log error for debugging (not console.error in prod)
    if (process.env.NODE_ENV === "development") {
      console.error("Dashboard error:", error);
    }
  }, [error]);

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="text-center max-w-md">
        <div className="mx-auto w-12 h-12 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mb-4">
          <AlertTriangle className="h-6 w-6 text-red-400" />
        </div>

        <h2 className="text-lg font-semibold text-white mb-2">
          Something went wrong
        </h2>

        <p className="text-sm text-slate-400 mb-6 leading-relaxed">
          {error.message || "An unexpected error occurred. This might be a temporary issue with your registry connection."}
        </p>

        <div className="flex items-center justify-center gap-3">
          <button
            onClick={reset}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-teal-500/10 text-teal-400 border border-teal-500/20 hover:bg-teal-500/20 transition-colors"
          >
            <RefreshCw className="h-4 w-4" />
            Try again
          </button>
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg text-slate-400 border border-slate-700 hover:text-white hover:border-slate-600 transition-colors"
          >
            <Home className="h-4 w-4" />
            Dashboard
          </Link>
        </div>

        {error.digest && (
          <p className="mt-4 text-xs text-slate-600">
            Error ID: {error.digest}
          </p>
        )}
      </div>
    </div>
  );
}
