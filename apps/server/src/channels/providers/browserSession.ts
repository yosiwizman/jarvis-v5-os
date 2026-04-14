// G-T06.D9: Shared browser-session provider adapter.
//
// This module centralises the Chrome subprocess lifecycle, tab/status/close
// logic, and state derivation that used to be duplicated between the Gmail
// and Yahoo lanes in apps/server/src/index.ts. It supports two internal
// modes selected at runtime by the account record and its descriptor:
//
//   1. Gateway mode   — for the single Gmail default account. Routes through
//                       the existing OpenClaw gateway Chrome on port 18791
//                       and its CDP on 18800. The gateway manages Chrome's
//                       lifecycle; this module only talks to its HTTP surface.
//   2. Spawn mode     — for every non-default account (Gmail secondary,
//                       Yahoo, future Outlook/iCloud). Each account gets its
//                       own Chrome subprocess with its own --user-data-dir and
//                       its own --remote-debugging-port allocated from the
//                       descriptor's cdpPortBase.
//
// DEC-033: this module stores no credentials, no OAuth clientIds/secrets, and
// no JSON key files. Session persistence lives exclusively inside the managed
// Chrome profile directory that the descriptor points at.

import { existsSync, mkdirSync, readFileSync } from "fs";
import path from "path";
import { spawn, type ChildProcess } from "child_process";
import { WebSocket } from "ws";
import type {
  BrowserSessionAccountRecord,
  ChannelAccountStatus,
  ChannelProviderDescriptor,
  ChannelState,
  GmailInboxMessage,
} from "@shared/core";
import { updateAccount, BROWSER_PROFILE_ROOT } from "../accountsIndex.js";

// ── URL / host safety helpers ─────────────────────────────────────────────
//
// CodeQL js/incomplete-url-substring-sanitization hardening. The legacy
// `.includes("mail.google.com")` substring check incorrectly accepts
// URLs like `https://evil.com/?x=mail.google.com` or
// `https://mail.google.com.phishing.example/`. Use canonical host parsing
// so only the real Gmail host matches.
export function isGmailTabUrl(urlString: string | null | undefined): boolean {
  if (!urlString || typeof urlString !== "string") return false;
  try {
    const h = new URL(urlString).hostname;
    return h === "mail.google.com";
  } catch {
    // Invalid URL (chrome://newtab, about:blank, malformed, etc.) — not Gmail.
    return false;
  }
}

// ── Gateway config ─────────────────────────────────────────────────────────

export interface GatewayConfig {
  port: number;
  authToken: string;
}

// The OpenClaw browser-session gateway is hardcoded to 127.0.0.1:18791 in
// the D6 lane. openclaw.json exposes gateway.port=18789 which is a different
// surface (WhatsApp send gateway via ws://127.0.0.1:18789) and must NOT be
// used here. Only the auth token is shared with the browser-session gateway.
const BROWSER_SESSION_GATEWAY_PORT = 18791;

export function loadGatewayConfigFromDisk(): GatewayConfig {
  try {
    const cfg = JSON.parse(
      readFileSync(path.join(process.env.HOME || "", ".openclaw", "openclaw.json"), "utf-8"),
    );
    return {
      port: BROWSER_SESSION_GATEWAY_PORT,
      authToken: cfg?.gateway?.auth?.token || "",
    };
  } catch {
    return { port: BROWSER_SESSION_GATEWAY_PORT, authToken: "" };
  }
}

const CHROME_EXEC = "/usr/bin/google-chrome";

// ── Gateway mode (Gmail default only) ──────────────────────────────────────

interface RawTabStatus {
  running: boolean;
  tabOpen: boolean;
  title: string | null;
  url: string | null;
}

