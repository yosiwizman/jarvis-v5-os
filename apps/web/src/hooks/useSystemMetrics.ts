import { useEffect, useState } from 'react';
import { buildServerUrl } from '@/lib/api';
import type { SystemMetrics } from '@/types/metrics';

interface UseSystemMetricsResult {
  metrics: SystemMetrics | null;
  isLoading: boolean;
  error: string | null;
  isOnline: boolean;
}

const POLL_INTERVAL = 15_000; // Poll every 15 seconds

export function useSystemMetrics(): UseSystemMetricsResult {
  const [metrics, setMetrics] = useState<SystemMetrics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    // Track online/offline status
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    setIsOnline(navigator.onLine);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    let isMounted = true;
    let timeoutId: NodeJS.Timeout;

    const fetchMetrics = async () => {
      try {
        const response = await fetch(buildServerUrl('/api/system/metrics'), {
          signal: AbortSignal.timeout(5000) // 5 second timeout
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json() as SystemMetrics;
        
        if (isMounted) {
          setMetrics(data);
          setError(null);
          setIsLoading(false);
        }
      } catch (err) {
        if (isMounted) {
          setError(err instanceof Error ? err.message : 'Failed to fetch metrics');
          setIsLoading(false);
        }
      }
    };

    const scheduleFetch = () => {
      fetchMetrics();
      timeoutId = setTimeout(scheduleFetch, POLL_INTERVAL);
    };

    scheduleFetch();

    return () => {
      isMounted = false;
      clearTimeout(timeoutId);
    };
  }, []);

  return { metrics, isLoading, error, isOnline };
}
