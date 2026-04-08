"use client";

import React, { useEffect, useState, useCallback, useRef } from "react";

function StatusBadge({ connected }: { connected: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 text-xs px-2 py-0.5 rounded-full border ${
        connected
          ? "bg-green-500/20 text-green-300 border-green-500/40"
          : "bg-red-500/20 text-red-300 border-red-500/40"
      }`}
    >
      <span
        className={`inline-block h-2 w-2 rounded-full ${
          connected ? "bg-green-400" : "bg-red-400"
        }`}
      />
      {connected ? "Connected" : "Not Connected"}
    </span>
  );
}

// ── Google Gmail Card (DEC-031 browser-session lane) ──

function GoogleConnectCard() {
  const [status, setStatus] = useState<{
    running: boolean;
    gmailOpen: boolean;
    title: string | null;
  } | null>(null);
  const [connecting, setConnecting] = useState(false);

  const checkStatus = () => {
    fetch("/api/browser/gmail/status")
      .then((r) => r.json())
      .then(setStatus)
      .catch(() => setStatus({ running: false, gmailOpen: false, title: null }));
  };

  useEffect(() => {
    checkStatus();
    const interval = setInterval(checkStatus, 10000);
    return () => clearInterval(interval);
  }, []);

  const handleConnect = async () => {
    setConnecting(true);
    try {
      await fetch("/api/browser/gmail/connect", { method: "POST" });
      setTimeout(checkStatus, 3000);
    } catch {}
    setConnecting(false);
  };

  const isConnected = status?.gmailOpen && status?.title && !status.title.includes("Sign in");

  return (
    <div className="card p-5 space-y-4 border border-white/10 rounded-lg bg-white/5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-2xl">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18A10.96 10.96 0 001 12c0 1.77.42 3.44 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
          </span>
          <h3 className="text-lg font-semibold text-white">Google</h3>
        </div>
        <StatusBadge connected={Boolean(isConnected)} />
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
        <div className="text-white/40">Status:</div>
        <div className={isConnected ? "text-green-300" : status?.running ? "text-yellow-300" : "text-red-300"}>
          {isConnected ? "Gmail Active" : status?.gmailOpen ? "Sign in needed" : status?.running ? "Browser ready" : "Not connected"}
        </div>
        <div className="text-white/40">Method:</div>
        <div className="text-white/70">Browser session (no API keys needed)</div>
      </div>
      {isConnected ? (
        <div className="w-full px-4 py-2 text-sm rounded border border-green-500/30 bg-green-500/10 text-green-300 text-center">
          Gmail Connected — {status?.title?.slice(0, 40)}
        </div>
      ) : (
        <button
          onClick={handleConnect}
          disabled={connecting}
          data-testid="connect-google-button"
          className="block w-full px-4 py-2 text-sm rounded border border-blue-500/40 bg-blue-600/20 text-blue-300 hover:bg-blue-600/30 hover:text-white transition-colors text-center cursor-pointer disabled:opacity-50"
        >
          {connecting ? "Opening Gmail..." : "Connect Google"}
        </button>
      )}
    </div>
  );
}

// ── WhatsApp Card (DEC-032 direct-import lane) ──

type WaStatus = {
  state: "idle" | "awaiting_scan" | "linked" | "timed_out" | "cancelled";
  qrDataUrl?: string | null;
  message?: string | null;
  startedAt?: number | null;
};

function WhatsAppConnectCard() {
  const [status, setStatus] = useState<WaStatus>({ state: "idle" });
  const [connecting, setConnecting] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const checkStatus = useCallback(() => {
    fetch("/api/channels/whatsapp/status")
      .then((r) => r.json())
      .then((data: WaStatus) => {
        setStatus(data);
        // Stop polling on terminal states
        if (data.state !== "awaiting_scan" && pollRef.current) {
          clearInterval(pollRef.current);
          pollRef.current = null;
        }
      })
      .catch(() => {});
  }, []);

  // On mount: check initial state
  useEffect(() => {
    checkStatus();
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [checkStatus]);

  const startPolling = () => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(checkStatus, 2000);
  };

  const handleConnect = async () => {
    setConnecting(true);
    try {
      const res = await fetch("/api/channels/whatsapp/connect", { method: "POST" });
      const data: WaStatus = await res.json();
      setStatus(data);
      if (data.state === "awaiting_scan") {
        startPolling();
      }
    } catch {}
    setConnecting(false);
  };

  const handleCancel = async () => {
    try {
      await fetch("/api/channels/whatsapp/cancel", { method: "POST" });
    } catch {}
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    setStatus({ state: "cancelled", message: "Cancelled." });
  };

  const isLinked = status.state === "linked";

  return (
    <div className="card p-5 space-y-4 border border-white/10 rounded-lg bg-white/5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-2xl">💬</span>
          <h3 className="text-lg font-semibold text-white">WhatsApp</h3>
        </div>
        <StatusBadge connected={isLinked} />
      </div>

      {/* Details */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
        <div className="text-white/40">Status:</div>
        <div className={
          isLinked ? "text-green-300"
          : status.state === "awaiting_scan" ? "text-yellow-300"
          : status.state === "timed_out" ? "text-orange-300"
          : "text-red-300"
        }>
          {isLinked ? "WhatsApp Active"
            : status.state === "awaiting_scan" ? "Waiting for scan..."
            : status.state === "timed_out" ? "Scan timed out"
            : status.state === "cancelled" ? "Cancelled"
            : "Not connected"}
        </div>
        <div className="text-white/40">Method:</div>
        <div className="text-white/70">QR code scan (no API keys needed)</div>
      </div>

      {/* QR Display (awaiting_scan) */}
      {status.state === "awaiting_scan" && status.qrDataUrl && (
        <div className="space-y-3">
          <div className="flex justify-center p-4 bg-white rounded-lg">
            <img
              src={status.qrDataUrl}
              alt="WhatsApp QR code"
              className="w-48 h-48"
            />
          </div>
          <p className="text-xs text-white/60 text-center">
            Open WhatsApp on your phone → Settings → Linked Devices → Link a Device → scan this code
          </p>
          <button
            onClick={handleCancel}
            className="w-full px-4 py-2 text-sm rounded border border-white/20 bg-white/5 text-white/60 hover:bg-white/10 hover:text-white transition-colors text-center cursor-pointer"
          >
            Cancel
          </button>
        </div>
      )}

      {/* Connected state */}
      {isLinked && (
        <div className="w-full px-4 py-2 text-sm rounded border border-green-500/30 bg-green-500/10 text-green-300 text-center">
          WhatsApp Connected
        </div>
      )}

      {/* Timed out state */}
      {status.state === "timed_out" && (
        <div className="space-y-2">
          <div className="w-full px-3 py-2 text-xs rounded border border-orange-500/30 bg-orange-500/10 text-orange-300 text-center">
            {status.message || "QR scan timed out."}
          </div>
          <button
            onClick={handleConnect}
            disabled={connecting}
            className="block w-full px-4 py-2 text-sm rounded border border-blue-500/40 bg-blue-600/20 text-blue-300 hover:bg-blue-600/30 hover:text-white transition-colors text-center cursor-pointer disabled:opacity-50"
          >
            Try Again
          </button>
        </div>
      )}

      {/* Idle / Cancelled — show Connect button */}
      {(status.state === "idle" || status.state === "cancelled") && (
        <button
          onClick={handleConnect}
          disabled={connecting}
          data-testid="connect-whatsapp-button"
          className="block w-full px-4 py-2 text-sm rounded border border-blue-500/40 bg-blue-600/20 text-blue-300 hover:bg-blue-600/30 hover:text-white transition-colors text-center cursor-pointer disabled:opacity-50"
        >
          {connecting ? "Generating QR..." : "Connect WhatsApp"}
        </button>
      )}
    </div>
  );
}

// ── iMessage Card (placeholder) ──

function IMessageCard() {
  return (
    <div className="card p-5 space-y-4 border border-white/10 rounded-lg bg-white/5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-2xl">📱</span>
          <h3 className="text-lg font-semibold text-white">iMessage</h3>
        </div>
        <StatusBadge connected={false} />
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
        <div className="text-white/40">Status:</div>
        <div className="text-red-300">Disconnected</div>
        <div className="text-white/40">Last Active:</div>
        <div className="text-white/70">Never</div>
      </div>
      <button
        type="button"
        disabled
        className="w-full px-4 py-2 text-sm rounded border border-white/20 bg-white/5 text-white/40 cursor-not-allowed"
      >
        Connect
      </button>
    </div>
  );
}

// ── Page Layout ──

export default function ChannelsPage() {
  return (
    <div className="space-y-6" data-testid="channels-page">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Channels</h1>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <GoogleConnectCard />
        <WhatsAppConnectCard />
        <IMessageCard />
      </div>
    </div>
  );
}
