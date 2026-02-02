'use client';
// AKIOR diagnostics page (client component)

import { useEffect, useState } from 'react';
import { BRAND_VERSION, PRIMARY_HOSTNAME, SECONDARY_HOSTNAMES } from '@/lib/brand';

type BuildInfo = {
  ok: boolean;
  git_sha?: string;
  build_time?: string;
  service?: string;
  brand_version?: string;
};

export default function DiagnosticsPage() {
  const [webBuild, setWebBuild] = useState<BuildInfo | null>(null);
  const [serverBuild, setServerBuild] = useState<BuildInfo | null>(null);
  const [webError, setWebError] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [host, setHost] = useState<string>('');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // Set mounted flag and capture client-only values
    setMounted(true);
    setHost(window.location.host);
    
    // Fetch web build info (directly from web container)
    fetch('/web-build')
      .then((r) => r.json())
      .then((data) => setWebBuild(data))
      .catch((err) => setWebError(String(err)));

    // Fetch server build info (from server container via /api)
    fetch('/api/health/build')
      .then((r) => r.json())
      .then((data) => setServerBuild(data))
      .catch((err) => setServerError(String(err)));
  }, []);

  const webSha = webBuild?.git_sha || 'loading...';
  const serverSha = serverBuild?.git_sha || 'loading...';
  const webBuildTime = webBuild?.build_time || 'unknown';
  const serverBuildTime = serverBuild?.build_time || 'unknown';
  
  // Drift detection: both must be loaded and must match
  const bothLoaded = webBuild && serverBuild;
  const shaMatch = bothLoaded && webSha === serverSha && webSha !== 'unknown';
  const shaDrift = bothLoaded && webSha !== serverSha && webSha !== 'unknown' && serverSha !== 'unknown';
  const legacyHostUsed = mounted && host.endsWith('.local');

  return (
    <div className="space-y-4" data-testid="diagnostics-page">
      <h1 className="text-2xl font-bold">AKIOR Diagnostics</h1>
      
      {/* Build Info Card */}
      <div className="card p-4 space-y-2">
        <div className="font-semibold border-b border-white/20 pb-2 mb-2">Build Information</div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
          <div className="text-white/60">Web SHA:</div>
          <div data-testid="web-sha" className={shaDrift ? 'text-red-400 font-mono' : 'font-mono'}>{webSha}</div>
          <div className="text-white/60">Server SHA:</div>
          <div data-testid="server-sha" className={shaDrift ? 'text-red-400 font-mono' : 'font-mono'}>{serverSha}</div>
          <div className="text-white/60">Web build time:</div>
          <div className="text-white/80">{webBuildTime}</div>
          <div className="text-white/60">Server build time:</div>
          <div className="text-white/80">{serverBuildTime}</div>
          <div className="text-white/60">Brand version:</div>
          <div className="text-white/80">{BRAND_VERSION}</div>
        </div>
        {webError && <div className="text-red-400 text-sm">Web fetch error: {webError}</div>}
        {serverError && <div className="text-red-400 text-sm">Server fetch error: {serverError}</div>}
      </div>

      {/* SHA Match Status */}
      {bothLoaded && (
        <div 
          className={`card p-4 ${shaMatch ? 'bg-green-500/10 border border-green-500/40' : 'bg-red-500/10 border border-red-500/40'}`}
          data-testid="sha-status"
        >
          {shaMatch ? (
            <div className="text-green-300 flex items-center gap-2">
              <span className="text-lg">✓</span>
              <span>Web and Server are in sync (SHA: {webSha})</span>
            </div>
          ) : (
            <div className="text-red-300" data-testid="drift-warning">
              <p className="font-semibold flex items-center gap-2">
                <span className="text-lg">⚠</span>
                <span>DEPLOYMENT DRIFT DETECTED</span>
              </p>
              <p className="text-sm mt-1">Web ({webSha}) and Server ({serverSha}) are running different builds.</p>
              <p className="text-sm mt-1">Run: <code className="bg-black/40 px-2 py-0.5 rounded">ops/deploy.ps1 -Rebuild</code> to sync both containers.</p>
            </div>
          )}
        </div>
      )}

      {/* Hostname Info */}
      <div className="card p-4 space-y-2">
        <div className="font-semibold border-b border-white/20 pb-2 mb-2">Hostname Information</div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
          <div className="text-white/60">Current host:</div>
          <div className="font-mono">{host}</div>
          <div className="text-white/60">Primary hostname:</div>
          <div className="font-mono">{PRIMARY_HOSTNAME}</div>
          <div className="text-white/60">Aliases:</div>
          <div className="text-white/80">{SECONDARY_HOSTNAMES.join(', ')}</div>
        </div>
      </div>

      {/* Warnings */}
      {legacyHostUsed && (
        <div className="card p-4 bg-amber-500/10 border border-amber-500/40 text-amber-200" data-testid="hostname-warning">
          <p className="font-semibold">⚠ Legacy Hostname</p>
          <p className="text-sm">You are using a .local hostname which may have mDNS issues.</p>
          <p className="text-sm">Prefer: <code className="bg-black/40 px-2 py-0.5 rounded">https://{PRIMARY_HOSTNAME}</code></p>
        </div>
      )}

      {/* Quick Fix */}
      <div className="card p-4 space-y-2">
        <p className="font-semibold">Quick Fix (hosts file override)</p>
        <p className="text-sm text-white/80">If DNS is not resolving correctly, add this to your hosts file:</p>
        <pre className="bg-black/40 p-3 rounded border border-white/10 text-sm">{`<your_LAN_IP> ${PRIMARY_HOSTNAME} akior.local`}</pre>
        <p className="text-sm text-white/60">Windows: Run <code className="bg-black/40 px-1 rounded">.\ops\dns-doctor.ps1 -Apply -UseLoopback</code> as Admin</p>
      </div>
    </div>
  );
}
