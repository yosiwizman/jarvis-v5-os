"use client";

import React, { useEffect, useState } from "react";

type Channel = {
  id: string;
  name: string;
  icon: string;
  connected: boolean;
  lastActive: string;
};

const CHANNELS: Channel[] = [
  {
    id: "whatsapp",
    name: "WhatsApp",
    icon: "\uD83D\uDCAC",
    connected: false,
    lastActive: "Never",
  },
  {
    id: "imessage",
    name: "iMessage",
    icon: "\uD83D\uDCF1",
    connected: false,
    lastActive: "Never",
  },
];

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

function GoogleConnectCard() {
  const [status, setStatus] = useState<{
    connected: boolean;
    email?: string;
  } | null>(null);

  useEffect(() => {
    fetch("/api/auth/google/status")
      .then((r) => r.json())
      .then(setStatus)
      .catch(() => setStatus({ connected: false }));
  }, []);

  return (
    <div className="card p-5 space-y-4 border border-white/10 rounded-lg bg-white/5">
      {/* Header */}
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
        <StatusBadge connected={status?.connected ?? false} />
      </div>

      {/* Details */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
        <div className="text-white/40">Status:</div>
        <div className={status?.connected ? "text-green-300" : "text-red-300"}>
          {status?.connected ? "Connected" : "Disconnected"}
        </div>
        <div className="text-white/40">Account:</div>
        <div className="text-white/70">
          {status?.connected ? status.email || "Connected" : "None"}
        </div>
        <div className="text-white/40">Scopes:</div>
        <div className="text-white/70">Gmail, Calendar, Drive, Contacts</div>
      </div>

      {/* Connect Button */}
      {status?.connected ? (
        <div className="w-full px-4 py-2 text-sm rounded border border-green-500/30 bg-green-500/10 text-green-300 text-center">
          Google Connected
        </div>
      ) : (
        <a
          href="/api/auth/google/start"
          data-testid="connect-google-button"
          className="block w-full px-4 py-2 text-sm rounded border border-blue-500/40 bg-blue-600/20 text-blue-300 hover:bg-blue-600/30 hover:text-white transition-colors text-center cursor-pointer"
        >
          Connect Google
        </a>
      )}
    </div>
  );
}

export default function ChannelsPage() {
  return (
    <div className="space-y-6" data-testid="channels-page">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Channels</h1>
      </div>

      {/* Channel Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Google OAuth Card */}
        <GoogleConnectCard />

        {CHANNELS.map((channel) => (
          <div
            key={channel.id}
            className="card p-5 space-y-4 border border-white/10 rounded-lg bg-white/5"
          >
            {/* Channel Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-2xl">{channel.icon}</span>
                <h3 className="text-lg font-semibold text-white">
                  {channel.name}
                </h3>
              </div>
              <StatusBadge connected={channel.connected} />
            </div>

            {/* Details */}
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
              <div className="text-white/40">Status:</div>
              <div className="text-red-300">Disconnected</div>
              <div className="text-white/40">Last Active:</div>
              <div className="text-white/70">{channel.lastActive}</div>
            </div>

            {/* Connect Button */}
            <button
              type="button"
              disabled
              className="w-full px-4 py-2 text-sm rounded border border-white/20 bg-white/5 text-white/40 cursor-not-allowed"
            >
              Connect
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
