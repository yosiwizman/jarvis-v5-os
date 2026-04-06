"use client";

import React, { useState } from "react";

export default function DndToggle() {
  const [enabled, setEnabled] = useState(false);

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
          onClick={() => setEnabled(!enabled)}
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
