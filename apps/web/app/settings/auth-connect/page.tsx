"use client";

/**
 * Auth/Connect Surface — M-PS-7 AUTH-CONNECT PRODUCT SURFACE.
 *
 * Founder-facing surface that consumes the already-landed M-CP-4 auth/connect
 * orchestrator control-plane. Read + open + cancel orchestration records only.
 * No external provider connection is initiated from this page — that remains
 * with the existing channels wrapper.
 *
 * Reuses SubpageHeader + the same list/badge/card shape as the assistant and
 * admission-candidates subpages. Admin-guarded routes under /api/auth-connect/*.
 * No nav edits, no layout edits, no shared-shell edits, no backend edits.
 *
 * Endpoints consumed (only these five, all same-origin + session cookie):
 *   GET  /api/auth-connect/providers
 *   GET  /api/auth-connect/sessions
 *   POST /api/auth-connect/sessions
 *   GET  /api/auth-connect/sessions/:id          (detail, not yet triggered from UI)
 *   POST /api/auth-connect/sessions/:id/cancel
 */

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { SubpageHeader } from "../channels/shared";

// ---------------------------------------------------------------------------
// Types (mirror apps/server/src/storage/authConnectStore.ts and
//        apps/server/src/services/authConnectOrchestrator.ts)
// ---------------------------------------------------------------------------

type AuthConnectMethod = "browser_oauth" | "qr";

type AuthConnectState =
  | "pending"
  | "ready"
  | "blocked"
  | "unsupported"
  | "cancelled";

interface ProviderSummary {
  providerId: string;
  displayName: string;
  category: string;
  admissibleMethods: AuthConnectMethod[];
  admissible: boolean;
  reason: string;
}

interface AuthConnectSession {
  id: string;
  provider: string;
  method: AuthConnectMethod;
  state: AuthConnectState;
  stateReason: string;
  founderSafe: boolean;
  forbiddenReason: string | null;
  requestedBy: string;
  createdAt: string;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// Badges
// ---------------------------------------------------------------------------

function stateBadge(state: AuthConnectState): React.ReactNode {
  const map: Record<AuthConnectState, string> = {
    pending:
      "bg-amber-500/20 text-amber-300 border border-amber-500/30",
    ready:
      "bg-green-500/20 text-green-300 border border-green-500/30",
    blocked:
      "bg-red-500/20 text-red-300 border border-red-500/30",
    unsupported:
      "bg-white/10 text-white/40 border border-white/10",
    cancelled:
      "bg-white/10 text-white/50 border border-white/20",
  };
  return (
    <span
      data-testid="auth-connect-state-badge"
      data-state={state}
      className={`text-xs px-2 py-0.5 rounded font-mono ${map[state]}`}
    >
      {state}
    </span>
  );
}

function methodBadge(method: AuthConnectMethod): React.ReactNode {
  const map: Record<AuthConnectMethod, string> = {
    browser_oauth:
      "bg-blue-500/20 text-blue-300 border border-blue-500/30",
    qr: "bg-purple-500/20 text-purple-300 border border-purple-500/30",
  };
  return (
    <span
      data-testid="auth-connect-method-badge"
      data-method={method}
      className={`text-xs px-2 py-0.5 rounded font-mono ${map[method]}`}
    >
      {method}
    </span>
  );
}

function founderSafeBadge(founderSafe: boolean): React.ReactNode {
  return (
    <span
      data-testid="auth-connect-founder-safe-badge"
      data-founder-safe={founderSafe ? "true" : "false"}
      className={`text-xs px-2 py-0.5 rounded font-mono ${
        founderSafe
          ? "bg-green-500/10 text-green-300/80 border border-green-500/20"
          : "bg-red-500/20 text-red-300 border border-red-500/30"
      }`}
    >
      {founderSafe ? "founder-safe" : "founder-unsafe"}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function AuthConnectSubpage() {
  const [providers, setProviders] = useState<ProviderSummary[]>([]);
  const [sessions, setSessions] = useState<AuthConnectSession[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastBlocked, setLastBlocked] = useState<{
    forbiddenReason: string | null;
    session: AuthConnectSession | null;
  } | null>(null);

  const [selectedProvider, setSelectedProvider] = useState<string>("");
  const [selectedMethod, setSelectedMethod] = useState<AuthConnectMethod>(
    "browser_oauth",
  );

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [pRes, sRes] = await Promise.all([
        fetch("/api/auth-connect/providers"),
        fetch("/api/auth-connect/sessions"),
      ]);
      if (!pRes.ok || !sRes.ok) {
        throw new Error(
          `Fetch failed: providers=${pRes.status} sessions=${sRes.status}`,
        );
      }
      const pJson = await pRes.json();
      const sJson = await sRes.json();
      const providerList: ProviderSummary[] = pJson?.providers ?? [];
      setProviders(providerList);
      setSessions(sJson?.sessions ?? []);

      // Default the form to the first admissible provider on first load
      setSelectedProvider((prev) => {
        if (prev) return prev;
        const firstAdmissible = providerList.find(
          (p) => p.admissible && p.admissibleMethods.length > 0,
        );
        return firstAdmissible?.providerId ?? "";
      });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  // When the selected provider changes, snap `selectedMethod` to an admissible
  // option for that provider (if any).
  const currentProvider = useMemo(
    () => providers.find((p) => p.providerId === selectedProvider),
    [providers, selectedProvider],
  );

  useEffect(() => {
    if (!currentProvider) return;
    if (currentProvider.admissibleMethods.length === 0) return;
    if (!currentProvider.admissibleMethods.includes(selectedMethod)) {
      setSelectedMethod(currentProvider.admissibleMethods[0]);
    }
  }, [currentProvider, selectedMethod]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProvider) return;
    setSubmitting(true);
    setError(null);
    setLastBlocked(null);
    try {
      const res = await fetch("/api/auth-connect/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: selectedProvider,
          method: selectedMethod,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        // Founder-unsafe payload path returns 400 with `session` embedded —
        // surface it as a bounded rejection. For vanilla shape errors we fall
        // back to a generic error banner.
        if (json?.session) {
          setLastBlocked({
            forbiddenReason: json.forbiddenReason ?? null,
            session: json.session,
          });
        } else {
          setError(
            `Create failed: ${res.status} ${json?.error ?? "unknown error"}`,
          );
        }
      }
      await fetchData();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = async (id: string) => {
    setCancellingId(id);
    setError(null);
    try {
      const res = await fetch(
        `/api/auth-connect/sessions/${encodeURIComponent(id)}/cancel`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reason: "cancelled from auth-connect surface" }),
        },
      );
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(
          `Cancel failed: ${res.status} ${json?.error ?? "unknown error"}`,
        );
      }
      await fetchData();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setCancellingId(null);
    }
  };

