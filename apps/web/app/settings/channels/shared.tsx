"use client";

// G-T06.D14: shared Channels UI components, extracted from the former
// flat page.tsx so both the new category landing (page.tsx) and the
// upcoming per-category subpages in ./email/page.tsx, ./messages/page.tsx,
// and ./phone/page.tsx can import them from a single place without code
// duplication. This file has no routing effect — only files named
// page.tsx / layout.tsx / loading.tsx / error.tsx / route.ts in a Next.js
// app router folder become routes. shared.tsx is a regular client module.
//
// Nothing here changed between D10 and D14 except:
//   1. `UiProviderDescriptor` gained a `category` field, and each entry in
//      `UI_PROVIDERS` is now tagged ("email" for gmail/yahoo/outlook).
//   2. All components are now exported (previously only the default page
//      export mattered; the rest were file-local).
//   3. New helper `listUiProvidersByCategory(category)` mirrors the
//      server-side `listProvidersByCategory` in `apps/server/src/channels/
//      registry.ts` so subpage rendering is a one-liner.

import React, { useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";
import type { Route } from "next";
import type { GmailInboxMessage } from "@shared/channels";

// G-T06.D6: unified channel-state enum. Kept locally in the UI instead of
// importing from @shared/core to avoid pulling a runtime dependency into a
// purely-type use site; the server-side SSOT lives at
// packages/shared/src/channels.ts and the two must stay in sync (D5 §3.1).
export type ChannelState =
  | "disconnected"
  | "connecting"
  | "connected"
  | "error"
  | "reconnect_needed";

// G-T06.D14: client-side mirror of the server's ChannelCategory enum.
export type UiChannelCategory = "email" | "messages" | "phone" | "calendar" | "files";

// G-T06.D4: Gmail unread-count field component.
//
// Per docs/plans/G-T06.D1-google-refactor-plan.md line 308, the Gmail
// card needs to display "Unread: N" live from the managed-browser
// gateway. This tiny component polls the D4 inbox-summary endpoint
// (`GET /api/channels/gmail/inbox-summary?accountId=<id>`) at 30 s
// cadence, limited to the case where the provided account is Gmail AND
// currently connected. When disabled, it renders nothing — the caller
// controls visibility via the `enabled` prop. The response is metadata
// only (row counts + title + URL); no content is ever fetched.
function GmailUnreadField({
  accountId,
  enabled,
}: {
  accountId: string;
  enabled: boolean;
}) {
  const [unread, setUnread] = useState<number | null>(null);

  useEffect(() => {
    if (!enabled) {
      setUnread(null);
      return;
    }
    let cancelled = false;
    const tick = async () => {
      try {
        const res = await fetch(
          `/api/channels/gmail/inbox-summary?accountId=${encodeURIComponent(accountId)}`,
        );
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled && typeof data?.unread === "number") setUnread(data.unread);
      } catch {
        // Silent fail — the field just shows nothing if the read fails.
      }
    };
    tick();
    const t = setInterval(tick, 30_000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [accountId, enabled]);

  if (!enabled || unread == null) return null;
  return (
    <>
      <div className="text-white/40">Unread:</div>
      <div className="text-white/80" data-testid={`gmail-unread-${accountId}`}>
        {unread}
      </div>
    </>
  );
}

// G-T06.D15: reusable subpage header with top-of-page back navigation.
// Used by every Channels category subpage (email, messages, phone) to
// solve the "no visible back arrow" gap caught in operator UX review.
// Renders a clearly-visible "← Back to <label>" link ABOVE the title,
// not buried in body text.
export function SubpageHeader({
  backHref,
  backLabel,
  title,
  description,
}: {
  backHref: Route;
  backLabel: string;
  title: string;
  description: string;
}) {
  return (
    <div className="space-y-3" data-testid="channels-subpage-header">
      <Link
        href={backHref}
        className="inline-flex items-center gap-1.5 text-sm text-white/60 hover:text-white transition-colors"
        data-testid="channels-subpage-back-link"
      >
        <span aria-hidden className="text-base">←</span>
        <span>{backLabel}</span>
      </Link>
      <div className="space-y-1">
        <h1 className="text-2xl font-bold">{title}</h1>
        <p className="text-sm text-white/60">{description}</p>
      </div>
    </div>
  );
}

// G-T06.D15: ProviderCluster wrapper — groups a provider's account cards
// + add-account tile under a small heading row so the Email subpage can
// visually separate "my Google accounts" from "my Yahoo accounts" etc.
// Thin wrapper around ChannelProviderSection; the ChannelProviderSection
// still does all the polling/rendering internally.
export function ProviderCluster({ providerId }: { providerId: string }) {
  const descriptor = UI_PROVIDERS[providerId];
  if (!descriptor) return null;
  return (
    <section
      className="space-y-3"
      data-testid={`provider-cluster-${providerId}`}
    >
      <div className="flex items-center gap-3">
        <span className="text-2xl">{descriptor.renderIcon()}</span>
        <h2 className="text-lg font-semibold text-white/90">{descriptor.displayName}</h2>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ChannelProviderSection providerId={providerId} />
      </div>
    </section>
  );
}

export function StatusBadge({ connected }: { connected: boolean }) {
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

// ─────────────────────────────────────────────────────────────────────
// G-T06.D9: unified provider-aware Channels UI.
//
// A single `ChannelAccountCard`, `AddChannelAccountCard`, and
// `ChannelProviderSection` component render every browser-session provider
// from a tiny client-side descriptor map. Adding a new provider to the UI is
// one entry in `UI_PROVIDERS` — the generic components do the rest.
//
// The server-side SSOT for provider descriptors lives at
// apps/server/src/channels/registry.ts (and packages/shared/src/channels.ts
// for shared types). The client-side map here is a UI-only subset with just
// the fields needed for rendering, kept intentionally separate so the web
// bundle has no runtime dependency on the server registry.
// ─────────────────────────────────────────────────────────────────────

export type ChannelAccount = {
  providerId: string;
  accountId: string;
  identity: string | null;
  isDefault: boolean;
  channelState: ChannelState;
  title: string | null;
  url: string | null;
  running: boolean;
  tabOpen: boolean;
  createdAt?: string;
  updatedAt?: string;
};

export type UiProviderDescriptor = {
  providerId: string;
  displayName: string;
  category: UiChannelCategory;
  ctaConnectLabel: string;
  ctaConnectingLabel: string;
  ctaReconnectLabel: string;
  connectedHeadline: (identity: string | null) => string;
  addTitle: string;
  addButtonLabel: string;
  addBusyLabel: string;
  addBlurb: string;
  // Tailwind color tokens for the primary CTA style.
  accentBorder: string;
  accentBg: string;
  accentText: string;
  accentHover: string;
  // Can this provider mint additional accounts? (Everything except iMessage/WhatsApp.)
  canMintAdditional: boolean;
  // Icon renderer.
  renderIcon: () => React.ReactNode;
};

function GoogleIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18A10.96 10.96 0 001 12c0 1.77.42 3.44 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  );
}

function YahooBadge() {
  return (
    <span
      aria-hidden
      className="inline-flex items-center justify-center w-6 h-6 rounded bg-purple-600 text-white font-bold text-sm"
    >
      Y!
    </span>
  );
}

function OutlookBadge() {
  return (
    <span
      aria-hidden
      className="inline-flex items-center justify-center w-6 h-6 rounded bg-cyan-600 text-white font-bold text-sm"
    >
      O
    </span>
  );
}

export const UI_PROVIDERS: Record<string, UiProviderDescriptor> = {
  gmail: {
    providerId: "gmail",
    displayName: "Google",
    category: "email",
    ctaConnectLabel: "Connect Google",
    ctaConnectingLabel: "Opening Gmail...",
    ctaReconnectLabel: "Reconnect Google",
    connectedHeadline: (id) => (id ? `Gmail Connected — ${id}` : "Gmail Connected"),
    addTitle: "Add another Google account",
    addButtonLabel: "Add Google Account",
    addBusyLabel: "Opening new Chrome…",
    addBlurb:
      "Opens a new isolated managed-browser window so you can sign in to a second Google account. No credentials are stored.",
    accentBorder: "border-blue-500/40",
    accentBg: "bg-blue-600/20",
    accentText: "text-blue-300",
    accentHover: "hover:bg-blue-600/30 hover:text-white",
    canMintAdditional: true,
    renderIcon: () => <GoogleIcon />,
  },
  yahoo: {
    providerId: "yahoo",
    displayName: "Yahoo Mail",
    category: "email",
    ctaConnectLabel: "Connect Yahoo",
    ctaConnectingLabel: "Opening Yahoo Mail...",
    ctaReconnectLabel: "Sign in to Yahoo",
    connectedHeadline: (id) => (id ? `Yahoo Connected — ${id}` : "Yahoo Connected"),
    addTitle: "Add a Yahoo account",
    addButtonLabel: "Add Yahoo Account",
    addBusyLabel: "Opening new Chrome…",
    addBlurb:
      "Opens a new isolated managed-browser window so you can sign in to Yahoo Mail. No credentials are stored.",
    accentBorder: "border-purple-500/40",
    accentBg: "bg-purple-600/20",
    accentText: "text-purple-200",
    accentHover: "hover:bg-purple-600/30 hover:text-white",
    canMintAdditional: true,
    renderIcon: () => <YahooBadge />,
  },
  outlook: {
    providerId: "outlook",
    displayName: "Outlook",
    category: "email",
    ctaConnectLabel: "Connect Outlook",
    ctaConnectingLabel: "Opening Outlook...",
    ctaReconnectLabel: "Sign in to Outlook",
    connectedHeadline: (id) => (id ? `Outlook Connected — ${id}` : "Outlook Connected"),
    addTitle: "Add an Outlook account",
    addButtonLabel: "Add Outlook Account",
    addBusyLabel: "Opening new Chrome…",
    addBlurb:
      "Opens a new isolated managed-browser window so you can sign in to Outlook (outlook.live.com). No credentials are stored.",
    accentBorder: "border-cyan-500/40",
    accentBg: "bg-cyan-600/20",
    accentText: "text-cyan-200",
    accentHover: "hover:bg-cyan-600/30 hover:text-white",
    canMintAdditional: true,
    renderIcon: () => <OutlookBadge />,
  },
  "google-calendar": {
    providerId: "google-calendar",
    displayName: "Google Calendar",
    category: "calendar",
    ctaConnectLabel: "Connect Google Calendar",
    ctaConnectingLabel: "Opening Google Calendar...",
    ctaReconnectLabel: "Reconnect Google Calendar",
    connectedHeadline: (id) => (id ? `Google Calendar Connected — ${id}` : "Google Calendar Connected"),
    addTitle: "Add another Google Calendar account",
    addButtonLabel: "Add Google Calendar Account",
    addBusyLabel: "Opening new Chrome…",
    addBlurb:
      "Opens a managed-browser window so you can sign in to Google Calendar. No credentials are stored.",
    accentBorder: "border-blue-500/40",
    accentBg: "bg-blue-600/20",
    accentText: "text-blue-300",
    accentHover: "hover:bg-blue-600/30 hover:text-white",
    canMintAdditional: false,
    renderIcon: () => <GoogleIcon />,
  },
  "google-drive": {
    providerId: "google-drive",
    displayName: "Google Drive",
    category: "files",
    ctaConnectLabel: "Connect Google Drive",
    ctaConnectingLabel: "Opening Google Drive...",
    ctaReconnectLabel: "Reconnect Google Drive",
    connectedHeadline: (id) => (id ? `Google Drive Connected — ${id}` : "Google Drive Connected"),
    addTitle: "Add another Google Drive account",
    addButtonLabel: "Add Google Drive Account",
    addBusyLabel: "Opening new Chrome…",
    addBlurb:
      "Opens a managed-browser window so you can sign in to Google Drive. No credentials are stored.",
    accentBorder: "border-blue-500/40",
    accentBg: "bg-blue-600/20",
    accentText: "text-blue-300",
    accentHover: "hover:bg-blue-600/30 hover:text-white",
    canMintAdditional: false,
    renderIcon: () => <GoogleIcon />,
  },
};

export function listUiProvidersByCategory(
  category: UiChannelCategory,
): UiProviderDescriptor[] {
  return Object.values(UI_PROVIDERS).filter((p) => p.category === category);
}

// G-T06.D-GMAIL-READ-INBOX-01: minimal read-only inbox list for the Gmail
// connected-state card. Fetches the 10 most-recent messages once on mount.
// No polling — MVP. No send/delete/markRead actions.
function GmailInboxList({ accountId }: { accountId: string }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [messages, setMessages] = useState<GmailInboxMessage[]>([]);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/channels/gmail/inbox?accountId=${encodeURIComponent(accountId)}&limit=10`)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        if (data?.ok === false) {
          setError(data.error || data.reason || "Failed to load inbox");
        } else {
          setMessages(data?.messages ?? []);
        }
      })
      .catch((e: Error) => {
        if (!cancelled) setError(e.message || "network error");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [accountId]);

  if (loading) return <div data-testid="gmail-inbox-loading" className="text-xs text-white/50 pt-1">Loading inbox…</div>;
  if (error) return <div data-testid="gmail-inbox-error" className="text-xs text-red-300 pt-1">{error}</div>;
  if (messages.length === 0) return <div data-testid="gmail-inbox-empty" className="text-xs text-white/40 pt-1">No messages</div>;
  return (
    <ul data-testid="gmail-inbox-list" className="space-y-1 pt-1">
      {messages.map((msg) => (
        <li key={msg.id} data-testid="gmail-inbox-row" className="flex items-center gap-2 text-xs text-white/70">
          {msg.unread && <span className="inline-block h-1.5 w-1.5 rounded-full bg-blue-400 flex-shrink-0" />}
          <span className="font-medium truncate max-w-[120px]">{msg.from}</span>
          <span className="truncate text-white/50">{msg.subject}</span>
        </li>
      ))}
    </ul>
  );
}

// G-T06.D-GCAL-READ-EVENTS-01: minimal read-only events list for the Google Calendar
// connected-state card. Fetches the 10 next events once on mount. No polling — MVP.
type CalendarEvent = { id: string; title: string; timeText: string; dayLabel: string; locationText?: string };

function CalendarEventsList({ accountId }: { accountId: string }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [events, setEvents] = useState<CalendarEvent[]>([]);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/channels/google-calendar/events?accountId=${encodeURIComponent(accountId)}&limit=10`)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        if (data?.ok === false) {
          setError(data.error || data.reason || "Failed to load events");
        } else {
          setEvents(Array.isArray(data?.events) ? data.events : []);
        }
      })
      .catch((e: Error) => {
        if (!cancelled) setError(e.message || "network error");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [accountId]);

  if (loading) return <div data-testid="calendar-events-loading" className="text-xs text-white/50 pt-1">Loading events…</div>;
  if (error) return <div data-testid="calendar-events-error" className="text-xs text-red-300 pt-1">{error}</div>;
  if (events.length === 0) return <div data-testid="calendar-events-empty" className="text-xs text-white/40 pt-1">No visible events</div>;
  return (
    <ul data-testid="calendar-events-list" className="space-y-1 pt-1">
      {events.map((ev) => (
        <li key={ev.id} data-testid="calendar-events-row" className="flex items-center gap-2 text-xs text-white/70">
          <span className="font-medium truncate max-w-[160px]">{ev.title || "(untitled)"}</span>
          {ev.dayLabel && <span className="truncate text-white/50">{ev.dayLabel}</span>}
          {ev.timeText && <span className="truncate text-white/50">{ev.timeText}</span>}
        </li>
      ))}
    </ul>
  );
}

