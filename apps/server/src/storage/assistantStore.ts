/**
 * Assistant Store
 *
 * Persistent storage for briefings (inbound task requests) and their
 * activity/approval lifecycle. Pure storage — no HTTP, no LLM, no side-effects.
 *
 * File layout:
 *   data/assistant/briefings.json
 *   data/assistant/activity.json
 */

import { readFile, writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { randomBytes } from 'crypto';
import path from 'path';

// ─── Paths ────────────────────────────────────────────────────────────────────

const DATA_DIR = path.join(process.cwd(), 'data');
const ASSISTANT_DIR = path.join(DATA_DIR, 'assistant');
const BRIEFINGS_FILE = path.join(ASSISTANT_DIR, 'briefings.json');
const ACTIVITY_FILE = path.join(ASSISTANT_DIR, 'activity.json');

// ─── Types ────────────────────────────────────────────────────────────────────

export type BriefingState =
  | 'safe_to_do_automatically'
  | 'needs_clarification'
  | 'needs_approval'
  | 'blocked';

export type ApprovalStatus = 'pending' | 'approved' | 'rejected' | 'not_required';

export type ActivityKind = 'intake' | 'approved' | 'rejected';

export interface Briefing {
  id: string;                       // e.g. `brf_<hex>`
  rawText: string;
  sourceChannel: string | null;     // e.g. "web", "email", null
  requestedStartTime: string | null; // ISO datetime or null
  state: BriefingState;
  stateReason: string;              // human-readable explanation
  approvalRequired: boolean;
  approvalStatus: ApprovalStatus;
  createdAt: string;                // ISO
  updatedAt: string;                // ISO
}

export interface BriefingActivity {
  id: string;                       // e.g. `act_<hex>`
  briefingId: string;
  kind: ActivityKind;
  note: string;
  at: string;                       // ISO
}

// ─── ID helpers ───────────────────────────────────────────────────────────────

function makeBriefingId(): string {
  return 'brf_' + randomBytes(8).toString('hex');
}

function makeActivityId(): string {
  return 'act_' + randomBytes(8).toString('hex');
}

// ─── Init ─────────────────────────────────────────────────────────────────────

export async function initAssistantStore(): Promise<void> {
  try {
    if (!existsSync(DATA_DIR)) {
      await mkdir(DATA_DIR, { recursive: true });
    }
    if (!existsSync(ASSISTANT_DIR)) {
      await mkdir(ASSISTANT_DIR, { recursive: true });
    }
    if (!existsSync(BRIEFINGS_FILE)) {
      await writeFile(BRIEFINGS_FILE, JSON.stringify({ briefings: [] }, null, 2), 'utf-8');
    }
    if (!existsSync(ACTIVITY_FILE)) {
      await writeFile(ACTIVITY_FILE, JSON.stringify({ activity: [] }, null, 2), 'utf-8');
    }
    console.log('[AssistantStore] Initialized');
  } catch (error) {
    console.error('[AssistantStore] Failed to initialize:', error);
    throw error;
  }
}

// ─── Low-level file I/O ───────────────────────────────────────────────────────

async function loadBriefings(): Promise<Briefing[]> {
  try {
    if (!existsSync(BRIEFINGS_FILE)) return [];
    const content = await readFile(BRIEFINGS_FILE, 'utf-8');
    const data = JSON.parse(content);
    return Array.isArray(data.briefings) ? data.briefings : [];
  } catch {
    return [];
  }
}

async function saveBriefings(briefings: Briefing[]): Promise<void> {
  // Newest first
  briefings.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  await writeFile(
    BRIEFINGS_FILE,
    JSON.stringify({ briefings, lastUpdated: new Date().toISOString() }, null, 2),
    'utf-8',
  );
}

async function loadActivity(): Promise<BriefingActivity[]> {
  try {
    if (!existsSync(ACTIVITY_FILE)) return [];
    const content = await readFile(ACTIVITY_FILE, 'utf-8');
    const data = JSON.parse(content);
    return Array.isArray(data.activity) ? data.activity : [];
  } catch {
    return [];
  }
}

async function saveActivity(activity: BriefingActivity[]): Promise<void> {
  // Newest first
  activity.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
  await writeFile(
    ACTIVITY_FILE,
    JSON.stringify({ activity, lastUpdated: new Date().toISOString() }, null, 2),
    'utf-8',
  );
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Create a new briefing, auto-set approvalStatus, and append an intake
 * activity entry. Persists both files.
 */
export async function createBriefing(input: {
  rawText: string;
  sourceChannel: string | null;
  requestedStartTime: string | null;
  state: BriefingState;
  stateReason: string;
  approvalRequired: boolean;
}): Promise<Briefing> {
  const now = new Date().toISOString();

  const briefing: Briefing = {
    id: makeBriefingId(),
    rawText: input.rawText,
    sourceChannel: input.sourceChannel,
    requestedStartTime: input.requestedStartTime,
    state: input.state,
    stateReason: input.stateReason,
    approvalRequired: input.approvalRequired,
    approvalStatus: input.approvalRequired ? 'pending' : 'not_required',
    createdAt: now,
    updatedAt: now,
  };

  const briefings = await loadBriefings();
  briefings.push(briefing);
  await saveBriefings(briefings);

  // Append intake activity entry
  const activity = await loadActivity();
  activity.push({
    id: makeActivityId(),
    briefingId: briefing.id,
    kind: 'intake',
    note: `Briefing received via ${input.sourceChannel ?? 'unknown'}: "${input.rawText.slice(0, 80)}${input.rawText.length > 80 ? '…' : ''}"`,
    at: now,
  });
  await saveActivity(activity);

  return briefing;
}

/**
 * Return all briefings, newest first.
 */
export async function listBriefings(): Promise<Briefing[]> {
  return loadBriefings();
}

/**
 * Return a single briefing by id, or null if not found.
 */
export async function getBriefingById(id: string): Promise<Briefing | null> {
  const briefings = await loadBriefings();
  return briefings.find((b) => b.id === id) ?? null;
}

/**
 * Return all briefings where approvalStatus === 'pending'.
 */
export async function listPendingApprovals(): Promise<Briefing[]> {
  const briefings = await loadBriefings();
  return briefings.filter((b) => b.approvalStatus === 'pending');
}

/**
 * Update approvalStatus on a briefing and append an activity entry.
 * Returns the updated briefing, or null if the id is not found.
 */
export async function setApprovalStatus(
  id: string,
  status: 'approved' | 'rejected',
  note?: string,
): Promise<Briefing | null> {
  const briefings = await loadBriefings();
  const idx = briefings.findIndex((b) => b.id === id);
  if (idx === -1) return null;

  const now = new Date().toISOString();
  briefings[idx] = {
    ...briefings[idx],
    approvalStatus: status,
    updatedAt: now,
  };
  await saveBriefings(briefings);

  // Append approval/rejection activity entry
  const activity = await loadActivity();
  const kind: ActivityKind = status === 'approved' ? 'approved' : 'rejected';
  activity.push({
    id: makeActivityId(),
    briefingId: id,
    kind,
    note: note ?? `Briefing ${kind}.`,
    at: now,
  });
  await saveActivity(activity);

  return briefings[idx];
}

/**
 * Return all activity entries, optionally filtered to a single briefing.
 * Newest first.
 */
export async function listActivity(briefingId?: string): Promise<BriefingActivity[]> {
  const activity = await loadActivity();
  if (briefingId !== undefined) {
    return activity.filter((a) => a.briefingId === briefingId);
  }
  return activity;
}
