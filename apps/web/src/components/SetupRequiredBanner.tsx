"use client";

import Link from "next/link";
import { useSetupStatus } from "@/hooks/useSetupStatus";

/**
 * SetupRequiredBanner
 *
 * Displays a prominent banner when system setup is incomplete.
 * Used on pages that require setup to function properly (e.g., AKIOR, Menu).
 *
 * Shows specific guidance about what's missing:
 * - PIN not configured: First-run setup needed
 * - LLM not configured: API key or local LLM setup needed
 */
export function SetupRequiredBanner() {
  const { setupRequired, pinConfigured, llmConfigured, loading } =
    useSetupStatus();

  // Don't show while loading or if setup is complete
  if (loading || (!setupRequired && llmConfigured)) {
    return null;
  }

  // Determine what's missing
  const missingItems: string[] = [];
  if (!pinConfigured) {
    missingItems.push("Owner PIN");
  }
  if (!llmConfigured) {
    missingItems.push("LLM Provider (OpenAI or local)");
  }

  return (
    <div className="w-full max-w-2xl mx-auto p-6">
      <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-6 text-center space-y-4">
        {/* Icon */}
        <div className="flex justify-center">
          <svg
            className="w-10 h-10 text-amber-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
        </div>

        {/* Title */}
        <h2 className="text-xl font-semibold text-amber-300">Setup Required</h2>

        {/* Description */}
        <p className="text-white/70">
          {!pinConfigured
            ? "Welcome! Complete the setup wizard to configure your system."
            : "Additional configuration is needed before this feature can be used."}
        </p>

        {/* Missing items */}
        {missingItems.length > 0 && (
          <div className="text-sm text-white/50">
            <span className="font-medium">Missing:</span>{" "}
            {missingItems.join(", ")}
          </div>
        )}

        {/* CTA Button */}
        <Link
          href="/setup"
          className="inline-flex items-center gap-2 px-6 py-3 bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/50 rounded-xl text-cyan-400 font-medium transition-all hover:shadow-[0_0_20px_rgba(34,211,238,0.3)]"
        >
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
            />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
            />
          </svg>
          Go to Setup Wizard
        </Link>

        {/* Help text */}
        <p className="text-xs text-white/40">
          This page requires system configuration to function properly.
        </p>
      </div>
    </div>
  );
}