async function gatewayTabStatus(
  gw: GatewayConfig,
  descriptor: ChannelProviderDescriptor,
): Promise<RawTabStatus> {
  try {
    const res = await fetch(`http://127.0.0.1:${gw.port}/tabs`, {
      headers: { Authorization: `Bearer ${gw.authToken}` },
    });
    if (!res.ok) return { running: false, tabOpen: false, title: null, url: null };
    const data = (await res.json()) as any;
    if (!data.running) return { running: false, tabOpen: false, title: null, url: null };
    const matchers = descriptor.urlMatchers || [];
    const tab = (data.tabs || []).find(
      (t: any) => t?.type === "page" && matchers.some((m) => (t.url || "").includes(m)),
    );
    return {
      running: true,
      tabOpen: !!tab,
      title: tab?.title || null,
      url: tab?.url || null,
    };
  } catch {
    return { running: false, tabOpen: false, title: null, url: null };
  }
}

async function gatewayStartChrome(
  gw: GatewayConfig,
  descriptor: ChannelProviderDescriptor,
): Promise<{ ok: boolean; message: string }> {
  try {
    const statusRes = await fetch(`http://127.0.0.1:${gw.port}/`, {
      headers: { Authorization: `Bearer ${gw.authToken}` },
    });
    const statusData = (await statusRes.json()) as any;
    if (!statusData.running) {
      await fetch(`http://127.0.0.1:${gw.port}/start`, {
        method: "POST",
        headers: { Authorization: `Bearer ${gw.authToken}` },
      });
      await new Promise((r) => setTimeout(r, 2000));
    }
    const cdpPort = statusData.cdpPort || 18800;
    const url = descriptor.landingUrl || "https://mail.google.com/";
    await fetch(`http://127.0.0.1:${cdpPort}/json/new?${url}`, { method: "PUT" });
    return { ok: true, message: `${descriptor.displayName} opened in AKIOR browser. Sign in if prompted.` };
  } catch {
    return { ok: false, message: "Failed to open browser. Is OpenClaw gateway running?" };
  }
}

async function gatewayDisconnect(
  gw: GatewayConfig,
  descriptor: ChannelProviderDescriptor,
): Promise<{ closed: boolean; message: string }> {
  try {
    const statusRes = await fetch(`http://127.0.0.1:${gw.port}/`, {
      headers: { Authorization: `Bearer ${gw.authToken}` },
    });
    if (!statusRes.ok) return { closed: false, message: "gateway unreachable" };
    const statusData = (await statusRes.json()) as any;
    if (!statusData.running) return { closed: false, message: "browser not running" };
    const cdpPort: number = Number(statusData.cdpPort) || 18800;

    const tabsRes = await fetch(`http://127.0.0.1:${gw.port}/tabs`, {
      headers: { Authorization: `Bearer ${gw.authToken}` },
    });
    if (!tabsRes.ok) return { closed: false, message: "gateway /tabs unreachable" };
    const tabsData = (await tabsRes.json()) as any;
    const matchers = descriptor.urlMatchers || [];
    const tab = (tabsData.tabs || []).find(
      (t: any) => t?.type === "page" && matchers.some((m) => (t.url || "").includes(m)),
    );
    if (!tab?.targetId) return { closed: false, message: "no tab to close" };
    const closeRes = await fetch(
      `http://127.0.0.1:${cdpPort}/json/close/${encodeURIComponent(tab.targetId)}`,
    );
    if (!closeRes.ok) return { closed: false, message: `cdp close failed: HTTP ${closeRes.status}` };
    return { closed: true, message: `${descriptor.displayName} tab closed` };
  } catch (err) {
    return { closed: false, message: (err as Error).message || "close error" };
  }
}

// ── Spawn mode (all non-default browser-session accounts) ──────────────────

const spawnedProcesses = new Map<string, ChildProcess>();

function spawnRegistryKey(providerId: string, accountId: string): string {
  return `${providerId}:${accountId}`;
}

