'use client';
// AKIOR diagnostics page (client component)

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { BRAND_VERSION, PRIMARY_HOSTNAME, SECONDARY_HOSTNAMES } from '@/lib/brand';

type BuildInfo = {
  ok: boolean;
  git_sha?: string;
  build_time?: string;
  service?: string;
  brand_version?: string;
};

type SecureContextInfo = {
  isSecureContext: boolean;
  protocol: string;
  mediaDevicesAvailable: boolean;
};

type LLMDetails = {
  provider?: string;
  configured?: boolean;
  baseUrlHost?: string;
};

type SystemStatus = {
  ok: boolean;
  level: 'healthy' | 'setup_required' | 'needs_trust' | 'degraded' | 'error';
  reasons: string[];
  details: {
    llm?: LLMDetails;
    [key: string]: unknown;
  };
  git_sha?: string;
  time?: string;
};

export default function DiagnosticsPage() {
  const { admin, pinConfigured, loading: authLoading } = useAuth();
  const [webBuild, setWebBuild] = useState<BuildInfo | null>(null);
  const [serverBuild, setServerBuild] = useState<BuildInfo | null>(null);
  const [webError, setWebError] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [host, setHost] = useState<string>('');
  const [mounted, setMounted] = useState(false);
  const [secureContext, setSecureContext] = useState<SecureContextInfo | null>(null);
  const [systemStatus, setSystemStatus] = useState<SystemStatus | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);

  // Render function to avoid type issues
  const renderStatusError = (): React.ReactNode => {
    if (!statusError) return null;
    return (
      <div className="card p-4 bg-red-500/10 border border-red-500/40 text-red-300" data-testid="status-error">
        <p className="font-semibold">✗ Status fetch failed</p>
        <p className="text-sm">{statusError}</p>
      </div>
    );
  };

  useEffect(() => {
    // Set mounted flag and capture client-only values
    setMounted(true);
    setHost(window.location.host);
    
    // Check secure context status
    setSecureContext({
      isSecureContext: window.isSecureContext,
      protocol: window.location.protocol,
      mediaDevicesAvailable: typeof navigator !== 'undefined' && 'mediaDevices' in navigator,
    });
    
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

    // Fetch system status
    fetch('/api/health/status')
      .then((r) => r.json())
      .then((data) => setSystemStatus(data))
      .catch((err) => setStatusError(String(err)));
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

      {/* System Status Card */}
      {systemStatus && (
        <div 
          className={`card p-4 space-y-2 ${
            systemStatus.level === 'healthy' 
              ? 'bg-green-500/10 border border-green-500/40'
              : systemStatus.level === 'error'
                ? 'bg-red-500/10 border border-red-500/40'
                : 'bg-amber-500/10 border border-amber-500/40'
          }`}
          data-testid="system-status"
        >
          <div className="font-semibold border-b border-white/20 pb-2 mb-2 flex items-center gap-2">
            {systemStatus.level === 'healthy' ? (
              <span className="text-green-300">✓ System Healthy</span>
            ) : systemStatus.level === 'error' ? (
              <span className="text-red-300">✗ System Error</span>
            ) : (
              <span className="text-amber-300">⚠ {systemStatus.level === 'setup_required' ? 'Setup Required' : systemStatus.level === 'degraded' ? 'Degraded' : 'Needs Trust'}</span>
            )}
          </div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
            <div className="text-white/60">Status level:</div>
            <div className="font-mono">{systemStatus.level}</div>
            <div className="text-white/60">Server SHA:</div>
            <div className="font-mono">{systemStatus.git_sha || 'unknown'}</div>
          </div>
          {systemStatus.reasons.length > 0 && (
            <div className="mt-2 pt-2 border-t border-white/10">
              <div className="text-white/60 text-sm mb-1">Reasons:</div>
              <ul className="text-sm list-disc list-inside text-amber-200">
                {systemStatus.reasons.map((reason, i) => (
                  <li key={i}>{reason}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
      {renderStatusError()}

      {/* LLM Provider Status */}
      {systemStatus?.details?.llm && (() => {
        const llm = systemStatus.details.llm;
        const isConfigured = llm?.configured ?? false;
        const provider = llm?.provider;
        const baseUrlHost = llm?.baseUrlHost;
        return (
          <div 
            className={`card p-4 space-y-2 ${
              isConfigured
                ? 'bg-green-500/10 border border-green-500/40'
                : 'bg-amber-500/10 border border-amber-500/40'
            }`}
            data-testid="llm-status"
          >
            <div className="font-semibold border-b border-white/20 pb-2 mb-2 flex items-center gap-2">
              {isConfigured ? (
                <span className="text-green-300">✓ LLM Provider Configured</span>
              ) : (
                <span className="text-amber-300">⚠ LLM Provider Not Configured</span>
              )}
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
              <div className="text-white/60">Provider:</div>
              <div className="font-mono">
                {provider === 'openai-cloud' 
                  ? 'OpenAI Cloud' 
                  : provider === 'local-compatible'
                    ? 'Local / Compatible'
                    : provider || 'Not set'}
              </div>
              <div className="text-white/60">Configured:</div>
              <div className={isConfigured ? 'text-green-300' : 'text-amber-300'}>
                {isConfigured ? 'Yes' : 'No'}
              </div>
              {baseUrlHost && (
                <>
                  <div className="text-white/60">Endpoint:</div>
                  <div className="font-mono">{baseUrlHost}</div>
                </>
              )}
            </div>
            {!isConfigured && (
              <p className="text-xs text-amber-200 mt-2 pt-2 border-t border-white/10">
                Complete the <a href="/setup" className="underline hover:text-amber-100">Setup Wizard</a> to configure your LLM provider.
              </p>
            )}
          </div>
        );
      })()}

      {/* Admin Auth Status */}
      <div 
        className={`card p-4 space-y-2 ${
          pinConfigured 
            ? admin ? 'bg-green-500/10 border border-green-500/40' : 'bg-white/5 border border-white/10'
            : 'bg-amber-500/10 border border-amber-500/40'
        }`}
        data-testid="auth-status"
      >
        <div className="font-semibold border-b border-white/20 pb-2 mb-2">Admin Authentication</div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
          <div className="text-white/60">Owner PIN:</div>
          <div className={pinConfigured ? 'text-green-300' : 'text-amber-300'}>
            {authLoading ? 'Loading...' : pinConfigured ? 'Configured' : 'Not configured'}
          </div>
          <div className="text-white/60">Admin session:</div>
          <div className={admin ? 'text-green-300' : 'text-white/50'}>
            {authLoading ? 'Loading...' : admin ? 'Active' : 'Inactive'}
          </div>
        </div>
        {!pinConfigured && (
          <p className="text-xs text-amber-200 mt-2 pt-2 border-t border-white/10">
            Complete the Setup Wizard to configure owner PIN and protect admin routes.
          </p>
        )}
      </div>
      
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

      {/* HTTPS Trust Status */}
      {secureContext && (
        <div 
          className={`card p-4 space-y-2 ${
            secureContext.isSecureContext 
              ? 'bg-green-500/10 border border-green-500/40' 
              : 'bg-amber-500/10 border border-amber-500/40'
          }`}
          data-testid="https-trust-status"
        >
          <div className="font-semibold border-b border-white/20 pb-2 mb-2 flex items-center gap-2">
            {secureContext.isSecureContext ? (
              <span className="text-green-300">✓ Trusted HTTPS</span>
            ) : (
              <span className="text-amber-300">⚠ HTTPS Not Trusted</span>
            )}
          </div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
            <div className="text-white/60">Secure context:</div>
            <div className={secureContext.isSecureContext ? 'text-green-300' : 'text-amber-300'}>
              {secureContext.isSecureContext ? 'Yes' : 'No'}
            </div>
            <div className="text-white/60">Protocol:</div>
            <div className="font-mono">{secureContext.protocol}</div>
            <div className="text-white/60">MediaDevices API:</div>
            <div className={secureContext.mediaDevicesAvailable ? 'text-green-300' : 'text-red-300'}>
              {secureContext.mediaDevicesAvailable ? 'Available' : 'Unavailable'}
            </div>
          </div>
          {!secureContext.isSecureContext && (
            <div className="mt-3 pt-3 border-t border-white/10 text-sm">
              <p className="text-amber-200 mb-2">
                Mic/camera access requires a trusted HTTPS certificate.
              </p>
              <p className="text-white/80">To install the Caddy CA certificate on Windows:</p>
              <pre className="bg-black/40 p-2 rounded border border-white/10 mt-1">.\ops\trust-lan-https.ps1 -Apply</pre>
              <p className="text-white/60 mt-2 text-xs">Then restart your browser completely.</p>
            </div>
          )}
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
