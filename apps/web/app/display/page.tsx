'use client';

import { useState, useEffect, useCallback } from 'react';
import { BRAND, PRIMARY_HOSTNAME } from '@/lib/brand';

interface HealthStatus {
  ok: boolean;
  timestamp?: string;
  uptime?: number;
  error?: string;
}

interface SystemMetrics {
  cpuLoad?: number;
  memoryUsedPct?: number;
  memoryUsedGB?: number;
  memoryTotalGB?: number;
  uptime?: number;
  timestamp?: string;
}

interface DisplayHealth {
  web: HealthStatus;
  api: HealthStatus;
  metrics: SystemMetrics | null;
  hostname: string;
  lastUpdate: string;
}

function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  
  if (days > 0) return `${days}d ${hours}h ${mins}m`;
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
}

function StatusCard({ 
  title, 
  status, 
  subtitle,
  icon 
}: { 
  title: string; 
  status: 'ok' | 'error' | 'loading'; 
  subtitle?: string;
  icon: string;
}) {
  const statusColors = {
    ok: 'border-green-500/50 bg-green-500/10',
    error: 'border-red-500/50 bg-red-500/10',
    loading: 'border-yellow-500/50 bg-yellow-500/10 animate-pulse'
  };

  const statusText = {
    ok: 'Online',
    error: 'Offline',
    loading: 'Checking...'
  };

  return (
    <div className={`rounded-xl border-2 p-6 ${statusColors[status]} transition-all duration-300`}>
      <div className="flex items-center gap-4">
        <span className="text-4xl">{icon}</span>
        <div className="flex-1">
          <h3 className="text-xl font-semibold text-white/90">{title}</h3>
          <p className={`text-lg font-medium ${status === 'ok' ? 'text-green-400' : status === 'error' ? 'text-red-400' : 'text-yellow-400'}`}>
            {statusText[status]}
          </p>
          {subtitle && (
            <p className="text-sm text-white/60 mt-1">{subtitle}</p>
          )}
        </div>
      </div>
    </div>
  );
}

function MetricCard({ 
  title, 
  value, 
  unit,
  icon,
  color = 'cyan'
}: { 
  title: string; 
  value: string | number; 
  unit?: string;
  icon: string;
  color?: 'cyan' | 'purple' | 'amber';
}) {
  const colorClasses = {
    cyan: 'border-cyan-500/50 bg-cyan-500/10 text-cyan-400',
    purple: 'border-purple-500/50 bg-purple-500/10 text-purple-400',
    amber: 'border-amber-500/50 bg-amber-500/10 text-amber-400'
  };

  return (
    <div className={`rounded-xl border-2 p-6 ${colorClasses[color]} transition-all duration-300`}>
      <div className="flex items-center gap-4">
        <span className="text-3xl">{icon}</span>
        <div>
          <p className="text-sm text-white/60">{title}</p>
          <p className="text-2xl font-bold">
            {value}{unit && <span className="text-lg ml-1 text-white/60">{unit}</span>}
          </p>
        </div>
      </div>
    </div>
  );
}