async function spawnModeStart(
  descriptor: ChannelProviderDescriptor,
  record: BrowserSessionAccountRecord,
): Promise<{ ok: boolean; message: string; child?: ChildProcess }> {
  if (record.cdpPort == null) return { ok: false, message: "no cdpPort allocated" };
  const landingUrl = descriptor.landingUrl;
  if (!landingUrl) return { ok: false, message: "descriptor missing landingUrl" };

  // Already running?
  try {
    const probe = await fetch(`http://127.0.0.1:${record.cdpPort}/json/version`, {
      signal: AbortSignal.timeout(1500),
    });
    if (probe.ok) {
      // Ensure the provider landing tab is present.
      await fetch(`http://127.0.0.1:${record.cdpPort}/json/new?${landingUrl}`, {
        method: "PUT",
      }).catch(() => {});
      return { ok: true, message: "already running" };
    }
  } catch {}

  // CodeQL js/path-injection closure (alerts #6 and #7): rebuild the
  // filesystem target from the known-safe BROWSER_PROFILE_ROOT plus the
  // basename of record.profileDir. path.basename() is the canonical
  // CodeQL-recognized path-injection sanitizer — it strips ALL directory
  // components (including "..", "/", "\\"), so any traversal that may
  // have leaked through the upstream PROVIDER_ID_REGEX guard in
  // accountsIndex.ts::mintAccount cannot reach the fs sink.
  //
  // Defence-in-depth layers are:
  //   layer 1: PROVIDER_ID_REGEX in mintAccount (source)
  //   layer 2: path.basename() at sink (this block) ← CodeQL-recognized
  const safeDirName = path.basename(record.profileDir);
  const resolvedProfileDir = path.join(BROWSER_PROFILE_ROOT, safeDirName);

  try {
    if (!existsSync(resolvedProfileDir)) mkdirSync(resolvedProfileDir, { recursive: true });
  } catch (err) {
    return { ok: false, message: `failed to prepare profile dir: ${(err as Error).message}` };
  }

  const args = [
    `--remote-debugging-port=${record.cdpPort}`,
    `--remote-debugging-address=127.0.0.1`,
    `--user-data-dir=${record.profileDir}`,
    `--no-first-run`,
    `--no-default-browser-check`,
    `--disable-session-crashed-bubble`,
    `--disable-features=TranslateUI`,
    landingUrl,
  ];

  let child: ChildProcess;
  try {
    child = spawn(CHROME_EXEC, args, { detached: false, stdio: "ignore" });
  } catch (err) {
    return { ok: false, message: `spawn failed: ${(err as Error).message}` };
  }

  const key = spawnRegistryKey(record.providerId, record.accountId);
  spawnedProcesses.set(key, child);
  child.on("exit", () => {
    spawnedProcesses.delete(key);
    updateAccount(record.providerId, record.accountId, { pid: null });
  });
  updateAccount(record.providerId, record.accountId, { pid: child.pid ?? null });

  // Poll for CDP readiness.
  for (let i = 0; i < 24; i++) {
    try {
      const probe = await fetch(`http://127.0.0.1:${record.cdpPort}/json/version`, {
        signal: AbortSignal.timeout(1000),
      });
      if (probe.ok) return { ok: true, message: "started", child };
    } catch {}
    await new Promise((r) => setTimeout(r, 500));
  }
  return { ok: false, message: "CDP not ready within 12s", child };
}

async function spawnModeStatus(
  descriptor: ChannelProviderDescriptor,
  record: BrowserSessionAccountRecord,
): Promise<RawTabStatus> {
  if (record.cdpPort == null) return { running: false, tabOpen: false, title: null, url: null };
  try {
    const res = await fetch(`http://127.0.0.1:${record.cdpPort}/json/list`, {
      signal: AbortSignal.timeout(2000),
    });
    if (!res.ok) return { running: false, tabOpen: false, title: null, url: null };
    const tabs = (await res.json()) as any[];
    const matchers = descriptor.urlMatchers || [];
    const tab = tabs.find(
      (t) => t?.type === "page" && matchers.some((m) => (t.url || "").includes(m)),
    );
    return {
      running: true,
      tabOpen: !!tab,
      title: tab?.title || null,
      url: tab?.url || null,
    };
  } catch {
    return { running: false, tabOpen: false, title: null, url: null };
  }
}