  return (
    <div className="space-y-6" data-testid="auth-connect-subpage">
      <SubpageHeader
        backHref="/settings"
        backLabel="Back to Settings"
        title="Auth / Connect"
        description="Open a founder-safe connect orchestration for a provider (browser OAuth or QR only). AKIOR never asks for a clientId, clientSecret, API key, credential file, or developer-console step."
      />

      {/* ------------------------------------------------------------------ */}
      {/* Providers + create form                                             */}
      {/* ------------------------------------------------------------------ */}
      <section
        data-testid="auth-connect-create-section"
        className="card p-6 border border-white/10 rounded-lg bg-white/5 space-y-4"
      >
        <h2 className="text-sm font-semibold text-white/80 uppercase tracking-wide">
          New Connect Orchestration
        </h2>

        {providers.length === 0 ? (
          <div className="text-sm text-white/40">
            {loading ? "Loading providers…" : "No providers registered."}
          </div>
        ) : (
          <form onSubmit={handleCreate} className="space-y-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
              <label className="flex-1 flex flex-col gap-1">
                <span className="text-xs text-white/50 uppercase tracking-wide">
                  Provider
                </span>
                <select
                  data-testid="auth-connect-provider-select"
                  className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-white/30"
                  value={selectedProvider}
                  onChange={(e) => setSelectedProvider(e.target.value)}
                  disabled={submitting}
                >
                  {providers.map((p) => (
                    <option
                      key={p.providerId}
                      value={p.providerId}
                      disabled={!p.admissible}
                    >
                      {p.displayName} ({p.providerId})
                      {!p.admissible ? " — unsupported" : ""}
                    </option>
                  ))}
                </select>
              </label>
              <label className="sm:w-56 flex flex-col gap-1">
                <span className="text-xs text-white/50 uppercase tracking-wide">
                  Method
                </span>
                <select
                  data-testid="auth-connect-method-select"
                  className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-white/30 disabled:opacity-40"
                  value={selectedMethod}
                  onChange={(e) =>
                    setSelectedMethod(e.target.value as AuthConnectMethod)
                  }
                  disabled={
                    submitting ||
                    !currentProvider ||
                    currentProvider.admissibleMethods.length === 0
                  }
                >
                  {(currentProvider?.admissibleMethods ?? ([] as AuthConnectMethod[]))
                    .map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  {(!currentProvider ||
                    currentProvider.admissibleMethods.length === 0) && (
                    <option value="" disabled>
                      (no admissible method)
                    </option>
                  )}
                </select>
              </label>
              <button
                type="submit"
                data-testid="auth-connect-create-btn"
                disabled={
                  submitting ||
                  !currentProvider ||
                  !currentProvider.admissible ||
                  currentProvider.admissibleMethods.length === 0
                }
                className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-sm font-medium text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                {submitting ? "Opening…" : "Open orchestration"}
              </button>
              <button
                type="button"
                data-testid="auth-connect-refresh-btn"
                onClick={() => void fetchData()}
                disabled={loading}
                className="px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-sm text-white/60 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? "Refreshing…" : "Refresh"}
              </button>
            </div>
            {currentProvider && !currentProvider.admissible && (
              <p
                data-testid="auth-connect-provider-reason"
                className="text-xs text-white/50"
              >
                {currentProvider.reason}
              </p>
            )}
          </form>
        )}

        {error && (
          <div
            data-testid="auth-connect-error"
            className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded px-3 py-2"
          >
            {error}
          </div>
        )}

        {lastBlocked && (
          <div
            data-testid="auth-connect-blocked-result"
            className="text-xs text-red-300 bg-red-500/10 border border-red-500/20 rounded px-3 py-2 space-y-1"
          >
            <div className="font-semibold">Request blocked</div>
            {lastBlocked.forbiddenReason && (
              <div className="text-red-300/80">
                {lastBlocked.forbiddenReason}
              </div>
            )}
            {lastBlocked.session && (
              <div className="text-white/50 font-mono">
                {lastBlocked.session.id}
              </div>
            )}
          </div>
        )}
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* Providers list                                                      */}
      {/* ------------------------------------------------------------------ */}
      <section className="card p-6 border border-white/10 rounded-lg bg-white/5 space-y-3">
        <h2 className="text-sm font-semibold text-white/80 uppercase tracking-wide">
          Registered Providers
        </h2>
        {providers.length === 0 ? (
          <div className="text-sm text-white/40">
            {loading ? "Loading…" : "No providers registered."}
          </div>
        ) : (
          <ul data-testid="auth-connect-providers-list" className="space-y-2">
            {providers.map((p) => (
              <li
                key={p.providerId}
                data-testid="auth-connect-providers-row"
                data-provider-id={p.providerId}
                data-admissible={p.admissible ? "true" : "false"}
                className="flex flex-col gap-1 border border-white/10 rounded-lg p-3 bg-white/5"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm text-white/80 font-medium">
                    {p.displayName}
                  </span>
                  <span className="text-xs font-mono text-white/40">
                    {p.providerId}
                  </span>
                  <span className="text-xs font-mono text-white/40">
                    · {p.category}
                  </span>
                  {p.admissible ? (
                    p.admissibleMethods.map((m) => (
                      <React.Fragment key={m}>{methodBadge(m)}</React.Fragment>
                    ))
                  ) : (
                    <span
                      data-testid="auth-connect-provider-unsupported"
                      className="text-xs px-2 py-0.5 rounded font-mono bg-white/10 text-white/40 border border-white/10"
                    >
                      unsupported
                    </span>
                  )}
                </div>
                {p.reason && (
                  <p className="text-xs text-white/40">{p.reason}</p>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* Sessions list                                                       */}
      {/* ------------------------------------------------------------------ */}
      <section className="card p-6 border border-white/10 rounded-lg bg-white/5 space-y-3">
        <h2 className="text-sm font-semibold text-white/80 uppercase tracking-wide">
          Orchestration Sessions
        </h2>
        {sessions.length === 0 ? (
          <div
            data-testid="auth-connect-sessions-empty"
            className="text-sm text-white/40"
          >
            {loading ? "Loading…" : "No orchestration sessions yet."}
          </div>
        ) : (
          <ul data-testid="auth-connect-sessions-list" className="space-y-2">
            {sessions.map((s) => {
              const canCancel = s.state === "pending" || s.state === "ready";
              return (
                <li
                  key={s.id}
                  data-testid="auth-connect-sessions-row"
                  data-session-id={s.id}
                  data-state={s.state}
                  data-method={s.method}
                  data-provider={s.provider}
                  data-founder-safe={s.founderSafe ? "true" : "false"}
                  className="flex flex-col gap-1 border border-white/10 rounded-lg p-3 bg-white/5"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm text-white/80 font-medium">
                      {s.provider}
                    </span>
                    {stateBadge(s.state)}
                    {methodBadge(s.method)}
                    {founderSafeBadge(s.founderSafe)}
                    <span className="text-xs font-mono text-white/30">
                      {s.id}
                    </span>
                    <span className="text-xs text-white/30">
                      {new Date(s.createdAt).toLocaleString()}
                    </span>
                  </div>
                  {s.stateReason && (
                    <p className="text-xs text-white/50">{s.stateReason}</p>
                  )}
                  {s.forbiddenReason && (
                    <p
                      data-testid="auth-connect-forbidden-reason"
                      className="text-xs text-red-300/80"
                    >
                      {s.forbiddenReason}
                    </p>
                  )}
                  {canCancel && (
                    <div>
                      <button
                        data-testid="auth-connect-cancel-btn"
                        onClick={() => void handleCancel(s.id)}
                        disabled={cancellingId === s.id}
                        className="mt-1 px-3 py-1 rounded bg-white/5 hover:bg-white/10 text-white/70 text-xs font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        {cancellingId === s.id ? "Cancelling…" : "Cancel"}
                      </button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
