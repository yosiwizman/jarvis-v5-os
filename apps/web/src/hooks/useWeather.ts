import { useEffect, useState } from 'react';
import { buildServerUrl } from '@/lib/api';
import { readSettings } from '@shared/settings';
import type { WeatherResponse } from '@/types/weather';

interface UseWeatherResult {
  data: WeatherResponse | null;
  isLoading: boolean;
  error: string | null;
  integrationDisabled: boolean;
}

const REFRESH_INTERVAL = 10 * 60 * 1000; // Refresh every 10 minutes

export function useWeather(): UseWeatherResult {
  const [data, setData] = useState<WeatherResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [integrationDisabled, setIntegrationDisabled] = useState(false);

  useEffect(() => {
    let isMounted = true;
    let timeoutId: NodeJS.Timeout;

    const fetchWeather = async () => {
      // Check if weather integration is enabled
      const settings = readSettings();
      const weatherSettings = settings.integrations.weather;

      if (!weatherSettings?.enabled) {
        if (isMounted) {
          setIntegrationDisabled(true);
          setIsLoading(false);
          setData(null);
          setError(null);
        }
        return;
      }

      if (isMounted) {
        setIntegrationDisabled(false);
        setIsLoading(true);
      }

      try {
        const location = weatherSettings.defaultLocation || 'Miami,US';
        const url = buildServerUrl(`/api/integrations/weather?location=${encodeURIComponent(location)}`);
        
        const response = await fetch(url, {
          signal: AbortSignal.timeout(8000) // 8 second timeout
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
          throw new Error(errorData.error || `HTTP ${response.status}`);
        }

        const weatherData = await response.json() as WeatherResponse;

        if (isMounted) {
          setData(weatherData);
          setError(null);
          setIsLoading(false);
        }
      } catch (err) {
        if (isMounted) {
          const message = err instanceof Error ? err.message : 'Failed to fetch weather';
          setError(message);
          setIsLoading(false);
        }
      }
    };

    const scheduleFetch = () => {
      fetchWeather();
      timeoutId = setTimeout(scheduleFetch, REFRESH_INTERVAL);
    };

    scheduleFetch();

    return () => {
      isMounted = false;
      clearTimeout(timeoutId);
    };
  }, []);

  return { data, isLoading, error, integrationDisabled };
}