async function spawnModeDisconnect(
  descriptor: ChannelProviderDescriptor,
  record: BrowserSessionAccountRecord,
): Promise<{ closed: boolean; message: string }> {
  if (record.cdpPort == null) return { closed: false, message: "no cdpPort" };
  try {
    const res = await fetch(`http://127.0.0.1:${record.cdpPort}/json/list`, {
      signal: AbortSignal.timeout(2000),
    });
    if (!res.ok) return { closed: false, message: "chrome not running" };
    const tabs = (await res.json()) as any[];
    const matchers = descriptor.urlMatchers || [];
    const tab = tabs.find(
      (t) => t?.type === "page" && matchers.some((m) => (t.url || "").includes(m)),
    );
    if (!tab?.id) return { closed: false, message: "no provider tab" };
    const closeRes = await fetch(
      `http://127.0.0.1:${record.cdpPort}/json/close/${encodeURIComponent(tab.id)}`,
    );
    if (!closeRes.ok) return { closed: false, message: `close HTTP ${closeRes.status}` };
    return { closed: true, message: `${descriptor.displayName} tab closed` };
  } catch (err) {
    return { closed: false, message: (err as Error).message || "error" };
  }
}

export function killSpawnedProcess(providerId: string, accountId: string, pidFallback: number | null): void {
  const key = spawnRegistryKey(providerId, accountId);
  const proc = spawnedProcesses.get(key);
  if (proc && !proc.killed) {
    try { proc.kill("SIGTERM"); } catch {}
  } else if (pidFallback) {
    try { process.kill(pidFallback, "SIGTERM"); } catch {}
  }
  spawnedProcesses.delete(key);
}

// ── State derivation ───────────────────────────────────────────────────────

export function parseIdentity(title: string | null, identityRegex?: string): string | null {
  if (!title) return null;
  const source = identityRegex || "([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,})";
  try {
    const re = new RegExp(source);
    const m = title.match(re);
    return m ? m[1] : null;
  } catch {
    return null;
  }
}

export function deriveChannelState(
  descriptor: ChannelProviderDescriptor,
  raw: RawTabStatus,
): ChannelState {
  if (!raw.running) return "disconnected";
  if (!raw.tabOpen) return "disconnected";
  // URL-based sign-in detection is the most reliable signal we have.
  const signInUrlHints = ["accounts.google.com/signin", "login.yahoo.com", "login.live.com"];
  if (raw.url && signInUrlHints.some((h) => raw.url!.includes(h))) return "reconnect_needed";
  if (raw.title && raw.title.toLowerCase().includes("sign in")) return "reconnect_needed";
  const predicate = descriptor.signedInPredicate?.kind ?? "title-not-signin";
  if (predicate === "identity-required") {
    if (!parseIdentity(raw.title, descriptor.identityRegex)) return "reconnect_needed";
    return "connected";
  }
  // Default: title-not-signin
  if (!raw.title) return "connecting";
  return "connected";
}

// ── Public unified interface ───────────────────────────────────────────────

