/**
 * Status Registry Store — M-CP-3 UNIFIED STATUS REGISTRY.
 *
 * Control-plane persistence for a small, fixed registry of already-landed
 * AKIOR-owned capabilities. Pure storage — no HTTP, no external fetch, no
 * runtime ping, no history timeline, no receipt index, no notification
 * delivery, no scheduler coupling.
 *
 * Persisted fields are the CURRENT status per capability plus the last
 * check-in metadata only; this store deliberately does NOT keep an
 * append-only history list — that belongs to M-CP-9.
 *
 * Pattern mirrors apps/server/src/storage/authConnectStore.ts (PR #137)
 * and apps/server/src/storage/admissionCandidateStore.ts (PR #135).
 */

import { readFile, writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), 'data');
const STATUS_REGISTRY_DIR = path.join(DATA_DIR, 'status-registry');
const CAPABILITIES_FILE = path.join(STATUS_REGISTRY_DIR, 'capabilities.json');

// ─── Types ────────────────────────────────────────────────────────────────────

export type CapabilityStatus = 'unknown' | 'healthy' | 'degraded' | 'down';

export interface CapabilityRecord {
  capabilityId: string;
  displayName: string;
  status: CapabilityStatus;
  statusReason: string;
  lastCheckInAt: string | null;
  lastCheckInActor: string | null;
  createdAt: string;
  updatedAt: string;
}

// ─── Fixed known-capability catalog ───────────────────────────────────────────
//
// Seeded from capabilities already landed on main. Any widening here requires
// a new M-CP lane — this store will NEVER auto-discover capabilities at
// runtime.

export interface KnownCapability {
  capabilityId: string;
  displayName: string;
}

export const KNOWN_CAPABILITIES: readonly KnownCapability[] = [
  { capabilityId: 'assistant', displayName: 'Assistant (briefings + approvals)' },
  { capabilityId: 'admission-candidates', displayName: 'Admission Candidates (supply-chain gate)' },
  { capabilityId: 'auth-connect', displayName: 'Auth/Connect Orchestrator' },
] as const;

export const KNOWN_CAPABILITY_IDS: readonly string[] = KNOWN_CAPABILITIES.map(
  (k) => k.capabilityId,
);

export const CAPABILITY_STATUSES: readonly CapabilityStatus[] = [
  'unknown',
  'healthy',
  'degraded',
  'down',
];

export function isValidStatus(s: unknown): s is CapabilityStatus {
  return typeof s === 'string' && (CAPABILITY_STATUSES as readonly string[]).includes(s);
}

// ─── Init ─────────────────────────────────────────────────────────────────────

async function createIfMissing(filePath: string, initialContent: string): Promise<void> {
  try {
    await writeFile(filePath, initialContent, { encoding: 'utf-8', flag: 'wx' });
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException)?.code === 'EEXIST') return;
    throw err;
  }
}

function seedRecords(): CapabilityRecord[] {
  const now = new Date().toISOString();
  return KNOWN_CAPABILITIES.map((k) => ({
    capabilityId: k.capabilityId,
    displayName: k.displayName,
    status: 'unknown',
    statusReason: 'No check-in received yet.',
    lastCheckInAt: null,
    lastCheckInActor: null,
    createdAt: now,
    updatedAt: now,
  }));
}

export async function initStatusRegistryStore(): Promise<void> {
  try {
    await mkdir(STATUS_REGISTRY_DIR, { recursive: true });
    await createIfMissing(
      CAPABILITIES_FILE,
      JSON.stringify({ capabilities: seedRecords() }, null, 2),
    );

    // On re-boot, ensure any newly-known capability added to the catalog
    // appears in the stored list at `unknown`. This never drops or mutates
    // existing records — pure additive reconcile.
    const existing = await loadCapabilities();
    const existingIds = new Set(existing.map((r) => r.capabilityId));
    const missing = KNOWN_CAPABILITIES.filter(
      (k) => !existingIds.has(k.capabilityId),
    );
    if (missing.length > 0) {
      const now = new Date().toISOString();
      const added: CapabilityRecord[] = missing.map((k) => ({
        capabilityId: k.capabilityId,
        displayName: k.displayName,
        status: 'unknown',
        statusReason: 'No check-in received yet.',
        lastCheckInAt: null,
        lastCheckInActor: null,
        createdAt: now,
        updatedAt: now,
      }));
      await saveCapabilities([...existing, ...added]);
    }
    console.log('[StatusRegistryStore] Initialized');
  } catch (error) {
    console.error('[StatusRegistryStore] Failed to initialize:', error);
    throw error;
  }
}

// ─── File I/O ─────────────────────────────────────────────────────────────────

async function loadCapabilities(): Promise<CapabilityRecord[]> {
  try {
    if (!existsSync(CAPABILITIES_FILE)) return [];
    const content = await readFile(CAPABILITIES_FILE, 'utf-8');
    const data = JSON.parse(content);
    return Array.isArray(data.capabilities) ? data.capabilities : [];
  } catch {
    return [];
  }
}

async function saveCapabilities(records: CapabilityRecord[]): Promise<void> {
  // Stable ordering — match the catalog order so the list is deterministic.
  const orderIndex = new Map<string, number>(
    KNOWN_CAPABILITY_IDS.map((id, idx) => [id, idx]),
  );
  records.sort(
    (a, b) =>
      (orderIndex.get(a.capabilityId) ?? 999) -
      (orderIndex.get(b.capabilityId) ?? 999),
  );
  await writeFile(
    CAPABILITIES_FILE,
    JSON.stringify(
      { capabilities: records, lastUpdated: new Date().toISOString() },
      null,
      2,
    ),
    'utf-8',
  );
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function listStatus(): Promise<CapabilityRecord[]> {
  return loadCapabilities();
}

export async function getStatusById(
  capabilityId: string,
): Promise<CapabilityRecord | null> {
  const all = await loadCapabilities();
  return all.find((r) => r.capabilityId === capabilityId) ?? null;
}

export interface CheckInInput {
  capabilityId: string;
  status: CapabilityStatus;
  statusReason: string;
  actor: string;
}

export async function recordCheckIn(
  input: CheckInInput,
): Promise<CapabilityRecord | null> {
  const all = await loadCapabilities();
  const idx = all.findIndex((r) => r.capabilityId === input.capabilityId);
  if (idx === -1) return null;
  const now = new Date().toISOString();
  const updated: CapabilityRecord = {
    ...all[idx],
    status: input.status,
    statusReason: input.statusReason,
    lastCheckInAt: now,
    lastCheckInActor: input.actor,
    updatedAt: now,
  };
  all[idx] = updated;
  await saveCapabilities(all);
  return updated;
}