export function ChannelAccountCard({
  descriptor,
  account,
  onChanged,
}: {
  descriptor: UiProviderDescriptor;
  account: ChannelAccount;
  onChanged: () => void;
}) {
  const [busy, setBusy] = useState<null | "connect" | "disconnect" | "remove">(null);

  const q = `?accountId=${encodeURIComponent(account.accountId)}`;

  const handleConnect = async () => {
    setBusy("connect");
    try {
      await fetch(`/api/channels/${descriptor.providerId}/connect${q}`, { method: "POST" });
      setTimeout(onChanged, 3000);
    } catch {}
    setBusy(null);
  };

  const handleDisconnect = async () => {
    setBusy("disconnect");
    try {
      await fetch(`/api/channels/${descriptor.providerId}/disconnect${q}`, { method: "POST" });
    } catch {}
    setBusy(null);
    setTimeout(onChanged, 800);
  };

  const handleRemove = async () => {
    setBusy("remove");
    try {
      await fetch(
        `/api/channels/${descriptor.providerId}/accounts/${encodeURIComponent(account.accountId)}`,
        { method: "DELETE" },
      );
    } catch {}
    setBusy(null);
    setTimeout(onChanged, 400);
  };

  const isConnected = account.channelState === "connected";

  const statusLabel =
    account.channelState === "connected" ? `${descriptor.displayName} Active`
    : account.channelState === "reconnect_needed" ? "Sign in needed"
    : account.channelState === "connecting" ? "Connecting…"
    : account.channelState === "error" ? "Error"
    : account.running ? "Browser ready"
    : "Not connected";
  const statusColor =
    account.channelState === "connected" ? "text-green-300"
    : account.channelState === "connecting" ? "text-yellow-300"
    : account.channelState === "reconnect_needed" ? "text-yellow-300"
    : account.channelState === "error" ? "text-orange-300"
    : account.running ? "text-yellow-300"
    : "text-red-300";

  const headerLabel = account.isDefault ? `${descriptor.displayName} (Default)` : descriptor.displayName;
  const identityLine = account.identity || (account.isDefault ? "default account" : "not signed in yet");

  return (
    <div
      className="card p-5 space-y-4 border border-white/10 rounded-lg bg-white/5"
      data-testid={`${descriptor.providerId}-account-card-${account.accountId}`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-2xl">{descriptor.renderIcon()}</span>
          <h3 className="text-lg font-semibold text-white">{headerLabel}</h3>
        </div>
        <StatusBadge connected={isConnected} />
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
        <div className="text-white/40">Status:</div>
        <div className={statusColor}>{statusLabel}</div>
        <div className="text-white/40">Account:</div>
        <div className="text-white/80 truncate">{identityLine}</div>
        <div className="text-white/40">Method:</div>
        <div className="text-white/70">Browser session (no API keys needed)</div>
        <GmailUnreadField
          accountId={account.accountId}
          enabled={descriptor.providerId === "gmail" && isConnected}
        />
      </div>
      {isConnected ? (
        <div className="space-y-2">
          <div className="w-full px-4 py-2 text-sm rounded border border-green-500/30 bg-green-500/10 text-green-300 text-center">
            {descriptor.connectedHeadline(account.identity)}
          </div>
          {descriptor.providerId === "gmail" && (
            <GmailInboxList accountId={account.accountId} />
          )}
          {descriptor.providerId === "google-calendar" && (
            <CalendarEventsList accountId={account.accountId} />
          )}
          <button
            onClick={handleDisconnect}
            disabled={busy !== null}
            data-testid={`disconnect-${descriptor.providerId}-button-${account.accountId}`}
            className="block w-full px-4 py-2 text-sm rounded border border-white/20 bg-white/5 text-white/70 hover:bg-white/10 hover:text-white transition-colors text-center cursor-pointer disabled:opacity-50"
          >
            {busy === "disconnect" ? "Disconnecting…" : "Disconnect"}
          </button>
          {!account.isDefault && (
            <button
              onClick={handleRemove}
              disabled={busy !== null}
              data-testid={`remove-${descriptor.providerId}-button-${account.accountId}`}
              className="block w-full px-4 py-1.5 text-xs rounded border border-red-500/30 bg-red-500/5 text-red-300/80 hover:bg-red-500/15 hover:text-red-200 transition-colors text-center cursor-pointer disabled:opacity-50"
            >
              {busy === "remove" ? "Removing…" : "Remove account"}
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          <button
            onClick={handleConnect}
            disabled={busy !== null}
            data-testid={`connect-${descriptor.providerId}-button-${account.accountId}`}
            className={`block w-full px-4 py-2 text-sm rounded border ${descriptor.accentBorder} ${descriptor.accentBg} ${descriptor.accentText} ${descriptor.accentHover} transition-colors text-center cursor-pointer disabled:opacity-50`}
          >
            {busy === "connect"
              ? descriptor.ctaConnectingLabel
              : account.channelState === "reconnect_needed"
                ? descriptor.ctaReconnectLabel
                : descriptor.ctaConnectLabel}
          </button>
          {!account.isDefault && (
            <button
              onClick={handleRemove}
              disabled={busy !== null}
              data-testid={`remove-${descriptor.providerId}-button-${account.accountId}`}
              className="block w-full px-4 py-1.5 text-xs rounded border border-red-500/30 bg-red-500/5 text-red-300/80 hover:bg-red-500/15 hover:text-red-200 transition-colors text-center cursor-pointer disabled:opacity-50"
            >
              {busy === "remove" ? "Removing…" : "Remove account"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export function AddChannelAccountCard({
  descriptor,
  onChanged,
}: {
  descriptor: UiProviderDescriptor;
  onChanged: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAdd = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/channels/${descriptor.providerId}/accounts`, { method: "POST" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data?.error || `HTTP ${res.status}`);
      } else {
        setTimeout(onChanged, 500);
      }
    } catch (e) {
      setError((e as Error).message || "network error");
    }
    setBusy(false);
  };

  return (
    <div
      className="card p-5 space-y-3 border border-dashed border-white/15 rounded-lg bg-white/2 flex flex-col items-center justify-center min-h-[180px]"
      data-testid={`add-${descriptor.providerId}-account-card`}
    >
      <div className="flex items-center gap-3">
        <span className="text-2xl">{descriptor.renderIcon()}</span>
        <h3 className="text-base font-medium text-white/80">{descriptor.addTitle}</h3>
      </div>
      <p className="text-xs text-white/50 text-center max-w-[240px]">{descriptor.addBlurb}</p>
      <button
        onClick={handleAdd}
        disabled={busy}
        data-testid={`add-${descriptor.providerId}-account-button`}
        className={`px-4 py-2 text-sm rounded border ${descriptor.accentBorder} ${descriptor.accentBg} ${descriptor.accentText} ${descriptor.accentHover} transition-colors cursor-pointer disabled:opacity-50`}
      >
        {busy ? descriptor.addBusyLabel : descriptor.addButtonLabel}
      </button>
      {error && <p className="text-xs text-red-300 text-center">{error}</p>}
    </div>
  );
}

export function ChannelProviderSection({ providerId }: { providerId: string }) {
  const descriptor = UI_PROVIDERS[providerId];
  const [accounts, setAccounts] = useState<ChannelAccount[] | null>(null);

  const refetch = useCallback(() => {
    fetch(`/api/channels/${providerId}/accounts`)
      .then((r) => r.json())
      .then((data: { accounts: ChannelAccount[] }) => setAccounts(data.accounts || []))
      .catch(() => setAccounts([]));
  }, [providerId]);

  useEffect(() => {
    refetch();
    const t = setInterval(refetch, 10000);
    return () => clearInterval(t);
  }, [refetch]);

  if (!descriptor) return null;

  if (!accounts) {
    return (
      <div className="card p-5 border border-white/10 rounded-lg bg-white/5 text-sm text-white/50">
        Loading {descriptor.displayName} accounts…
      </div>
    );
  }

  return (
    <>
      {accounts.map((a) => (
        <ChannelAccountCard
          key={`${providerId}-${a.accountId}`}
          descriptor={descriptor}
          account={a}
          onChanged={refetch}
        />
      ))}
      {descriptor.canMintAdditional && (
        <AddChannelAccountCard descriptor={descriptor} onChanged={refetch} />
      )}
    </>
  );
}

// ── WhatsApp Card (DEC-032 direct-import lane) ──

type WaStatus = {
  state: "idle" | "awaiting_scan" | "linked" | "timed_out" | "cancelled";
  channelState?: ChannelState;
  identity?: string | null;
  qrDataUrl?: string | null;
  message?: string | null;
  startedAt?: number | null;
};

export function WhatsAppConnectCard() {
  const [status, setStatus] = useState<WaStatus>({ state: "idle" });
  const [busy, setBusy] = useState<null | "connect" | "disconnect">(null);
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
    setBusy("connect");
    try {
      const res = await fetch("/api/channels/whatsapp/connect", { method: "POST" });
      const data: WaStatus = await res.json();
      setStatus(data);
      if (data.state === "awaiting_scan") {
        startPolling();
      }
    } catch {}
    setBusy(null);
  };

  const handleCancel = async () => {
    try {
      await fetch("/api/channels/whatsapp/cancel", { method: "POST" });
    } catch {}
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    setStatus({ state: "cancelled", message: "Cancelled." });
  };

  const handleDisconnect = async () => {
    setBusy("disconnect");
    try {
      const res = await fetch("/api/channels/whatsapp/disconnect", { method: "POST" });
      if (res.ok) {
        const data: WaStatus = await res.json();
        setStatus(data);
      }
    } catch {}
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    setBusy(null);
    setTimeout(checkStatus, 500);
  };

  const channelState: ChannelState =
    status.channelState ??
    (status.state === "linked" ? "connected"
      : status.state === "awaiting_scan" ? "connecting"
      : status.state === "timed_out" ? "error"
      : "disconnected");
  const isLinked = channelState === "connected";

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
        <div className="space-y-2">
          <div className="w-full px-4 py-2 text-sm rounded border border-green-500/30 bg-green-500/10 text-green-300 text-center">
            WhatsApp Connected
          </div>
          <button
            onClick={handleDisconnect}
            disabled={busy !== null}
            data-testid="disconnect-whatsapp-button"
            className="block w-full px-4 py-2 text-sm rounded border border-white/20 bg-white/5 text-white/70 hover:bg-white/10 hover:text-white transition-colors text-center cursor-pointer disabled:opacity-50"
          >
            {busy === "disconnect" ? "Disconnecting…" : "Disconnect"}
          </button>
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
            disabled={busy !== null}
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
          disabled={busy !== null}
          data-testid="connect-whatsapp-button"
          className="block w-full px-4 py-2 text-sm rounded border border-blue-500/40 bg-blue-600/20 text-blue-300 hover:bg-blue-600/30 hover:text-white transition-colors text-center cursor-pointer disabled:opacity-50"
        >
          {busy === "connect" ? "Generating QR..." : "Connect WhatsApp"}
        </button>
      )}
    </div>
  );
}

// ── iMessage Card (placeholder) ──

export function IMessageCard() {
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
