'use client';

import { useEffect, useMemo } from 'react';

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

export default function SettingsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const errorId = useMemo(() => generateErrorId(error), [error]);
  const gitSha = process.env.NEXT_PUBLIC_GIT_SHA || 'unknown';
  const buildTime = process.env.NEXT_PUBLIC_BUILD_TIME || 'unknown';

  // Format build time
  const formattedTime = useMemo(() => {
    if (buildTime !== 'unknown') {
      try {
        const date = new Date(buildTime);
        return date.toLocaleString(undefined, {
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        });
      } catch {
        return buildTime;
      }
    }
    return buildTime;
  }, [buildTime]);

  useEffect(() => {
    // Log error for debugging (minimal info, no secrets)
    console.error('[Settings Error]', {
      errorId,
      message: error.message,
      digest: error.digest,
      gitSha,
      buildTime,
    });
  }, [error, errorId, gitSha, buildTime]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Settings</h1>
      
      <div className="card p-6 space-y-4 border-red-500/30">
        <div className="flex items-center gap-3 text-red-400">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <span className="text-lg font-medium">Something went wrong</span>
        </div>
        
        <p className="text-white/60">
          The settings page encountered an error. This might be due to a stale deployment, 
          browser extension, network issue, or storage problem.
        </p>
        
        <div className="bg-black/30 rounded-lg p-3 font-mono text-sm text-white/50 overflow-x-auto space-y-2">
          <div className="flex justify-between">
            <span className="text-white/40">Error ID:</span>
            <span className="text-amber-400">{errorId}</span>
          </div>
          <div className="text-red-300">{error.message || 'Unknown error'}</div>
        </div>

        {/* Build Info */}
        <div className="bg-black/20 rounded-lg p-3 space-y-1">
          <div className="flex justify-between text-xs">
            <span className="text-white/40">Build SHA:</span>
            <code className="text-cyan-400 font-mono" data-testid="settings-error-build-sha">{gitSha}</code>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-white/40">Build Time:</span>
            <code className="text-white/60 font-mono">{formattedTime}</code>
          </div>
        </div>
        
        <div className="flex flex-wrap gap-3">
          <button
            onClick={reset}
            className="btn"
          >
            Try again
          </button>
          <button
            onClick={() => {
              // Clear localStorage settings and reload
              if (typeof window !== 'undefined') {
                window.localStorage.removeItem('smartMirrorSettings');
                window.location.reload();
              }
            }}
            className="btn btn-secondary"
          >
            Reset settings
          </button>
          <a
            href="/api/health/build"
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-secondary"
          >
            Check Build
          </a>
        </div>
        
        <p className="text-xs text-white/40">
          If the problem persists, compare the build SHA above with{' '}
          <code className="text-cyan-400/70">/api/health/build</code> to check for deployment drift,
          or try clearing your browser cache.
        </p>
      </div>
    </div>
  );
}
