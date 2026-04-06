"use client";

import React, { useState, useEffect } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3002";

export default function DndToggle() {
  const [enabled, setEnabled] = useState(false);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API_BASE}/api/dnd`)
      .then((r) => r.json())
      .then((data) => {
        setEnabled(data.enabled ?? false);
        setMessage(data.message ?? "");
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const toggle = async () => {
    const next = !enabled;
    setEnabled(next);
    try {
      const res = await fetch(`${API_BASE}/api/dnd`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: next }),
      });
      const data = await res.json();
      setEnabled(data.enabled ?? next);
      if (data.message) setMessage(data.message);
    } catch {
      setEnabled(!next); // revert on failure
    }
  };

  if (loading) {
    return (
      <div className="space-y-4" data-testid="dnd-toggle">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <h2 className="text-lg font-semibold text-white">Do Not Disturb</h2>
            <p className="text-sm text-white/40">Loading...</p>
          </div>
          <div className="relative inline-flex h-8 w-14 items-center rounded-full bg-white/10 animate-pulse" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4" data-testid="dnd-toggle">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold text-white">Do Not Disturb</h2>
          {enabled ? (
            <p className="text-sm text-red-400">
              DND Active &mdash; Auto-replies enabled
            </p>
          ) : (
            <p className="text-sm text-green-400">Available</p>
          )}
        </div>

        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          onClick={toggle}
          className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors ${
            enabled ? "bg-red-500" : "bg-white/20"
          }`}
        >
          <span
            className={`inline-block h-6 w-6 transform rounded-full bg-white transition-transform ${
              enabled ? "translate-x-7" : "translate-x-1"
            }`}
          />
        </button>
      </div>
    </div>
  );
}