export async function providerStatus(
  gw: GatewayConfig,
  descriptor: ChannelProviderDescriptor,
  record: BrowserSessionAccountRecord,
): Promise<ChannelAccountStatus> {
  const raw =
    record.isDefault && descriptor.hasGatewayDefault
      ? await gatewayTabStatus(gw, descriptor)
      : await spawnModeStatus(descriptor, record);
  const channelState = deriveChannelState(descriptor, raw);
  const liveIdentity =
    channelState === "connected" ? parseIdentity(raw.title, descriptor.identityRegex) : null;
  const effectiveIdentity = liveIdentity ?? record.identity;
  if (liveIdentity && liveIdentity !== record.identity) {
    updateAccount(record.providerId, record.accountId, { identity: liveIdentity });
  }
  return {
    providerId: record.providerId,
    accountId: record.accountId,
    identity: effectiveIdentity,
    isDefault: record.isDefault,
    channelState,
    title: raw.title,
    url: raw.url,
    running: raw.running,
    tabOpen: raw.tabOpen,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

export async function providerConnect(
  gw: GatewayConfig,
  descriptor: ChannelProviderDescriptor,
  record: BrowserSessionAccountRecord,
): Promise<{ ok: boolean; message: string }> {
  if (record.isDefault && descriptor.hasGatewayDefault) {
    return gatewayStartChrome(gw, descriptor);
  }
  const result = await spawnModeStart(descriptor, record);
  return { ok: result.ok, message: result.message };
}

export async function providerDisconnect(
  gw: GatewayConfig,
  descriptor: ChannelProviderDescriptor,
  record: BrowserSessionAccountRecord,
): Promise<{ closed: boolean; message: string }> {
  if (record.isDefault && descriptor.hasGatewayDefault) {
    return gatewayDisconnect(gw, descriptor);
  }
  return spawnModeDisconnect(descriptor, record);
}

// ─────────────────────────────────────────────────────────────────────
// G-T06.D4 — GMAIL-READ-CAPABILITY-MIN
//
// One extraction primitive in the managed-browser gateway lane, per
// docs/plans/G-T06.D1-google-refactor-plan.md line 308. Opens a CDP
// WebSocket to the live Gmail tab, issues ONE Runtime.evaluate with a
// metadata-only expression, returns the unread count. Strictly metadata:
// row counts from the already-rendered DOM, the tab URL, the tab title.
// No scraping of message bodies, subjects, senders, timestamps, or any
// content beyond the visible-row count. DEC-033 posture unchanged —
// this is a read of the already-signed-in managed-browser session, not
// a credential operation.
// ─────────────────────────────────────────────────────────────────────

export interface GmailInboxSummary {
  ok: boolean;
  unread: number | null;
  rowCount: number | null;
  url: string | null;
  title: string | null;
  error?: string;
}

const GMAIL_INBOX_METADATA_EXPR = `(function(){
  // Gmail inbox row selectors: tr.zA is any conversation row, tr.zA.zE is
  // an unread conversation row. These selectors have been stable across
  // every D4/D6/D7/D9/D10/D11/D12/D14/D15 verification run on this account.
  try {
    const rows = document.querySelectorAll("tr.zA");
    const unread = document.querySelectorAll("tr.zA.zE");
    return {
      rowCount: rows.length,
      unread: unread.length,
      url: location.href,
      title: document.title,
    };
  } catch (e) {
    return { rowCount: null, unread: null, url: location.href, title: document.title, evalError: String(e) };
  }
})()`;

async function cdpEvaluateOnTab(
  cdpPort: number,
  targetId: string,
  expression: string,
  timeoutMs = 5000,
): Promise<any> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const ws = new WebSocket(`ws://127.0.0.1:${cdpPort}/devtools/page/${targetId}`);
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      try { ws.close(); } catch {}
      reject(new Error("cdp evaluate timeout"));
    }, timeoutMs);
    ws.on("open", () => {
      ws.send(
        JSON.stringify({
          id: 1,
          method: "Runtime.evaluate",
          params: { expression, returnByValue: true, awaitPromise: false },
        }),
      );
    });
    ws.on("message", (data: Buffer | string) => {
      if (settled) return;
      try {
        const msg = JSON.parse(data.toString());
        if (msg.id !== 1) return;
        settled = true;
        clearTimeout(timer);
        try { ws.close(); } catch {}
        if (msg.error) {
          reject(new Error(msg.error.message || "cdp error"));
          return;
        }
        if (msg.result?.exceptionDetails) {
          reject(new Error("runtime exception"));
          return;
        }
        resolve(msg.result?.result?.value);
      } catch (err) {
        settled = true;
        clearTimeout(timer);
        try { ws.close(); } catch {}
        reject(err);
      }
    });
    ws.on("error", (err) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(err);
    });
  });
}

