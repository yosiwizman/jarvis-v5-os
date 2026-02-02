import { useEffect, useState } from 'react';
import { BRAND_VERSION, PRIMARY_HOSTNAME, SECONDARY_HOSTNAMES } from '@/lib/brand';

type BuildInfo = {
  ok: boolean;
  git_sha?: string;
  build_time?: string;
  service?: string;
};

export default function DiagnosticsPage() {
  const [buildInfo, setBuildInfo] = useState<BuildInfo | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/health/build')
      .then((r) => r.json())
      .then((data) => setBuildInfo(data))
      .catch((err) => setError(String(err)));
  }, []);

  const host = typeof window !== 'undefined' ? window.location.host : '';
  const clientSha = process.env.NEXT_PUBLIC_GIT_SHA || 'unknown';
  const serverSha = buildInfo?.git_sha || 'unknown';
  const mismatch = clientSha !== 'unknown' && serverSha !== 'unknown' && clientSha !== serverSha;
  const legacyHostUsed = host.endsWith('.local');

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">AKIOR Diagnostics</h1>
      <div className="card p-4 space-y-2">
        <div><strong>Host:</strong> {host}</div>
        <div><strong>Primary hostname:</strong> {PRIMARY_HOSTNAME}</div>
        <div><strong>Secondary hostnames:</strong> {SECONDARY_HOSTNAMES.join(', ')}</div>
        <div><strong>Brand version:</strong> {BRAND_VERSION}</div>
        <div><strong>Client build SHA:</strong> {clientSha}</div>
        <div><strong>Server build SHA:</strong> {serverSha}</div>
        {buildInfo?.build_time && <div><strong>Server build time:</strong> {buildInfo.build_time}</div>}
        {error && <div className="text-red-400">Error: {error}</div>}
      </div>

      {(mismatch || legacyHostUsed) && (
        <div className="card p-4 bg-amber-500/10 border border-amber-500/40 text-amber-200" data-testid="hostname-warning">
          <p className="font-semibold">Warning</p>
          {mismatch && <p>- You are connected to a host serving a different build (client {clientSha} vs server {serverSha}).</p>}
          {legacyHostUsed && <p>- You are using a .local hostname. Prefer https://{PRIMARY_HOSTNAME} for stability.</p>}
        </div>
      )}

      <div className="card p-4 space-y-2">
        <p className="font-semibold">Quick Fix (hosts file override)</p>
        <p>Add this line to your hosts file to force the canonical hostname:</p>
        <pre className="bg-black/40 p-3 rounded border border-white/10">{`<your_LAN_IP> ${PRIMARY_HOSTNAME}`}</pre>
        <p className="text-sm text-white/60">Replace {'<your_LAN_IP>'} with the server’s LAN IP (see CLI helper in /ops).</p>
      </div>
    </div>
  );
}
