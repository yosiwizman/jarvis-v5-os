/**
 * Status Registry Service — M-CP-3.
 *
 * Pure control-plane classification for check-in requests. Validates the
 * caller's `capabilityId` against the fixed known-capability catalog and
 * validates the `status` token against the admissible status union. Returns
 * a truthful (ok, reason) tuple the route layer can convert into an HTTP
 * response or pass to the store.
 *
 * This service MUST NOT:
 *  - ping, fetch, or probe any capability
 *  - couple to the notification sink, scheduler, or receipt index
 *  - keep history / activity / timeline records
 *  - touch provider/runtime code
 */

import {
  KNOWN_CAPABILITIES,
  KNOWN_CAPABILITY_IDS,
  CAPABILITY_STATUSES,
  isValidStatus,
  type CapabilityStatus,
  type KnownCapability,
} from '../storage/statusRegistryStore.js';

export function isKnownCapability(capabilityId: string): boolean {
  return (KNOWN_CAPABILITY_IDS as readonly string[]).includes(capabilityId);
}

export function listKnownCapabilities(): readonly KnownCapability[] {
  return KNOWN_CAPABILITIES;
}

// ─── Check-in validation ──────────────────────────────────────────────────────

export interface ValidateCheckInInput {
  capabilityId: string;
  status: unknown;
  statusReason?: unknown;
}

export interface ValidateCheckInResult {
  ok: boolean;
  reason: string | null;
  status: CapabilityStatus | null;
  statusReason: string | null;
  forbiddenField: 'capabilityId' | 'status' | 'statusReason' | null;
}

const MAX_REASON_LEN = 500;

export function validateCheckInRequest(
  input: ValidateCheckInInput,
): ValidateCheckInResult {
  // Rule 1: capabilityId must be in the fixed catalog.
  if (!isKnownCapability(input.capabilityId)) {
    return {
      ok: false,
      reason: `Capability "${input.capabilityId}" is not in the known registry. Known: ${KNOWN_CAPABILITY_IDS.join(', ')}.`,
      status: null,
      statusReason: null,
      forbiddenField: 'capabilityId',
    };
  }

  // Rule 2: status must match the admissible union.
  if (!isValidStatus(input.status)) {
    return {
      ok: false,
      reason: `Invalid status "${String(input.status)}". Admissible: ${CAPABILITY_STATUSES.join(', ')}.`,
      status: null,
      statusReason: null,
      forbiddenField: 'status',
    };
  }

  // Rule 3: statusReason is optional but must be a string with bounded length
  // when present. A missing / blank reason gets a deterministic default.
  const rawReason = input.statusReason;
  let reasonStr: string;
  if (rawReason === undefined || rawReason === null || rawReason === '') {
    reasonStr = `Status "${input.status}" reported by check-in.`;
  } else if (typeof rawReason !== 'string') {
    return {
      ok: false,
      reason: 'statusReason must be a string when provided.',
      status: null,
      statusReason: null,
      forbiddenField: 'statusReason',
    };
  } else if (rawReason.length > MAX_REASON_LEN) {
    return {
      ok: false,
      reason: `statusReason exceeds max length ${MAX_REASON_LEN}.`,
      status: null,
      statusReason: null,
      forbiddenField: 'statusReason',
    };
  } else {
    reasonStr = rawReason;
  }

  return {
    ok: true,
    reason: null,
    status: input.status,
    statusReason: reasonStr,
    forbiddenField: null,
  };
}
