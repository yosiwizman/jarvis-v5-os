'use client';

import { useEffect, useState } from 'react';

interface BuildData {
  gitSha: string;
  buildTime: string;
}

/**
 * Displays build information (git SHA and build time) fetched from /api/health.
 * Useful for verifying which version is deployed.
 */
export function BuildInfo() {
  const [build, setBuild] = useState<BuildData | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetch('/api/health')
      .then(res => res.json())
      .then(data => {
        if (data.build) {
          setBuild(data.build);
        }
      })
      .catch(() => setError(true));
  }, []);

  if (error || !build) {
    return null;
  }

  // Format build time nicely if it's a valid date
  let formattedTime = build.buildTime;
  if (build.buildTime && build.buildTime !== 'unknown') {
    try {
      const date = new Date(build.buildTime);
      formattedTime = date.toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      // Keep original if parsing fails
    }
  }

  return (
    <div className="text-xs text-white/30 font-mono">
      Build: {build.gitSha !== 'unknown' ? build.gitSha : '—'} 
      {formattedTime !== 'unknown' && ` • ${formattedTime}`}
    </div>
  );
}
