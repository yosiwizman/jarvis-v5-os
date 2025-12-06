'use client';

import React, { useEffect, useState } from 'react';

interface WifiConfig {
  ssid: string;
  password: string;
}

export function CameraSettings() {
  const [permission, setPermission] = useState<'unknown' | 'granted' | 'denied'>('unknown');
  const [wifi, setWifi] = useState<WifiConfig>({ ssid: '', password: '' });
  const [connecting, setConnecting] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    // Check camera permission on mount
    navigator.mediaDevices
      .getUserMedia({ video: true })
      .then((stream) => {
        setPermission('granted');
        stream.getTracks().forEach((t) => t.stop());
      })
      .catch(() => setPermission('denied'));
  }, []);

  const requestPermission = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      setPermission('granted');
      stream.getTracks().forEach((t) => t.stop());
    } catch {
      setPermission('denied');
    }
  };

  const handleConnectWifi = async () => {
    // Placeholder: Will be implemented when Wi-Fi configuration backend is ready
    setConnecting(true);
    setStatus(null);

    // Simulate network request
    setTimeout(() => {
      setConnecting(false);
      setStatus('Wi-Fi configuration is not yet implemented. This is a placeholder for future device setup.');
    }, 1000);
  };

  return (
    <div className="card p-4 space-y-4">
      <div>
        <div className="text-sm font-semibold">Camera Permissions</div>
        <div className="text-xs text-white/60">Grant access to use this device as a Wi‑Fi camera.</div>
        <div className="mt-3 flex items-center gap-3">
          <span className={`px-2 py-1 text-xs rounded-full ${permission === 'granted' ? 'bg-green-500/20 text-green-200' : permission === 'denied' ? 'bg-red-500/20 text-red-200' : 'bg-white/10 text-white/70'}`}>
            {permission === 'granted' ? 'Granted' : permission === 'denied' ? 'Denied' : 'Unknown'}
          </span>
          {permission !== 'granted' && (
            <button className="btn px-3 py-1 text-xs" onClick={requestPermission}>Request Permission</button>
          )}
        </div>
      </div>

      <div className="border-t border-white/10 pt-4">
        <div className="text-sm font-semibold">Wi‑Fi Connection (placeholder)</div>
        <div className="text-xs text-white/60">Configure camera devices to connect to your network.</div>

        <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <input
            className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/60"
            placeholder="SSID"
            value={wifi.ssid}
            onChange={(e) => setWifi((prev) => ({ ...prev, ssid: e.target.value }))}
          />
          <input
            className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/60"
            placeholder="Password"
            type="password"
            value={wifi.password}
            onChange={(e) => setWifi((prev) => ({ ...prev, password: e.target.value }))}
          />
        </div>
        <div className="mt-3">
          <button className="btn" onClick={handleConnectWifi} disabled={!wifi.ssid || connecting}>
            {connecting ? 'Sending…' : 'Send to Camera'}
          </button>
          {status && <div className="mt-2 text-xs text-white/70">{status}</div>}
        </div>
      </div>
    </div>
  );
}
