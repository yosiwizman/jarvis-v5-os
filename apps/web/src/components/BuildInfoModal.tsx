'use client';

import { useState, useEffect, useCallback } from 'react';

interface BuildInfo {
  ok: boolean;
  git_sha: string;
  build_time: string;
  app_version: string;
  service: string;
}

interface DriftInfo {
  drift: boolean;
  web_sha: string;
  server_sha: string;
  caddy_sha: string;
  checked_at: string;
}

interface BuildInfoModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function BuildInfoModal({ isOpen, onClose }: BuildInfoModalProps) {
  const [buildInfo, setBuildInfo] = useState<BuildInfo | null>(null);
  const [driftInfo, setDriftInfo] = useState<DriftInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchInfo = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const [buildRes, driftRes] = await Promise.allSettled([
        fetch('/api/health/build'),
        fetch('/api/ops/drift'),
      ]);

      if (buildRes.status === 'fulfilled' && buildRes.value.ok) {
        const data = await buildRes.value.json();
        setBuildInfo(data);
      } else {
        setBuildInfo(null);
      }

      if (driftRes.status === 'fulfilled' && driftRes.value.ok) {
        const data = await driftRes.value.json();
        setDriftInfo(data);
      } else {
        setDriftInfo(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch build info');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      fetchInfo();
    }
  }, [isOpen, fetchInfo]);

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  // Client build info from env
  const clientSha = process.env.NEXT_PUBLIC_GIT_SHA || 'unknown';
  const clientBuildTime = process.env.NEXT_PUBLIC_BUILD_TIME || 'unknown';

  // Format timestamp
  const formatTime = (time: string) => {
    if (time === 'unknown' || !time) return 'unknown';
    try {
      const date = new Date(time);
      return date.toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
    } catch {
      return time;
    }
  };

  // Check if client SHA matches server SHA (potential drift)
  const hasDrift = driftInfo?.drift || (buildInfo && clientSha !== 'unknown' && buildInfo.git_sha !== 'unknown' && clientSha !== buildInfo.git_sha);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-[#0d1318] border border-white/10 rounded-2xl shadow-2xl max-w-md w-full mx-4 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
          <h2 className="text-lg font-semibold text-white">Build Information</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/10 transition-colors"
          >
            <svg className="w-5 h-5 text-white/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="w-8 h-8 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : error ? (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
              <p className="text-sm text-red-400">{error}</p>
              <button
                onClick={fetchInfo}
                className="mt-2 text-xs text-red-300 hover:text-red-200 underline"
              >
                Retry
              </button>
            </div>
          ) : (
            <>
              {/* Drift Warning */}
              {hasDrift && (
                <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 flex items-start gap-3">
                  <svg className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <div>
                    <p className="text-sm font-medium text-amber-300">Deployment Drift Detected</p>
                    <p className="text-xs text-amber-300/70 mt-1">
                      Client and server builds may be mismatched. Try reloading the page.
                    </p>
                  </div>
                </div>
              )}

              {/* Client Info */}
              <div className="space-y-2">
                <h3 className="text-xs font-medium text-white/50 uppercase tracking-wider">Client (Browser)</h3>
                <div className="bg-black/30 rounded-lg p-3 space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-white/50">SHA</span>
                    <code className="text-xs font-mono text-cyan-400">{clientSha}</code>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-white/50">Build Time</span>
                    <code className="text-xs font-mono text-white/70">{formatTime(clientBuildTime)}</code>
                  </div>
                </div>
              </div>

              {/* Server Info */}
              {buildInfo && (
                <div className="space-y-2">
                  <h3 className="text-xs font-medium text-white/50 uppercase tracking-wider">Server (API)</h3>
                  <div className="bg-black/30 rounded-lg p-3 space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-white/50">SHA</span>
                      <code className="text-xs font-mono text-cyan-400">{buildInfo.git_sha}</code>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-white/50">Version</span>
                      <code className="text-xs font-mono text-white/70">{buildInfo.app_version}</code>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-white/50">Service</span>
                      <code className="text-xs font-mono text-white/70">{buildInfo.service}</code>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-white/50">Status</span>
                      <span className={`text-xs font-medium ${buildInfo.ok ? 'text-green-400' : 'text-red-400'}`}>
                        {buildInfo.ok ? '● Healthy' : '● Unhealthy'}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Drift Info */}
              {driftInfo && (
                <div className="space-y-2">
                  <h3 className="text-xs font-medium text-white/50 uppercase tracking-wider">Deployment Status</h3>
                  <div className="bg-black/30 rounded-lg p-3 space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-white/50">Drift</span>
                      <span className={`text-xs font-medium ${driftInfo.drift ? 'text-amber-400' : 'text-green-400'}`}>
                        {driftInfo.drift ? '● Detected' : '● None'}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-white/50">Web SHA</span>
                      <code className="text-xs font-mono text-white/70">{driftInfo.web_sha?.slice(0, 7) || 'unknown'}</code>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-white/50">Server SHA</span>
                      <code className="text-xs font-mono text-white/70">{driftInfo.server_sha?.slice(0, 7) || 'unknown'}</code>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-white/50">Caddy SHA</span>
                      <code className="text-xs font-mono text-white/70">{driftInfo.caddy_sha?.slice(0, 7) || 'unknown'}</code>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-white/10 flex justify-end gap-3">
          <button
            onClick={fetchInfo}
            disabled={loading}
            className="px-4 py-2 text-sm bg-white/10 hover:bg-white/20 text-white/70 rounded-lg transition-colors disabled:opacity-50"
          >
            Refresh
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

export default BuildInfoModal;
