"use client";

import React from "react";

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

export default function ChannelsPage() {
  return (
    <div className="space-y-6" data-testid="channels-page">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Channels</h1>
      </div>

      {/* Channel Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
