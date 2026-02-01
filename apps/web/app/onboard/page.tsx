'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { BRAND, VOICE_ROUTE } from '@/lib/brand';

type CheckStatus = 'loading' | 'ok' | 'error';

type EndpointCheck = {
  status: CheckStatus;
  detail?: string;
};

const DOCS_LAN_TLS_URL =
  'https://github.com/yosiwizman/jarvis-v5-os/blob/main/docs/ops/lan-tls-trust.md';

function StatusBadge({ status }: { status: CheckStatus }) {
  if (status === 'ok') {
    return <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300">OK</span>;
  }
  if (status === 'error') {
    return <span className="text-xs px-2 py-0.5 rounded-full bg-red-500/20 text-red-300">Error</span>;
  }
  return <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300">Checking…</span>;
}

export default function OnboardPage() {
  const [origin, setOrigin] = useState<string>('');
  const [isInsecure, setIsInsecure] = useState(false);
  const [copied, setCopied] = useState(false);
  const [healthCheck, setHealthCheck] = useState<EndpointCheck>({ status: 'loading' });
  const [buildCheck, setBuildCheck] = useState<EndpointCheck>({ status: 'loading' });
  const [sseCheck, setSseCheck] = useState<EndpointCheck>({ status: 'loading' });
  const [isChecking, setIsChecking] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const host = window.location.hostname;
    const isIpHost = /^\d{1,3}(\.\d{1,3}){3}$/.test(host);
    const isHttps = window.location.protocol === 'https:';
    const secure = window.isSecureContext && isHttps;
    setIsInsecure(!secure || isIpHost);
    setOrigin(window.location.origin);
  }, []);

  const copyCanonicalUrl = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(BRAND.canonicalUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }, []);

  const checkEndpoints = useCallback(async () => {
    setIsChecking(true);
    setHealthCheck({ status: 'loading' });
    setBuildCheck({ status: 'loading' });
    setSseCheck({ status: 'loading' });

    const checkJson = async (url: string) => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 4000);
      try {
        const res = await fetch(url, { cache: 'no-store', signal: controller.signal });
        const payload = await res.json().catch(() => null);
        if (!res.ok || (payload && payload.ok === false)) {
          return { status: 'error' as CheckStatus, detail: `HTTP ${res.status}` };
        }
        const detail = payload?.git_sha ? `SHA ${payload.git_sha}` : 'ok';
        return { status: 'ok' as CheckStatus, detail };
      } catch (err) {
        const detail = err instanceof Error ? err.message : 'Request failed';
        return { status: 'error' as CheckStatus, detail };
      } finally {
        clearTimeout(timeout);
      }
    };

    const checkSse = async () => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 4000);
      try {
        const res = await fetch('/api/notifications/stream', { signal: controller.signal, cache: 'no-store' });
        const contentType = res.headers.get('content-type') || '';
        if (res.ok && contentType.includes('text/event-stream')) {
          return { status: 'ok' as CheckStatus, detail: 'event-stream' };
        }
        return { status: 'error' as CheckStatus, detail: `HTTP ${res.status}` };
      } catch (err) {
        const detail = err instanceof Error ? err.message : 'Request failed';
        return { status: 'error' as CheckStatus, detail };
      } finally {
        clearTimeout(timeout);
        controller.abort();
      }
    };

    const [health, build, sse] = await Promise.all([
      checkJson('/api/health'),
      checkJson('/api/health/build'),
      checkSse()
    ]);

    setHealthCheck(health);
    setBuildCheck(build);
    setSseCheck(sse);
    setIsChecking(false);
  }, []);

  useEffect(() => {
    void checkEndpoints();
  }, [checkEndpoints]);

  const steps = useMemo(
    () => [
      {
        title: 'Use HTTPS',
        description: `Open ${BRAND.canonicalUrl} on every LAN device for camera/mic access.`,
        action: (
          <div className="flex flex-wrap items-center gap-3">
            <a href={BRAND.canonicalUrl} className="btn" target="_blank" rel="noreferrer">
              Open {BRAND.canonicalUrl}
            </a>
            <button type="button" className="btn" onClick={copyCanonicalUrl}>
              {copied ? 'Copied' : 'Copy URL'}
            </button>
          </div>
        )
      },
      {
        title: 'Verify Health',
        description: 'Confirm API health and build metadata respond without errors.',
        action: (
          <div className="flex flex-wrap items-center gap-3">
            <a className="btn" href="/api/health" target="_blank" rel="noreferrer">
              /api/health
            </a>
            <a className="btn" href="/api/health/build" target="_blank" rel="noreferrer">
              /api/health/build
            </a>
          </div>
        )
      },
      {
        title: 'Add API Keys',
        description: 'Configure OpenAI + Meshy keys to unlock AI features.',
        action: (
          <Link className="btn" href="/settings#provider-keys">
            Open Provider Keys
          </Link>
        )
      },
      {
        title: 'Test Voice',
        description: `Launch the ${BRAND.productName} voice assistant to verify audio.`,
        action: (
          <Link className="btn" href={VOICE_ROUTE}>
            Open Voice Assistant
          </Link>
        )
      },
      {
        title: 'Optional: Trust LAN certificate',
        description: 'Install the LAN root CA on this device to remove browser warnings.',
        action: (
          <a className="btn" href={DOCS_LAN_TLS_URL} target="_blank" rel="noreferrer">
            View LAN TLS Guide
          </a>
        )
      }
    ],
    [copyCanonicalUrl, copied]
  );

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold">Onboarding / Setup</h1>
        <p className="text-sm text-white/60">
          First-run checklist to get {BRAND.productName} ready on the LAN.
        </p>
      </header>

      {isInsecure && (
        <div className="card p-4 border border-amber-500/40 bg-amber-500/10">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-sm text-amber-100">
              <strong>Secure LAN Access</strong> — For camera/mic and full functionality, use{' '}
              <a href={BRAND.canonicalUrl} className="underline hover:no-underline">
                {BRAND.canonicalUrl}
              </a>
              .
            </div>
            <button type="button" className="btn" onClick={copyCanonicalUrl}>
              {copied ? 'Copied' : 'Copy URL'}
            </button>
          </div>
        </div>
      )}

      <section className="card p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">Live Status</h2>
            <p className="text-sm text-white/50">Quick checks (no hanging connections).</p>
          </div>
          <button type="button" className="btn" onClick={checkEndpoints} disabled={isChecking}>
            {isChecking ? 'Checking…' : 'Refresh'}
          </button>
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          <div className="rounded-xl border border-white/10 p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-white/70">/api/health</span>
              <StatusBadge status={healthCheck.status} />
            </div>
            {healthCheck.detail && <div className="text-xs text-white/50">{healthCheck.detail}</div>}
          </div>
          <div className="rounded-xl border border-white/10 p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-white/70">/api/health/build</span>
              <StatusBadge status={buildCheck.status} />
            </div>
            {buildCheck.detail && <div className="text-xs text-white/50">{buildCheck.detail}</div>}
          </div>
          <div className="rounded-xl border border-white/10 p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-white/70">/api/notifications/stream</span>
              <StatusBadge status={sseCheck.status} />
            </div>
            {sseCheck.detail && <div className="text-xs text-white/50">{sseCheck.detail}</div>}
          </div>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        {steps.map((step, idx) => (
          <div key={step.title} className="card p-6 space-y-3">
            <div className="flex items-center justify-between">
              <div className="text-xs uppercase tracking-wide text-white/40">Step {idx + 1}</div>
            </div>
            <div className="space-y-1">
              <div className="text-lg font-semibold">{step.title}</div>
              <p className="text-sm text-white/60">{step.description}</p>
            </div>
            {step.action}
          </div>
        ))}
      </section>

      <section className="card p-6 space-y-2">
        <div className="text-sm text-white/60">
          Current origin:{' '}
          <span className="font-mono text-white/80">{origin || 'loading…'}</span>
        </div>
      </section>
    </div>
  );
}