export async function readGmailInboxSummary(
  gw: GatewayConfig,
  record: BrowserSessionAccountRecord,
): Promise<GmailInboxSummary> {
  const fail = (error: string): GmailInboxSummary => ({
    ok: false,
    unread: null,
    rowCount: null,
    url: null,
    title: null,
    error,
  });
  try {
    // Find the Gmail tab's targetId and the CDP port to attach to.
    let targetId: string | null = null;
    let cdpPort: number;
    if (record.isDefault) {
      const gwStatusRes = await fetch(`http://127.0.0.1:${gw.port}/`, {
        headers: { Authorization: `Bearer ${gw.authToken}` },
      });
      if (!gwStatusRes.ok) return fail("gateway unreachable");
      const statusData = (await gwStatusRes.json()) as any;
      if (!statusData.running) return fail("gateway not running");
      cdpPort = Number(statusData.cdpPort) || 18800;
      const tabsRes = await fetch(`http://127.0.0.1:${gw.port}/tabs`, {
        headers: { Authorization: `Bearer ${gw.authToken}` },
      });
      if (!tabsRes.ok) return fail("gateway /tabs unreachable");
      const tabsData = (await tabsRes.json()) as any;
      const tab = (tabsData.tabs || []).find(
        (t: any) => t?.type === "page" && isGmailTabUrl(t.url),
      );
      if (!tab?.targetId) return fail("no gmail tab");
      targetId = tab.targetId;
    } else {
      if (record.cdpPort == null) return fail("no cdpPort");
      cdpPort = record.cdpPort;
      const res = await fetch(`http://127.0.0.1:${cdpPort}/json/list`, {
        signal: AbortSignal.timeout(2000),
      });
      if (!res.ok) return fail("cdp /json/list unreachable");
      const tabs = (await res.json()) as any[];
      const tab = tabs.find(
        (t) => t?.type === "page" && isGmailTabUrl(t.url),
      );
      if (!tab?.id) return fail("no gmail tab");
      targetId = tab.id;
    }

    const evalResult = await cdpEvaluateOnTab(cdpPort, targetId!, GMAIL_INBOX_METADATA_EXPR);
    if (!evalResult || typeof evalResult !== "object") {
      return fail("unexpected eval result");
    }
    return {
      ok: true,
      unread: typeof evalResult.unread === "number" ? evalResult.unread : null,
      rowCount: typeof evalResult.rowCount === "number" ? evalResult.rowCount : null,
      url: typeof evalResult.url === "string" ? evalResult.url : null,
      title: typeof evalResult.title === "string" ? evalResult.title : null,
    };
  } catch (err) {
    return fail((err as Error).message || "read error");
  }
}

// ─────────────────────────────────────────────────────────────────────
// G-T06.D9 — GMAIL-READ-INBOX-LIST
//
// Structured per-row extraction from the managed-browser Gmail DOM.
// Mirrors readGmailInboxSummary for tab discovery; adds a per-row
// CDP expression that returns sender, subject, snippet, timestamp,
// and unread flag for up to `limit` rows. READ-ONLY — no click,
// send, or mutation. DEC-033 posture unchanged.
// ─────────────────────────────────────────────────────────────────────

