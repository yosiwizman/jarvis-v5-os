'use client';

import { useEffect } from 'react';

export default function SettingsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log error for debugging (minimal info, no secrets)
    console.error('[Settings Error]', error.message);
  }, [error]);

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
          The settings page encountered an error. This might be due to a browser extension, 
          network issue, or storage problem.
        </p>
        
        <div className="bg-black/30 rounded-lg p-3 font-mono text-sm text-white/50 overflow-x-auto">
          {error.message || 'Unknown error'}
        </div>
        
        <div className="flex gap-3">
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
        </div>
        
        <p className="text-xs text-white/40">
          If the problem persists, try clearing your browser cache or using a different browser.
        </p>
      </div>
    </div>
  );
}
