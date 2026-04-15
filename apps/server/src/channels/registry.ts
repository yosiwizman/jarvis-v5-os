// G-T06.D9: Channel provider registry.
//
// Static TypeScript map of provider descriptors per docs/plans/G-T06.D5-channels-v2-plan.md §3.7.
// Adding a new browser-session provider (e.g. Outlook, iCloud Mail) is a single
// descriptor entry plus a registry import. See the Outlook scaffold at the
// bottom of this file for the acceptance measurement.

import type { ChannelProviderDescriptor } from "@shared/core";

const EMAIL_IDENTITY_REGEX = "([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,})";

export const CHANNEL_PROVIDERS: Record<string, ChannelProviderDescriptor> = {
  gmail: {
    providerId: "gmail",
    displayName: "Google",
    category: "email",
    authStrategy: "browser-session-gateway",
    capabilities: { read: true, send: false, multiAccount: true, disconnect: true, reconnect: true },
    landingUrl: "https://mail.google.com/",
    urlMatchers: ["mail.google.com", "accounts.google.com"],
    cdpPortBase: 18900,
    profileDirPrefix: "user-data",
    hasGatewayDefault: true,
    identityRegex: EMAIL_IDENTITY_REGEX,
    // G-T06.D11: hardened from "title-not-signin" to "identity-required" so
    // Gmail uses the same signal Yahoo and Outlook already use — a title
    // without an extractable email maps to reconnect_needed instead of the
    // ambiguous "title exists so must be connected" heuristic. This fixes
    // the transient loading-state false-positive and keeps all three email
    // providers on one predicate. Inbox titles reliably contain the account
    // email (e.g. "Inbox (N) - email@domain - Gmail"), proven across
    // D3a/D4/D6/D7/D9/D10 runs.
    signedInPredicate: { kind: "identity-required" },
    uiAccent: "blue",
    uiIcon: "google",
    uiOrder: 10,
  },
  yahoo: {
    providerId: "yahoo",
    displayName: "Yahoo Mail",
    category: "email",
    authStrategy: "browser-session-spawn",
    capabilities: { read: true, send: false, multiAccount: true, disconnect: true, reconnect: true },
    landingUrl: "https://mail.yahoo.com/",
    urlMatchers: ["mail.yahoo.com", "login.yahoo.com", "overview.mail.yahoo.com"],
    cdpPortBase: 19000,
    profileDirPrefix: "user-data-yahoo",
    hasGatewayDefault: false,
    identityRegex: EMAIL_IDENTITY_REGEX,
    signedInPredicate: { kind: "identity-required" },
    uiAccent: "purple",
    uiIcon: "yahoo-badge",
    uiOrder: 20,
  },
  whatsapp: {
    // WhatsApp lives on a separate DEC-032 direct-import lane with its own
    // state machine. The descriptor is a placeholder here so the registry can
    // enumerate all channels; routes and UI for WhatsApp stay in the existing
    // per-provider path until a future slice migrates them.
    providerId: "whatsapp",
    displayName: "WhatsApp",
    category: "messages",
    authStrategy: "qr-scan",
    capabilities: { read: true, send: true, multiAccount: false, disconnect: true, reconnect: true },
    uiAccent: "green",
    uiIcon: "whatsapp",
    uiOrder: 30,
  },
  imessage: {
    providerId: "imessage",
    displayName: "iMessage",
    category: "messages",
    authStrategy: "placeholder",
    capabilities: { read: false, send: false, multiAccount: false, disconnect: false, reconnect: false },
    uiAccent: "gray",
    uiIcon: "imessage",
    uiOrder: 40,
  },
  "google-calendar": {
    providerId: "google-calendar",
    displayName: "Google Calendar",
    category: "calendar",
    authStrategy: "browser-session-gateway",
    capabilities: { read: false, send: false, multiAccount: false, disconnect: true, reconnect: true },
    landingUrl: "https://calendar.google.com/",
    urlMatchers: ["calendar.google.com", "accounts.google.com"],
    cdpPortBase: 18910,
    profileDirPrefix: "user-data",
    hasGatewayDefault: true,
    identityRegex: EMAIL_IDENTITY_REGEX,
    signedInPredicate: { kind: "identity-required" },
    uiAccent: "blue",
    uiIcon: "google",
    uiOrder: 15,
  },
  // D9 acceptance scaffold: Outlook demonstrates the "add a new provider in
  // <100 lines" target from D5 §3.7. It is a descriptor-only scaffold with
  // NO wired UI and NO routes, exactly matching the task's "keep skeletons
  // non-invasive" rule. The shared browserSession adapter will service it
  // automatically once its routes/UI are added in a future slice.
  outlook: {
    providerId: "outlook",
    displayName: "Outlook",
    category: "email",
    authStrategy: "browser-session-spawn",
    capabilities: { read: true, send: false, multiAccount: true, disconnect: true, reconnect: true },
    landingUrl: "https://outlook.live.com/mail/",
    // Microsoft aggressively redirects outlook.live.com/mail/ to the
    // microsoft.com marketing page for logged-out users, then back to
    // outlook.live.com once a session exists. The matchers must cover every
    // leg so the tab counts as the provider's even during the redirect
    // dance; the identity-required predicate then handles the signed-in-vs-
    // logged-out derivation via title-email extraction.
    urlMatchers: [
      "outlook.live.com",
      "outlook.office.com",
      "login.live.com",
      "login.microsoftonline.com",
      "microsoft.com/en-us/microsoft-365/outlook",
      "microsoft.com/microsoft-365/outlook",
      "microsoft365.com",
    ],
    cdpPortBase: 19100,
    profileDirPrefix: "user-data-outlook",
    hasGatewayDefault: false,
    identityRegex: EMAIL_IDENTITY_REGEX,
    signedInPredicate: { kind: "identity-required" },
    uiAccent: "blue",
    uiIcon: "google",
    uiOrder: 50,
  },
};

export function getProviderDescriptor(providerId: string): ChannelProviderDescriptor | null {
  return CHANNEL_PROVIDERS[providerId] ?? null;
}

export function listBrowserSessionProviders(): ChannelProviderDescriptor[] {
  return Object.values(CHANNEL_PROVIDERS)
    .filter(
      (d) =>
        d.authStrategy === "browser-session-gateway" || d.authStrategy === "browser-session-spawn",
    )
    .sort((a, b) => (a.uiOrder ?? 1000) - (b.uiOrder ?? 1000));
}

// G-T06.D14: list providers in a specific category, sorted by uiOrder.
// Used by the /api/channels/counts route and (in future D15/D16/D17)
// by the per-category subpages to filter what to render.
export function listProvidersByCategory(
  category: ChannelProviderDescriptor["category"],
): ChannelProviderDescriptor[] {
  return Object.values(CHANNEL_PROVIDERS)
    .filter((d) => d.category === category)
    .sort((a, b) => (a.uiOrder ?? 1000) - (b.uiOrder ?? 1000));
}