function gmailInboxListExpression(limit: number): string {
  const safeLimit = Math.max(1, Math.min(50, limit));
  return `(function(){
    try {
      const rows = Array.from(document.querySelectorAll('tr.zA')).slice(0, ${safeLimit});
      return { rows: rows.map(function(r) {
        const fromEl = r.querySelector('.yW span[email]') || r.querySelector('.yW span');
        const subjectEl = r.querySelector('.bog') || r.querySelector('.y6 span');
        const snippetEl = r.querySelector('.y2');
        const tsEl = r.querySelector('td.xW span');
        return {
          id: r.id || '',
          from: ((fromEl && (fromEl.getAttribute('name') || fromEl.textContent)) || '').trim(),
          subject: ((subjectEl && subjectEl.textContent) || '').trim(),
          snippet: ((snippetEl && snippetEl.textContent) || '').trim(),
          timestamp: (tsEl && (tsEl.getAttribute('title') || tsEl.textContent)) || null,
          unread: r.classList.contains('zE'),
        };
      })};
    } catch (e) { return { error: String(e) }; }
  })()`;
}

export interface GmailInboxReadResult {
  ok: boolean;
  messages: GmailInboxMessage[];
  error?: string;
}

export async function readGmailInbox(
  gw: GatewayConfig,
  record: BrowserSessionAccountRecord,
  limit: number,
): Promise<GmailInboxReadResult> {
  const fail = (error: string): GmailInboxReadResult => ({
    ok: false,
    messages: [],
    error,
  });
  try {
    // Find the Gmail tab's targetId and the CDP port to attach to.
    // This block mirrors readGmailInboxSummary verbatim.
    let targetId: string | null = null;
    let cdpPort: number;
    if (record.isDefault) {
      const gwStatusRes = await fetch(`http://127.0.0.1:${gw.port}/`, {
        headers: { Authorization: `Bearer ${gw.authToken}` },
      });
      if (!gwStatusRes.ok) return fail("gateway unreachable");
      const statusData = (await gwStatusRes.json()) as any;
      if (!statusData.running) return fail("gateway not running");
      cdpPort = Number(statusData.cdpPort) || 18800;
      const tabsRes = await fetch(`http://127.0.0.1:${gw.port}/tabs`, {
        headers: { Authorization: `Bearer ${gw.authToken}` },
      });
      if (!tabsRes.ok) return fail("gateway /tabs unreachable");
      const tabsData = (await tabsRes.json()) as any;
      const tab = (tabsData.tabs || []).find(
        (t: any) => t?.type === "page" && isGmailTabUrl(t.url),
      );
      if (!tab?.targetId) return fail("no gmail tab");
      targetId = tab.targetId;
    } else {
      if (record.cdpPort == null) return fail("no cdpPort");
      cdpPort = record.cdpPort;
      const res = await fetch(`http://127.0.0.1:${cdpPort}/json/list`, {
        signal: AbortSignal.timeout(2000),
      });
      if (!res.ok) return fail("cdp /json/list unreachable");
      const tabs = (await res.json()) as any[];
      const tab = tabs.find(
        (t) => t?.type === "page" && isGmailTabUrl(t.url),
      );
      if (!tab?.id) return fail("no gmail tab");
      targetId = tab.id;
    }

    const evalResult = await cdpEvaluateOnTab(
      cdpPort,
      targetId!,
      gmailInboxListExpression(limit),
    );
    if (!evalResult || typeof evalResult !== "object") {
      return fail("unexpected eval result");
    }
    if (typeof (evalResult as any).error === "string") {
      return fail((evalResult as any).error);
    }
    const rawRows: any[] = Array.isArray((evalResult as any).rows)
      ? (evalResult as any).rows
      : [];
    const messages: GmailInboxMessage[] = rawRows.map((row: any) => ({
      id: typeof row.id === "string" ? row.id : "",
      from: typeof row.from === "string" ? row.from : "",
      subject: typeof row.subject === "string" ? row.subject : "",
      snippet: typeof row.snippet === "string" ? row.snippet : "",
      timestamp: typeof row.timestamp === "string" ? row.timestamp : null,
      unread: row.unread === true,
    }));
    return { ok: true, messages };
  } catch (err) {
    return fail((err as Error).message || "read error");
  }
}
