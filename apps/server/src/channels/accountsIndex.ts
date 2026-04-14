// G-T06.D9: Unified accounts index with safe migration from the legacy
// per-provider index files (google-accounts.json, yahoo-accounts.json).
//
// Storage layout:
//   apps/server/data/channels/
//     accounts.json         <-- unified index (version 2)
//     google-accounts.json  <-- legacy v1 (read-only after migration)
//     yahoo-accounts.json   <-- legacy v1 (read-only after migration)
//
// Migration rule: on first read, if accounts.json is missing but one or both
// legacy files exist, merge them into accounts.json and tag each entry with
// its providerId. Legacy files are NOT deleted; a future bounded slice can
// reclaim them once cross-instance confidence is established.

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import path from "path";
import type { BrowserSessionAccountRecord, UnifiedAccountsIndex } from "@shared/core";
import { getProviderDescriptor } from "./registry.js";

const DATA_DIR = path.join(process.cwd(), "data");
export const CHANNELS_DIR = path.join(DATA_DIR, "channels");
export const UNIFIED_INDEX_PATH = path.join(CHANNELS_DIR, "accounts.json");
export const LEGACY_GOOGLE_INDEX_PATH = path.join(CHANNELS_DIR, "google-accounts.json");
export const LEGACY_YAHOO_INDEX_PATH = path.join(CHANNELS_DIR, "yahoo-accounts.json");

export const BROWSER_PROFILE_ROOT = path.join(process.env.HOME || "", ".openclaw", "browser", "openclaw");
export const GATEWAY_DEFAULT_PROFILE_DIR = path.join(BROWSER_PROFILE_ROOT, "user-data");

function ensureChannelsDir(): void {
  if (!existsSync(CHANNELS_DIR)) mkdirSync(CHANNELS_DIR, { recursive: true });
}

function readLegacyGoogleAccounts(): BrowserSessionAccountRecord[] {
  if (!existsSync(LEGACY_GOOGLE_INDEX_PATH)) return [];
  try {
    const raw = readFileSync(LEGACY_GOOGLE_INDEX_PATH, "utf-8");
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.accounts)) return [];
    return parsed.accounts.map((a: any) => ({
      providerId: "gmail",
      accountId: String(a.accountId),
      identity: a.identity ?? null,
      isDefault: Boolean(a.isDefault),
      profileDir: String(a.profileDir),
      cdpPort: typeof a.cdpPort === "number" ? a.cdpPort : null,
      pid: typeof a.pid === "number" ? a.pid : null,
      createdAt: String(a.createdAt || new Date().toISOString()),
      updatedAt: String(a.updatedAt || new Date().toISOString()),
    }));
  } catch {
    return [];
  }
}

function readLegacyYahooAccounts(): BrowserSessionAccountRecord[] {
  if (!existsSync(LEGACY_YAHOO_INDEX_PATH)) return [];
  try {
    const raw = readFileSync(LEGACY_YAHOO_INDEX_PATH, "utf-8");
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.accounts)) return [];
    return parsed.accounts.map((a: any) => ({
      providerId: "yahoo",
      accountId: String(a.accountId),
      identity: a.identity ?? null,
      isDefault: false,
      profileDir: String(a.profileDir),
      cdpPort: typeof a.cdpPort === "number" ? a.cdpPort : null,
      pid: typeof a.pid === "number" ? a.pid : null,
      createdAt: String(a.createdAt || new Date().toISOString()),
      updatedAt: String(a.updatedAt || new Date().toISOString()),
    }));
  } catch {
    return [];
  }
}

export function loadUnifiedAccountsIndex(): UnifiedAccountsIndex {
  ensureChannelsDir();
  if (existsSync(UNIFIED_INDEX_PATH)) {
    try {
      const raw = readFileSync(UNIFIED_INDEX_PATH, "utf-8");
      const parsed = JSON.parse(raw);
      if (parsed && parsed.version === 2 && Array.isArray(parsed.accounts)) {
        return parsed as UnifiedAccountsIndex;
      }
    } catch {}
  }
  // Migration path: build a v2 index from any legacy files present.
  const migrated: UnifiedAccountsIndex = {
    version: 2,
    accounts: [...readLegacyGoogleAccounts(), ...readLegacyYahooAccounts()],
  };
  saveUnifiedAccountsIndex(migrated);
  return migrated;
}

export function saveUnifiedAccountsIndex(idx: UnifiedAccountsIndex): void {
  ensureChannelsDir();
  writeFileSync(UNIFIED_INDEX_PATH, JSON.stringify(idx, null, 2), "utf-8");
}