function DisplayDashboard() {
  const [health, setHealth] = useState<DisplayHealth | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [error, setError] = useState<string | null>(null);
  const [showChrome, setShowChrome] = useState(true);

  // Fetch health data
  const fetchHealth = useCallback(async () => {
    try {
      // Fetch API health
      const apiRes = await fetch('/api/health', { 
        cache: 'no-store',
        signal: AbortSignal.timeout(5000)
      });
      const apiData = apiRes.ok ? await apiRes.json() : { ok: false, error: 'API unreachable' };

      // Fetch system metrics
      let metricsData: SystemMetrics | null = null;
      try {
        const metricsRes = await fetch('/api/system/metrics', { 
          cache: 'no-store',
          signal: AbortSignal.timeout(5000)
        });
        if (metricsRes.ok) {
          metricsData = await metricsRes.json();
        }
      } catch {
        // Metrics are optional
      }

      setHealth({
        web: { ok: true, timestamp: new Date().toISOString() },
        api: apiData,
        metrics: metricsData,
        hostname: typeof window !== 'undefined' ? window.location.hostname : 'unknown',
        lastUpdate: new Date().toISOString()
      });
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch health');
      setHealth(prev => prev ? {
        ...prev,
        api: { ok: false, error: 'Request failed' },
        lastUpdate: new Date().toISOString()
      } : null);
    }
  }, []);

  // Poll health every 10 seconds
  useEffect(() => {
    fetchHealth();
    const interval = setInterval(fetchHealth, 10000);
    return () => clearInterval(interval);
  }, [fetchHealth]);

  // Update clock every second
  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  // Handle fullscreen
  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  }, []);

  // Listen for fullscreen changes
  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);

  // Auto-hide chrome after 5 seconds in fullscreen
  useEffect(() => {
    if (isFullscreen) {
      const timer = setTimeout(() => setShowChrome(false), 5000);
      return () => clearTimeout(timer);
    } else {
      setShowChrome(true);
    }
  }, [isFullscreen]);

  // Show chrome on mouse move
  useEffect(() => {
    if (!isFullscreen) return;
    
    let timeout: NodeJS.Timeout;
    const handler = () => {
      setShowChrome(true);
      clearTimeout(timeout);
      timeout = setTimeout(() => setShowChrome(false), 3000);
    };
    
    window.addEventListener('mousemove', handler);
    return () => {
      window.removeEventListener('mousemove', handler);
      clearTimeout(timeout);
    };
  }, [isFullscreen]);

  const webStatus = health?.web.ok ? 'ok' : health === null ? 'loading' : 'error';
  const apiStatus = health?.api.ok ? 'ok' : health === null ? 'loading' : 'error';

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white p-8">
      {/* Header */}
      <header className={`flex items-center justify-between mb-8 transition-opacity duration-300 ${showChrome ? 'opacity-100' : 'opacity-0'}`}>
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-2xl font-bold">
            A
          </div>
          <div>
            <h1 className="text-2xl font-bold">{BRAND.productName} Display</h1>
            <p className="text-white/60 text-sm">System Status Monitor</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <button
            onClick={toggleFullscreen}
            className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors text-sm"
          >
            {isFullscreen ? '⛶ Exit Fullscreen' : '⛶ Fullscreen'}
          </button>
        </div>
      </header>

      {/* Clock */}
      <div className="text-center mb-12">
        <p className="text-7xl font-light tracking-wider">
          {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </p>
        <p className="text-xl text-white/60 mt-2">
          {currentTime.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
        </p>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="mb-8 p-4 rounded-xl bg-red-500/20 border border-red-500/50 text-red-300">
          ⚠️ {error}
        </div>
      )}

      {/* Status Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatusCard 
          title="Web UI" 
          status={webStatus}
          subtitle={health?.hostname}
          icon="🌐"
        />
        <StatusCard 
          title="API Server" 
          status={apiStatus}
          subtitle={health?.api.uptime ? `Uptime: ${formatUptime(health.api.uptime)}` : undefined}
          icon="⚡"
        />
        <MetricCard
          title="CPU Load"
          value={health?.metrics?.cpuLoad ?? '--'}
          unit="%"
          icon="🔧"
          color="cyan"
        />
        <MetricCard
          title="Memory"
          value={health?.metrics?.memoryUsedPct ?? '--'}
          unit="%"
          icon="💾"
          color="purple"
        />
      </div>

      {/* Additional Info */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <MetricCard
          title="System Uptime"
          value={health?.metrics?.uptime ? formatUptime(health.metrics.uptime) : '--'}
          icon="⏱️"
          color="amber"
        />
        <MetricCard
          title="Memory Used"
          value={health?.metrics?.memoryUsedGB?.toFixed(1) ?? '--'}
          unit={`/ ${health?.metrics?.memoryTotalGB?.toFixed(0) ?? '--'} GB`}
          icon="📊"
          color="cyan"
        />
        <MetricCard
          title="Last Update"
          value={health?.lastUpdate ? new Date(health.lastUpdate).toLocaleTimeString() : '--'}
          icon="🔄"
          color="purple"
        />
      </div>

      {/* Footer */}
      <footer className={`text-center text-white/40 text-sm transition-opacity duration-300 ${showChrome ? 'opacity-100' : 'opacity-0'}`}>
        <p>{BRAND.productName} System Monitor • Auto-refresh every 10s</p>
        <p className="mt-1">
          Access: <span className="text-cyan-400">https://{health?.hostname || PRIMARY_HOSTNAME}/display</span>
        </p>
      </footer>
    </div>
  );
}

// Error Boundary wrapper
export default function DisplayPage() {
  const [hasError, setHasError] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    const handleError = (event: ErrorEvent) => {
      setHasError(true);
      setErrorMessage(event.message || 'An unexpected error occurred');
      event.preventDefault();
    };

    window.addEventListener('error', handleError);
    return () => window.removeEventListener('error', handleError);
  }, []);

  if (hasError) {
    return (
      <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center p-8">
        <div className="max-w-md text-center">
          <div className="text-6xl mb-6">⚠️</div>
          <h1 className="text-2xl font-bold mb-4">Display Error</h1>
          <p className="text-white/60 mb-6">{errorMessage}</p>
          <button
            onClick={() => {
              setHasError(false);
              setErrorMessage('');
              window.location.reload();
            }}
            className="px-6 py-3 bg-cyan-600 hover:bg-cyan-500 rounded-lg transition-colors"
          >
            Reload Display
          </button>
        </div>
      </div>
    );
  }

  return <DisplayDashboard />;
}
