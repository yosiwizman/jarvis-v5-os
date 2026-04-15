// Unified channel state contract.
// Introduced in G-T06.D6, per docs/plans/G-T06.D5-channels-v2-plan.md §3.1.
// Extended in G-T06.D9 with provider descriptor shapes and the unified
// browser-session account record model.
//
// Every provider card (Gmail, WhatsApp, future Yahoo/Outlook/etc.) normalizes
// its internal state machine onto this enum so the Channels UI can render
// badges, CTAs, and actions uniformly.

export type ChannelState =
  | "disconnected"
  | "connecting"
  | "connected"
  | "error"
  | "reconnect_needed";

export interface ChannelStatusEnvelope {
  channelState: ChannelState;
  identity?: string | null;
  message?: string | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// G-T06.D9: Provider descriptors and browser-session account model.
// ─────────────────────────────────────────────────────────────────────────────

export type AuthStrategy =
  | "browser-session-gateway"   // Uses the OpenClaw gateway Chrome (Gmail default)
  | "browser-session-spawn"     // Direct Chrome subprocess per account (Gmail secondary, Yahoo)
  | "qr-scan"                   // QR code (WhatsApp)
  | "placeholder";              // Not yet implemented (iMessage)

// G-T06.D14: provider category taxonomy. Drives the Channels IA split
// into /settings/channels/{email,messages,phone} per docs/plans/
// G-T06.D13-channels-ia-plan.md §3.3. Each descriptor MUST carry a
// category so the category landing page and subpages can filter/group.
// "placeholder" is deliberately absent here — every provider must land
// in exactly one of the four user-visible categories; a
// "placeholder"-style lane becomes e.g. category: "messages" with an
// authStrategy of "placeholder", not a hidden bucket.
export type ChannelCategory = "email" | "messages" | "phone" | "calendar" | "files";

export interface ChannelCapabilities {
  read: boolean;
  send: boolean;
  multiAccount: boolean;
  disconnect: boolean;
  reconnect: boolean;
}

export interface SignedInPredicate {
  // "title-not-signin": connected iff title exists and does not contain "sign in"
  // "identity-required": connected iff an email identity can be parsed from the title
  kind: "title-not-signin" | "identity-required";
}

export interface ChannelProviderDescriptor {
  providerId: string;             // "gmail" | "yahoo" | "whatsapp" | "imessage" | future
  displayName: string;            // "Google" | "Yahoo Mail" | ...
  category: ChannelCategory;      // D14: drives subpage routing/filtering
  authStrategy: AuthStrategy;
  capabilities: ChannelCapabilities;
  // Browser-session-specific fields (optional; absent for qr-scan/placeholder providers).
  landingUrl?: string;            // e.g. "https://mail.google.com/"
  urlMatchers?: readonly string[];
  cdpPortBase?: number;           // Start of the allocation range for spawned Chromes
  profileDirPrefix?: string;      // e.g. "user-data" | "user-data-yahoo"
  hasGatewayDefault?: boolean;    // true only for providers that share the OpenClaw gateway (gmail)
  identityRegex?: string;         // Serialized RegExp source (default: email match)
  signedInPredicate?: SignedInPredicate;
  // UI hints (purely display; runtime agnostic).
  uiAccent?: "blue" | "purple" | "green" | "gray"; // primary CTA color
  uiIcon?: "google" | "yahoo-badge" | "whatsapp" | "imessage";
  uiOrder?: number;               // display ordering in the Channels grid
}

export interface BrowserSessionAccountRecord {
  providerId: string;
  accountId: string;
  identity: string | null;
  isDefault: boolean;             // true only for the gateway-backed Gmail default
  profileDir: string;
  cdpPort: number | null;         // null iff isDefault && descriptor.hasGatewayDefault
  pid: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface UnifiedAccountsIndex {
  version: 2;
  accounts: BrowserSessionAccountRecord[];
}

export interface ChannelAccountStatus {
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
}

// G-T06.D14: category landing page count envelope. Returned by
// GET /api/channels/counts and consumed by the landing page to render
// per-category badges ("3 of 3 connected", "Not connected", etc.).
export interface ChannelCategoryCount {
  providers: number;         // number of descriptors in this category
  connectedAccounts: number; // accounts across those providers in channelState "connected"
  totalAccounts: number;     // total accounts across those providers regardless of state
}

export type ChannelCountsResponse = Record<ChannelCategory, ChannelCategoryCount>;

// G-T06.D-GMAIL-READ-INBOX-01: minimal structured inbox row.
// Read-only metadata scraped from the already-rendered Gmail managed-browser
// session DOM. DEC-033 posture: no credentials, no off-system staging, no
// API keys. Shape kept deliberately narrow — sender, subject, snippet,
// timestamp, unread flag, stable row id.
export interface GmailInboxMessage {
  id: string;
  from: string;
  subject: string;
  snippet: string;
  timestamp: string | null;
  unread: boolean;
}

export interface GmailInboxReadResponse {
  ok: boolean;
  providerId: "gmail";
  accountId: string;
  messages: GmailInboxMessage[];
  reason?: "not_connected" | "read_failed";
  error?: string;
  channelState?: ChannelState;
}
