/**
 * Auth/Connect Orchestrator — M-CP-4.
 *
 * Pure control-plane orchestration logic. Enumerates admissible founder-safe
 * connect methods per provider by reading the channels descriptor registry,
 * rejects founder-unsafe payload shapes, and returns a truthful
 * (state, stateReason, founderSafe, forbiddenReason) tuple the store
 * persists.
 *
 * This service MUST NOT:
 *  - initiate any external provider connection
 *  - handle, store, or log any secret / credential / token / file
 *  - prompt the founder for clientId / clientSecret / API key / dev-console
 *  - bypass the founder-safe posture in any form
 *
 * Mapping between channels AuthStrategy and M-CP-4 admissible methods:
 *   browser-session-gateway | browser-session-spawn  ->  browser_oauth
 *   qr-scan                                          ->  qr
 *   placeholder                                      ->  (unsupported)
 */

import { CHANNEL_PROVIDERS } from "../channels/registry.js";
import type { ChannelProviderDescriptor } from "@shared/core";
import type {
  AuthConnectMethod,
  AuthConnectState,
} from "../storage/authConnectStore.js";

export interface ProviderMethodSummary {
  providerId: string;
  displayName: string;
  category: string;
  admissibleMethods: AuthConnectMethod[];
  admissible: boolean;
  reason: string;
}

/**
 * Map a descriptor's authStrategy onto the M-CP-4 admissible method set.
 * Only browser_oauth and qr are admissible; placeholder is explicitly
 * unsupported.
 */
function mapStrategy(descriptor: ChannelProviderDescriptor): {
  methods: AuthConnectMethod[];
  admissible: boolean;
  reason: string;
} {
  switch (descriptor.authStrategy) {
    case "browser-session-gateway":
    case "browser-session-spawn":
      return {
        methods: ["browser_oauth"],
        admissible: true,
        reason: "Provider supports founder-safe browser OAuth via managed Chrome session.",
      };
    case "qr-scan":
      return {
        methods: ["qr"],
        admissible: true,
        reason: "Provider supports founder-safe QR scan.",
      };
    case "placeholder":
      return {
        methods: [],
        admissible: false,
        reason: "Provider is a registry placeholder; no founder-safe method is wired yet.",
      };
    default:
      return {
        methods: [],
        admissible: false,
        reason: "Provider authStrategy is not recognized as founder-safe.",
      };
  }
}

export function listProviderMethodSummaries(): ProviderMethodSummary[] {
  return Object.values(CHANNEL_PROVIDERS)
    .sort((a, b) => (a.uiOrder ?? 1000) - (b.uiOrder ?? 1000))
    .map((d) => {
      const m = mapStrategy(d);
      return {
        providerId: d.providerId,
        displayName: d.displayName,
        category: d.category,
        admissibleMethods: m.methods,
        admissible: m.admissible,
        reason: m.reason,
      };
    });
}

export function getProviderMethodSummary(
  providerId: string,
): ProviderMethodSummary | null {
  const d = CHANNEL_PROVIDERS[providerId];
  if (!d) return null;
  const m = mapStrategy(d);
  return {
    providerId: d.providerId,
    displayName: d.displayName,
    category: d.category,
    admissibleMethods: m.methods,
    admissible: m.admissible,
    reason: m.reason,
  };
}

// ─── Founder-safety guard ─────────────────────────────────────────────────────
//
// Hard-rejects any payload that looks like secret/credential-file/manual-token
// material. Matching is case-insensitive on top-level keys of the input record
// so an attacker cannot smuggle a secret by renaming ("clientSecret" vs
// "client_secret" vs "CLIENTSECRET" are all rejected).

const FORBIDDEN_KEYS_LOWER: readonly string[] = [
  "clientid",
  "client_id",
  "clientsecret",
  "client_secret",
  "apikey",
  "api_key",
  "apitoken",
  "api_token",
  "token",
  "accesstoken",
  "access_token",
  "refreshtoken",
  "refresh_token",
  "credentials",
  "credentialsfile",
  "credentials_file",
  "credentialsjson",
  "credentials_json",
  "credentialspath",
  "credentials_path",
  "keyfile",
  "key_file",
  "keypath",
  "key_path",
  "servicekey",
  "service_key",
  "serviceaccount",
  "service_account",
  "privatekey",
  "private_key",
  "pem",
  "secret",
  "password",
  "pin",
  "devicecode",
  "device_code",
  "manualcode",
  "manual_code",
  "manualtoken",
  "manual_token",
  "verifier",
  "authcode",
  "auth_code",
];

export interface FounderSafetyCheck {
  ok: boolean;
  forbiddenKey: string | null;
  reason: string | null;
}

export function detectFounderUnsafe(
  body: Record<string, unknown>,
): FounderSafetyCheck {
  for (const key of Object.keys(body)) {
    const normalized = key.toLowerCase().replace(/[-\s]/g, "");
    if (FORBIDDEN_KEYS_LOWER.includes(normalized)) {
      return {
        ok: false,
        forbiddenKey: key,
        reason: `Founder-unsafe field "${key}" is not allowed. AKIOR orchestration accepts only provider + method (browser_oauth or qr); secrets, credential files, manual tokens, and device codes are rejected by contract.`,
      };
    }
  }
  return { ok: true, forbiddenKey: null, reason: null };
}

// ─── Classification for a new orchestration request ───────────────────────────

export interface ClassifyRequestInput {
  provider: string;
  method: AuthConnectMethod;
  body: Record<string, unknown>;
}

export interface ClassifyRequestResult {
  state: AuthConnectState;
  stateReason: string;
  founderSafe: boolean;
  forbiddenReason: string | null;
}

export function classifyOrchestrationRequest(
  input: ClassifyRequestInput,
): ClassifyRequestResult {
  // Rule 1: reject founder-unsafe shape up front — record it as blocked so
  // history keeps the attempt visible to the reviewer.
  const safety = detectFounderUnsafe(input.body);
  if (!safety.ok) {
    return {
      state: "blocked",
      stateReason: safety.reason ?? "Founder-unsafe payload rejected.",
      founderSafe: false,
      forbiddenReason: safety.reason,
    };
  }

  // Rule 2: unknown provider
  const summary = getProviderMethodSummary(input.provider);
  if (!summary) {
    return {
      state: "unsupported",
      stateReason: `Provider "${input.provider}" is not registered in the channels descriptor table.`,
      founderSafe: true,
      forbiddenReason: null,
    };
  }

  // Rule 3: provider has no admissible founder-safe method
  if (!summary.admissible || summary.admissibleMethods.length === 0) {
    return {
      state: "unsupported",
      stateReason: summary.reason,
      founderSafe: true,
      forbiddenReason: null,
    };
  }

  // Rule 4: requested method must match an admissible one for this provider
  if (!summary.admissibleMethods.includes(input.method)) {
    return {
      state: "blocked",
      stateReason: `Method "${input.method}" is not admissible for provider "${input.provider}". Admissible: ${summary.admissibleMethods.join(", ")}.`,
      founderSafe: true,
      forbiddenReason: null,
    };
  }

  // Rule 5: everything checks out — the orchestration record is pending a
  // founder-initiated UI Connect click. This service DOES NOT initiate the
  // external connect; that lives in the existing channels wrapper.
  return {
    state: "pending",
    stateReason: `Orchestration record ready. Founder completes the connect via the AKIOR UI "Connect ${summary.displayName}" affordance using ${input.method === "qr" ? "QR scan" : "browser OAuth"}. AKIOR never handles clientId, clientSecret, API key, credential files, or developer-console steps.`,
    founderSafe: true,
    forbiddenReason: null,
  };
}
