'use client';

import { useEffect, useState } from 'react';
import { useSystemMetrics } from '@/hooks/useSystemMetrics';
import { useWeather } from '@/hooks/useWeather';

// Map OpenWeather icon codes to simple emoji
function getWeatherEmoji(iconCode: string): string {
  const code = iconCode.substring(0, 2);
  const emojiMap: Record<string, string> = {
    '01': '☀️', // clear sky
    '02': '⛅', // few clouds
    '03': '☁️', // scattered clouds
    '04': '☁️', // broken clouds
    '09': '🌧️', // shower rain
    '10': '🌦️', // rain
    '11': '⛈️', // thunderstorm
    '13': '❄️', // snow
    '50': '🌫️'  // mist
  };
  return emojiMap[code] || '🌤️';
}

export function HudWidget() {
  const [systemTime, setSystemTime] = useState(new Date());
  const [isCollapsed, setIsCollapsed] = useState(false);
  const { metrics, isLoading, error, isOnline } = useSystemMetrics();
  const { data: weather, integrationDisabled: weatherDisabled } = useWeather();

  // Update time every second
  useEffect(() => {
    const timer = setInterval(() => {
      setSystemTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Load collapsed state from localStorage
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem('jarvis-hud-collapsed');
      if (stored !== null) {
        setIsCollapsed(stored === 'true');
      }
    } catch {
      // ignore
    }
  }, []);

  // Save collapsed state to localStorage
  const toggleCollapsed = () => {
    const newState = !isCollapsed;
    setIsCollapsed(newState);
    try {
      window.localStorage.setItem('jarvis-hud-collapsed', String(newState));
    } catch {
      // ignore
    }
  };

  const formattedTime = systemTime.toLocaleTimeString('en-US', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });

  const formattedDate = systemTime.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric'
  });

  // Determine connection status
  const connectionStatus = !isOnline ? 'OFFLINE' : error ? 'ERROR' : 'SYNCED';
  const statusColor = !isOnline || error ? 'rgba(239, 68, 68, 0.8)' : `rgba(var(--jarvis-accent), 0.8)`; // red-500 for offline/error

  // Get metrics values with fallback
  const cpuLoad = metrics?.cpuLoad ?? 0;
  const memoryUsedPct = metrics?.memoryUsedPct ?? 0;
  const memoryUsedGB = metrics?.memoryUsedGB ?? 0;

  return (
    <div className="fixed right-6 top-6 z-[70] pointer-events-auto">
      <div className="flex items-start gap-2">
        {/* Collapse/Expand Tab */}
        <button
          onClick={toggleCollapsed}
          className="flex items-center justify-center w-6 h-16 bg-white/5 border border-white/10 rounded-l-lg hover:bg-white/10 transition-colors"
          style={{ opacity: 0.6 }}
          title={isCollapsed ? 'Expand HUD' : 'Collapse HUD'}
        >
          <svg
            className={`w-4 h-4 text-white/60 transition-transform ${isCollapsed ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>

        {/* HUD Panel */}
        <div
          className={`transition-all duration-300 ${
            isCollapsed ? 'w-0 opacity-0' : 'w-48 opacity-100'
          } overflow-hidden`}
        >
          <div className="bg-[rgba(var(--jarvis-panel-surface),0.3)] backdrop-blur-md border border-[rgba(var(--jarvis-accent),0.2)] rounded-lg p-4 shadow-lg">
            {/* Date & Status */}
            <div className="flex justify-between items-center mb-3">
              <div 
                className="text-sm"
                style={{ color: `rgba(var(--jarvis-accent), 0.8)` }}
              >
                {formattedDate}
              </div>
              <div className="flex items-center">
                <div 
                  className={`w-1.5 h-1.5 rounded-full mr-1.5 ${connectionStatus === 'SYNCED' ? 'animate-pulse' : ''}`}
                  style={{ backgroundColor: statusColor }}
                ></div>
                <div 
                  className="text-xs"
                  style={{ color: statusColor.replace('0.8', '0.6') }}
                >
                  {connectionStatus}
                </div>
              </div>
            </div>

            {/* Time Display */}
            <div className="text-3xl text-white tracking-wide text-center mb-1" suppressHydrationWarning>
              {formattedTime.split(':').slice(0, 2).join(':')}
              <span 
                className="text-base ml-1"
                style={{ color: `rgba(var(--jarvis-accent), 0.6)` }}
                suppressHydrationWarning
              >
                {formattedTime.split(':')[2]}
              </span>
            </div>

            {/* Divider */}
            <div 
              className="h-px w-full my-3"
              style={{ backgroundColor: `rgba(var(--jarvis-accent), 0.1)` }}
            ></div>

            {/* System Metrics */}
            <div className="space-y-3">
              {/* CPU Load */}
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span style={{ color: `rgba(var(--jarvis-accent), 0.6)` }}>CPU LOAD</span>
                  <span style={{ color: `rgba(var(--jarvis-accent), 0.9)` }}>
                    {isLoading ? '–' : `${Math.round(cpuLoad)}%`}
                  </span>
                </div>
                <div 
                  className="h-1.5 w-full rounded-full overflow-hidden"
                  style={{ backgroundColor: `rgba(var(--jarvis-accent), 0.1)` }}
                >
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${cpuLoad}%`,
                      backgroundColor: `rgba(var(--jarvis-accent), 0.5)`
                    }}
                  ></div>
                </div>
              </div>

              {/* Memory */}
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span style={{ color: `rgba(var(--jarvis-accent), 0.6)` }}>MEMORY</span>
                  <span style={{ color: `rgba(var(--jarvis-accent), 0.9)` }}>
                    {isLoading ? '–' : `${memoryUsedGB.toFixed(1)}GB`}
                  </span>
                </div>
                <div 
                  className="h-1.5 w-full rounded-full overflow-hidden"
                  style={{ backgroundColor: `rgba(var(--jarvis-accent), 0.1)` }}
                >
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${memoryUsedPct}%`,
                      backgroundColor: `rgba(var(--jarvis-accent-muted), 0.5)`
                    }}
                  ></div>
                </div>
              </div>

              {/* Connection Status */}
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span style={{ color: `rgba(var(--jarvis-accent), 0.6)` }}>STATUS</span>
                  <span style={{ color: `rgba(var(--jarvis-accent), 0.9)` }}>
                    {isOnline ? 'ONLINE' : 'OFFLINE'}
                  </span>
                </div>
                <div 
                  className="h-1.5 w-full rounded-full overflow-hidden"
                  style={{ backgroundColor: `rgba(var(--jarvis-accent), 0.1)` }}
                >
                  <div
                    className="h-full rounded-full transition-all duration-300"
                    style={{
                      width: isOnline ? '100%' : '0%',
                      backgroundColor: `rgba(var(--jarvis-glow), 0.5)`
                    }}
                  ></div>
                </div>
              </div>
            </div>

            {/* Weather */}
            {weather && !weatherDisabled && (
              <>
                <div 
                  className="h-px w-full my-3"
                  style={{ backgroundColor: `rgba(var(--jarvis-accent), 0.1)` }}
                ></div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">{getWeatherEmoji(weather.iconCode)}</span>
                    <div>
                      <div 
                        className="text-xs"
                        style={{ color: `rgba(var(--jarvis-accent), 0.6)` }}
                      >
                        {weather.location.split(',')[0]}
                      </div>
                      <div className="text-sm text-white">
                        {weather.temperatureC}°C
                      </div>
                    </div>
                  </div>
                  <div 
                    className="text-xs capitalize"
                    style={{ color: `rgba(var(--jarvis-accent), 0.7)` }}
                  >
                    {weather.condition}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
