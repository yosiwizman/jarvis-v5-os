import { useEffect, useState, useCallback } from 'react';
import { buildServerUrl } from '@/lib/api';

export type StatusLevel = 'healthy' | 'setup_required' | 'degraded' | 'error' | 'loading' | 'offline';

export interface SystemStatus {
  ok: boolean;
  level: StatusLevel;
  reasons: string[];
  details?: {
    keys?: {
      openai: boolean;
      meshy: boolean;
    };
    notifications?: {
      ok: boolean;
      clientCount: number;
    };
    uptime?: number;
  };
  git_sha?: string;
  time?: string;
}

interface UseSystemStatusResult {
  status: SystemStatus;
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

const POLL_INTERVAL = 30_000; // Poll every 30 seconds

export function useSystemStatus(): UseSystemStatusResult {
  const [status, setStatus] = useState<SystemStatus>({
    ok: false,
    level: 'loading',
    reasons: [],
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStatus = useCallback(async () => {
    try {
      const response = await fetch(buildServerUrl('/api/health/status'), {
        signal: AbortSignal.timeout(10000)
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json() as SystemStatus;
      
      setStatus(data);
      setError(null);
      setIsLoading(false);
    } catch (err) {
      // If we can't reach the server at all, mark as offline
      const isOffline = !navigator.onLine || 
        (err instanceof Error && (
          err.name === 'TimeoutError' || 
          err.message.includes('Failed to fetch') ||
          err.message.includes('NetworkError')
        ));

      setStatus({
        ok: false,
        level: isOffline ? 'offline' : 'error',
        reasons: [isOffline ? 'Cannot reach server' : (err instanceof Error ? err.message : 'Unknown error')],
      });
      setError(err instanceof Error ? err.message : 'Failed to fetch status');
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    let timeoutId: NodeJS.Timeout;
    let isMounted = true;

    const scheduleFetch = async () => {
      if (isMounted) {
        await fetchStatus();
        timeoutId = setTimeout(scheduleFetch, POLL_INTERVAL);
      }
    };

    scheduleFetch();

    // Listen for online/offline events
    const handleOnline = () => {
      if (isMounted) fetchStatus();
    };

    window.addEventListener('online', handleOnline);

    return () => {
      isMounted = false;
      clearTimeout(timeoutId);
      window.removeEventListener('online', handleOnline);
    };
  }, [fetchStatus]);

  return { status, isLoading, error, refetch: fetchStatus };
}

/**
 * Get the display text for a status level
 */
export function getStatusDisplayText(level: StatusLevel): string {
  switch (level) {
    case 'healthy':
      return 'ONLINE';
    case 'setup_required':
      return 'SETUP';
    case 'degraded':
      return 'DEGRADED';
    case 'error':
      return 'ERROR';
    case 'offline':
      return 'OFFLINE';
    case 'loading':
      return 'LOADING';
    default:
      return 'UNKNOWN';
  }
}

/**
 * Get the color class for a status level
 */
export function getStatusColor(level: StatusLevel): string {
  switch (level) {
    case 'healthy':
      return 'rgba(var(--jarvis-accent), 0.8)'; // Green/cyan accent
    case 'setup_required':
    case 'degraded':
      return 'rgba(251, 191, 36, 0.8)'; // Amber/yellow
    case 'error':
    case 'offline':
      return 'rgba(239, 68, 68, 0.8)'; // Red
    case 'loading':
      return 'rgba(156, 163, 175, 0.8)'; // Gray
    default:
      return 'rgba(156, 163, 175, 0.8)';
  }
}
