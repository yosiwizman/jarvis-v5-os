"use client";

import React, { useState, useEffect, useCallback } from "react";
import { SubpageHeader } from "../channels/shared";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type BriefingState =
  | "safe_to_do_automatically"
  | "needs_approval"
  | "needs_clarification"
  | "blocked";

type ApprovalStatus = "pending" | "approved" | "rejected" | "not_required";

interface Briefing {
  id: string;
  rawText: string;
  state: BriefingState;
  stateReason: string;
  approvalRequired: boolean;
  approvalStatus: ApprovalStatus;
  createdAt: string;
}

interface ClassifyResult extends Briefing {
  // returned from POST /api/assistant/briefings
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function stateBadge(state: BriefingState): React.ReactNode {
  const map: Record<BriefingState, string> = {
    safe_to_do_automatically: "bg-green-500/20 text-green-300 border border-green-500/30",
    needs_approval: "bg-amber-500/20 text-amber-300 border border-amber-500/30",
    needs_clarification: "bg-blue-500/20 text-blue-300 border border-blue-500/30",
    blocked: "bg-red-500/20 text-red-300 border border-red-500/30",
  };
  return (
    <span className={`text-xs px-2 py-0.5 rounded font-mono ${map[state]}`}>
      {state}
    </span>
  );
}

function approvalBadge(status: ApprovalStatus): React.ReactNode {
  const map: Record<ApprovalStatus, string> = {
    pending: "bg-amber-500/20 text-amber-300 border border-amber-500/30",
    approved: "bg-green-500/20 text-green-300 border border-green-500/30",
    rejected: "bg-red-500/20 text-red-300 border border-red-500/30",
    not_required: "bg-white/10 text-white/40 border border-white/10",
  };
  return (
    <span className={`text-xs px-2 py-0.5 rounded font-mono ${map[status]}`}>
      {status}
    </span>
  );
}

function truncate(text: string, max = 80): string {
  return text.length > max ? text.slice(0, max) + "…" : text;
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function AssistantBriefingSubpage() {
  const [inputText, setInputText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [lastResult, setLastResult] = useState<ClassifyResult | null>(null);
  const [briefings, setBriefings] = useState<Briefing[]>([]);
  const [approvals, setApprovals] = useState<Briefing[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [bRes, aRes] = await Promise.all([
        fetch("/api/assistant/briefings"),
        fetch("/api/assistant/approvals"),
      ]);
      if (!bRes.ok || !aRes.ok) {
        throw new Error(`Fetch failed: briefings=${bRes.status} approvals=${aRes.status}`);
      }
      const bJson = await bRes.json();
      const aJson = await aRes.json();
      setBriefings(bJson.briefings ?? []);
      setApprovals(aJson.approvals ?? []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;
    setSubmitting(true);
    setLastResult(null);
    try {
      const res = await fetch("/api/assistant/briefings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rawText: inputText }),
      });
      if (!res.ok) throw new Error(`Server error: ${res.status}`);
      const json = await res.json();
      setLastResult(json);
      setInputText("");
      await fetchData();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  };

  const handleApprove = async (id: string) => {
    try {
      const res = await fetch(`/api/assistant/approvals/${id}/approve`, { method: "POST" });
      if (!res.ok) throw new Error(`Approve failed: ${res.status}`);
      await fetchData();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const handleReject = async (id: string) => {
    try {
      const res = await fetch(`/api/assistant/approvals/${id}/reject`, { method: "POST" });
      if (!res.ok) throw new Error(`Reject failed: ${res.status}`);
      await fetchData();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <div className="space-y-6" data-testid="assistant-briefing-subpage">
      <SubpageHeader
        backHref="/settings"
        backLabel="Back to Settings"
        title="Assistant Inbox"
        description="Submit a plain-language briefing. AKIOR classifies it and waits for your approval before any external action."
      />

      {/* ------------------------------------------------------------------ */}
      {/* Briefing intake form                                                */}
      {/* ------------------------------------------------------------------ */}
      <section className="card p-6 border border-white/10 rounded-lg bg-white/5 space-y-4">
        <h2 className="text-sm font-semibold text-white/80 uppercase tracking-wide">
          New Briefing
        </h2>
        <form onSubmit={handleSubmit} className="space-y-3">
          <textarea
            data-testid="assistant-briefing-input"
            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/30 resize-none focus:outline-none focus:border-white/30 min-h-[80px]"
            placeholder="Describe what AKIOR should do (e.g. 'In two hours, check my email and summarize any urgent messages')"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            disabled={submitting}
          />
          <div className="flex items-center gap-3">
            <button
              type="submit"
              data-testid="assistant-briefing-submit"
              disabled={submitting || !inputText.trim()}
              className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-sm font-medium text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {submitting ? "Classifying…" : "Classify briefing"}
            </button>
            <button
              type="button"
              data-testid="assistant-refresh-btn"
              onClick={() => void fetchData()}
              disabled={loading}
              className="px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-sm text-white/60 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? "Refreshing…" : "Refresh"}
            </button>
          </div>
        </form>

        {/* Error banner */}
        {error && (
          <div className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded px-3 py-2">
            {error}
          </div>
        )}
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* Last classification result                                          */}
      {/* ------------------------------------------------------------------ */}
      {lastResult && (
        <section
          data-testid="assistant-briefing-result"
          className="card p-6 border border-white/10 rounded-lg bg-white/5 space-y-2"
        >
          <h2 className="text-sm font-semibold text-white/80 uppercase tracking-wide">
            Classification Result
          </h2>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="text-white/60 text-xs font-mono">{lastResult.id}</span>
            {stateBadge(lastResult.state)}
            <span className="text-white/50 text-xs">approvalRequired: {String(lastResult.approvalRequired)}</span>
          </div>
          {lastResult.stateReason && (
            <p className="text-xs text-white/50">{lastResult.stateReason}</p>
          )}
        </section>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Pending Approvals inbox                                             */}
      {/* ------------------------------------------------------------------ */}
      <section className="card p-6 border border-white/10 rounded-lg bg-white/5 space-y-4">
        <h2 className="text-sm font-semibold text-white/80 uppercase tracking-wide">
          Pending Approvals
        </h2>
        {approvals.length === 0 ? (
          <div
            data-testid="assistant-approvals-empty"
            className="text-sm text-white/40"
          >
            No pending approvals
          </div>
        ) : (
          <ul data-testid="assistant-approvals-list" className="space-y-3">
            {approvals.map((item) => (
              <li
                key={item.id}
                data-testid="assistant-approvals-row"
                data-briefing-id={item.id}
                className="flex flex-col gap-2 border border-white/10 rounded-lg p-3 bg-white/5"
              >
                <p className="text-sm text-white/80">{truncate(item.rawText)}</p>
                {item.stateReason && (
                  <p className="text-xs text-white/40">{item.stateReason}</p>
                )}
                <div className="flex gap-2">
                  {item.approvalStatus === "pending" && (
                    <button
                      data-testid="assistant-approve-btn"
                      onClick={() => void handleApprove(item.id)}
                      className="px-3 py-1 rounded bg-green-500/20 hover:bg-green-500/30 text-green-300 text-xs font-medium transition-colors"
                    >
                      Approve
                    </button>
                  )}
                  <button
                    data-testid="assistant-reject-btn"
                    onClick={() => void handleReject(item.id)}
                    className="px-3 py-1 rounded bg-red-500/20 hover:bg-red-500/30 text-red-300 text-xs font-medium transition-colors"
                  >
                    Reject
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* All Briefings                                                       */}
      {/* ------------------------------------------------------------------ */}
      <section className="card p-6 border border-white/10 rounded-lg bg-white/5 space-y-4">
        <h2 className="text-sm font-semibold text-white/80 uppercase tracking-wide">
          All Briefings
        </h2>
        {briefings.length === 0 ? (
          <div className="text-sm text-white/40">No briefings yet.</div>
        ) : (
          <ul data-testid="assistant-briefings-list" className="space-y-2">
            {briefings.map((item) => (
              <li
                key={item.id}
                data-testid="assistant-briefings-row"
                data-briefing-id={item.id}
                data-state={item.state}
                data-approval-status={item.approvalStatus}
                className="flex flex-col gap-1 border border-white/10 rounded-lg p-3 bg-white/5"
              >
                <p className="text-sm text-white/80">{truncate(item.rawText)}</p>
                <div className="flex flex-wrap items-center gap-2">
                  {stateBadge(item.state)}
                  {approvalBadge(item.approvalStatus)}
                  <span className="text-xs text-white/30">
                    {new Date(item.createdAt).toLocaleString()}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