export function ensureGatewayDefaultAccount(): BrowserSessionAccountRecord {
  const idx = loadUnifiedAccountsIndex();
  const existing = idx.accounts.find((a) => a.providerId === "gmail" && a.isDefault);
  if (existing) return existing;
  const descriptor = getProviderDescriptor("gmail");
  if (!descriptor || !descriptor.hasGatewayDefault) {
    throw new Error("gmail descriptor missing or not gateway-backed");
  }
  const now = new Date().toISOString();
  const record: BrowserSessionAccountRecord = {
    providerId: "gmail",
    accountId: "acc_default",
    identity: null,
    isDefault: true,
    profileDir: GATEWAY_DEFAULT_PROFILE_DIR,
    cdpPort: null,
    pid: null,
    createdAt: now,
    updatedAt: now,
  };
  idx.accounts.push(record);
  saveUnifiedAccountsIndex(idx);
  return record;
}

export function listAccountsByProvider(providerId: string): BrowserSessionAccountRecord[] {
  const idx = loadUnifiedAccountsIndex();
  return idx.accounts.filter((a) => a.providerId === providerId);
}

export function getAccountById(
  providerId: string,
  accountId: string,
): BrowserSessionAccountRecord | null {
  const idx = loadUnifiedAccountsIndex();
  return idx.accounts.find((a) => a.providerId === providerId && a.accountId === accountId) || null;
}

// CodeQL js/path-injection hardening (browserSession.ts:188 sink via
// record.profileDir). The profileDir path is constructed from:
//   providerId          — URL param `/api/channels/:providerId/...`
//   profileDirPrefix    — from the static registry descriptor
//   accountId           — generated below (locally scoped, no user input)
// The only externally-tainted input is `providerId`. Even though
// `getProviderDescriptor()` below will throw on unknown ids, we apply
// defence-in-depth and reject anything that could alter the path shape
// (traversal, slashes, NUL, whitespace). Strict allowlist: lowercase
// alphanumeric + `_` / `-`, 1-32 chars — same shape used by the
// registry's concrete providerIds (gmail / yahoo / outlook / ...).
const PROVIDER_ID_REGEX = /^[a-z0-9_-]{1,32}$/;

export function mintAccount(providerId: string): BrowserSessionAccountRecord {
  if (typeof providerId !== "string" || !PROVIDER_ID_REGEX.test(providerId)) {
    throw new Error(`invalid providerId shape: ${JSON.stringify(providerId)}`);
  }
  const descriptor = getProviderDescriptor(providerId);
  if (!descriptor) throw new Error(`unknown providerId: ${providerId}`);
  if (descriptor.authStrategy !== "browser-session-spawn") {
    throw new Error(`cannot mint account for non-spawn provider: ${providerId}`);
  }
  const portBase = descriptor.cdpPortBase ?? 19000;
  const prefix = descriptor.profileDirPrefix ?? `user-data-${providerId}`;
  // The prefix comes from the static registry descriptor (safe), with a
  // fallback concatenation of providerId which is now regex-validated.
  // Reject any prefix that contains path separators or traversal segments
  // so that a future registry mistake cannot bypass this guard.
  if (/[\/\\]|\.\./.test(prefix)) {
    throw new Error(`unsafe profileDirPrefix for provider ${providerId}`);
  }

  const idx = loadUnifiedAccountsIndex();
  const usedPorts = new Set<number>(
    idx.accounts.map((a) => a.cdpPort).filter((p): p is number => typeof p === "number"),
  );
  let cdpPort = portBase;
  while (usedPorts.has(cdpPort)) cdpPort++;

  const accountId = `${providerId.slice(0, 4)}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  const profileDir = path.join(BROWSER_PROFILE_ROOT, `${prefix}-${accountId}`);
  const now = new Date().toISOString();
  const record: BrowserSessionAccountRecord = {
    providerId,
    accountId,
    identity: null,
    isDefault: false,
    profileDir,
    cdpPort,
    pid: null,
    createdAt: now,
    updatedAt: now,
  };
  idx.accounts.push(record);
  saveUnifiedAccountsIndex(idx);
  return record;
}

export function updateAccount(
  providerId: string,
  accountId: string,
  patch: Partial<BrowserSessionAccountRecord>,
): void {
  const idx = loadUnifiedAccountsIndex();
  const acc = idx.accounts.find((a) => a.providerId === providerId && a.accountId === accountId);
  if (!acc) return;
  Object.assign(acc, patch, { updatedAt: new Date().toISOString() });
  saveUnifiedAccountsIndex(idx);
}

export function removeAccount(providerId: string, accountId: string): void {
  const idx = loadUnifiedAccountsIndex();
  const before = idx.accounts.length;
  idx.accounts = idx.accounts.filter(
    (a) => !(a.providerId === providerId && a.accountId === accountId),
  );
  if (idx.accounts.length !== before) saveUnifiedAccountsIndex(idx);
}
