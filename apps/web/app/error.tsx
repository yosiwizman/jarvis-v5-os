'use client';

import { useEffect, useState } from 'react';
import { BuildInfoModal } from '@/components/BuildInfoModal';

/**
 * Generate a short error ID from error message for tracking
 */
function generateErrorId(error: Error): string {
  const str = `${error.name}:${error.message}:${Date.now()}`;
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16).slice(0, 8).toUpperCase();
}

/**
 * Global Error Page (Next.js App Router)
 * 
 * This catches runtime errors in the application and displays
 * a fallback UI with build info for debugging deployment drift.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const [showBuildModal, setShowBuildModal] = useState(false);
  const errorId = generateErrorId(error);
  const gitSha = process.env.NEXT_PUBLIC_GIT_SHA || 'unknown';
  const buildTime = process.env.NEXT_PUBLIC_BUILD_TIME || 'unknown';

  // Format build time
  let formattedTime = buildTime;
  if (buildTime !== 'unknown') {
    try {
      const date = new Date(buildTime);
      formattedTime = date.toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      // Keep original
    }
  }

  useEffect(() => {
    // Log error safely (no secrets)
    console.error('[GlobalError] Page error:', {
      errorId,
      name: error.name,
      message: error.message,
      digest: error.digest,
      gitSha,
      buildTime,
    });
  }, [error, errorId, gitSha, buildTime]);

  return (
    <div className="min-h-screen bg-[#0a0f14] flex items-center justify-center p-8">
      <div className="max-w-lg w-full space-y-6">
        {/* Error Icon */}
        <div className="flex justify-center">
          <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center">
            <svg className="w-8 h-8 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
        </div>

        {/* Error Message */}
        <div className="text-center space-y-2">
          <h1 className="text-xl font-semibold text-white">Something went wrong</h1>
          <p className="text-white/60">
            The application encountered an unexpected error. This might be due to a stale deployment or a bug.
          </p>
        </div>

        {/* Error Details Card */}
        <div className="bg-black/30 border border-white/10 rounded-xl p-4 space-y-3">
          {/* Error ID */}
          <div className="flex justify-between items-center">
            <span className="text-xs text-white/50">Error ID</span>
            <code className="text-xs font-mono text-amber-400">{errorId}</code>
          </div>

          {/* Error Message */}
          <div className="space-y-1">
            <span className="text-xs text-white/50">Error</span>
            <div className="bg-black/40 rounded-lg p-2 font-mono text-xs text-red-300 overflow-x-auto">
              {error.message || 'Unknown error'}
            </div>
          </div>

          {/* Build Info */}
          <div className="border-t border-white/10 pt-3 space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-xs text-white/50">Build SHA</span>
              <code className="text-xs font-mono text-cyan-400" data-testid="error-build-sha">{gitSha}</code>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-xs text-white/50">Build Time</span>
              <code className="text-xs font-mono text-white/70">{formattedTime}</code>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button
            onClick={reset}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors"
          >
            Try Again
          </button>
          <button
            onClick={() => {
              if (typeof window !== 'undefined') {
                window.location.href = '/menu';
              }
            }}
            className="px-4 py-2 bg-green-600 hover:bg-green-500 text-white rounded-lg transition-colors"
          >
            Back to Menu
          </button>
          <button
            onClick={() => setShowBuildModal(true)}
            className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white/70 rounded-lg transition-colors text-center"
          >
            Check Build
          </button>
        </div>

        {/* Help Text */}
        <p className="text-xs text-white/40 text-center">
          If this error persists, click &quot;Check Build&quot; to verify deployment status.
        </p>

        {/* Build Info Modal */}
        <BuildInfoModal isOpen={showBuildModal} onClose={() => setShowBuildModal(false)} />
      </div>
    </div>
  );
}
