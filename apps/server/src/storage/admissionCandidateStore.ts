/**
 * Admission Candidate Store — M-CP-10 SUPPLY-CHAIN-ADMISSION-GATE
 *
 * Control-plane persistence for candidate admission records. Pure storage —
 * no HTTP, no external fetch, no runtime install, no promotion side-effect.
 *
 * File layout:
 *   data/admission/candidates.json
 *   data/admission/activity.json
 *
 * Pattern mirrors apps/server/src/storage/assistantStore.ts (PR #134).
 */

import { readFile, writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { randomBytes } from 'crypto';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), 'data');
const ADMISSION_DIR = path.join(DATA_DIR, 'admission');
const CANDIDATES_FILE = path.join(ADMISSION_DIR, 'candidates.json');
const ACTIVITY_FILE = path.join(ADMISSION_DIR, 'activity.json');

// ─── Enums / Types ────────────────────────────────────────────────────────────

export type CandidateType = 'skill' | 'repo' | 'runtime' | 'package' | 'other';

export type SourceKind =
  | 'local_openclaw'
  | 'macmini_reference'
  | 'community'
  | 'current_akior'
  | 'other';

export type ProvenanceStatus = 'unknown' | 'documented' | 'verified';
export type InstallCountStatus = 'unknown' | 'insufficient' | 'acceptable';
export type SecurityReviewStatus =
  | 'not_started'
  | 'in_progress'
  | 'acceptable'
  | 'rejected';
export type OwnershipMapStatus = 'unknown' | 'partial' | 'complete';

export type ReviewState = 'draft' | 'pending_review' | 'approved' | 'rejected';

export type FinalVerdict =
  | 'READY_FOR_THIN_INTEGRATION'
  | 'READY_AFTER_CONTROL_PLANE_GAP_CLOSE'
  | 'READY_AFTER_UI_STATUS_GAP_CLOSE'
  | 'READY_AFTER_AUTH_POLICY_GAP_CLOSE'
  | 'NOT_READY'
  | 'DEFERRED'
  | null;

export type ActivityKind =
  | 'created'
  | 'submitted'
  | 'approved'
  | 'rejected'
  | 'updated';

export interface AdmissionCandidate {
  id: string;
  candidateName: string;
  candidateType: CandidateType;
  sourceKind: SourceKind;
  sourceUrlOrPath: string;
  sourceSlugOrRepo: string;
  purposeMapping: string;

  provenanceStatus: ProvenanceStatus;
  installPathKnown: boolean;
  installCountStatus: InstallCountStatus;
  securityReviewStatus: SecurityReviewStatus;
  ownershipMapStatus: OwnershipMapStatus;
  readinessGaps: string;
  readinessGapsReviewed: boolean;

  curatedSource: boolean;
  vettedSource: boolean;
  founderSafeAuthApproved: boolean;

  reviewState: ReviewState;
  decisionReason: string;
  finalVerdict: FinalVerdict;
  reviewedBy: string | null;

  createdAt: string;
  updatedAt: string;
}

export interface AdmissionActivity {
  id: string;
  candidateId: string;
  actor: string;
  action: ActivityKind;
  result: string;
  reasonDelta: string;
  at: string;
}

// ─── ID helpers ───────────────────────────────────────────────────────────────

function makeCandidateId(): string {
  return 'adm_' + randomBytes(8).toString('hex');
}

function makeActivityId(): string {
  return 'aac_' + randomBytes(8).toString('hex');
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

export async function initAdmissionCandidateStore(): Promise<void> {
  try {
    await mkdir(ADMISSION_DIR, { recursive: true });
    await createIfMissing(CANDIDATES_FILE, JSON.stringify({ candidates: [] }, null, 2));
    await createIfMissing(ACTIVITY_FILE, JSON.stringify({ activity: [] }, null, 2));
    console.log('[AdmissionCandidateStore] Initialized');
  } catch (error) {
    console.error('[AdmissionCandidateStore] Failed to initialize:', error);
    throw error;
  }
}

// ─── File I/O ─────────────────────────────────────────────────────────────────

async function loadCandidates(): Promise<AdmissionCandidate[]> {
  try {
    if (!existsSync(CANDIDATES_FILE)) return [];
    const content = await readFile(CANDIDATES_FILE, 'utf-8');
    const data = JSON.parse(content);
    return Array.isArray(data.candidates) ? data.candidates : [];
  } catch {
    return [];
  }
}

async function saveCandidates(candidates: AdmissionCandidate[]): Promise<void> {
  candidates.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
  await writeFile(
    CANDIDATES_FILE,
    JSON.stringify({ candidates, lastUpdated: new Date().toISOString() }, null, 2),
    'utf-8',
  );
}

async function loadActivity(): Promise<AdmissionActivity[]> {
  try {
    if (!existsSync(ACTIVITY_FILE)) return [];
    const content = await readFile(ACTIVITY_FILE, 'utf-8');
    const data = JSON.parse(content);
    return Array.isArray(data.activity) ? data.activity : [];
  } catch {
    return [];
  }
}

async function saveActivity(activity: AdmissionActivity[]): Promise<void> {
  activity.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
  await writeFile(
    ACTIVITY_FILE,
    JSON.stringify({ activity, lastUpdated: new Date().toISOString() }, null, 2),
    'utf-8',
  );
}

async function appendActivity(entry: Omit<AdmissionActivity, 'id'>): Promise<void> {
  const activity = await loadActivity();
  activity.push({ id: makeActivityId(), ...entry });
  await saveActivity(activity);
}

// ─── Gate logic ───────────────────────────────────────────────────────────────

export interface GateEvaluation {
  ok: boolean;
  blockingReasons: string[];
}

export function evaluateApprovalGate(c: AdmissionCandidate): GateEvaluation {
  const reasons: string[] = [];

  if (!c.founderSafeAuthApproved) {
    reasons.push('founder-safe auth approval is required');
  }
  if (!c.curatedSource) {
    reasons.push('curated source must be true');
  }
  if (!c.vettedSource) {
    reasons.push('vetted source must be true');
  }
  if (c.provenanceStatus !== 'documented' && c.provenanceStatus !== 'verified') {
    reasons.push('provenance must be documented or verified');
  }
  if (!c.installPathKnown) {
    reasons.push('install path must be known');
  }
  if (c.installCountStatus !== 'acceptable') {
    reasons.push('install count must be acceptable');
  }
  if (c.securityReviewStatus !== 'acceptable') {
    reasons.push('security review must be acceptable');
  }
  if (c.ownershipMapStatus !== 'complete') {
    reasons.push('ownership map must be complete');
  }
  if (!c.readinessGapsReviewed) {
    reasons.push('readiness gaps must be reviewed by the reviewer');
  }

  return { ok: reasons.length === 0, blockingReasons: reasons };
}

// ─── Public API ───────────────────────────────────────────────────────────────

export interface CreateCandidateInput {
  candidateName: string;
  candidateType: CandidateType;
  sourceKind: SourceKind;
  sourceUrlOrPath: string;
  sourceSlugOrRepo: string;
  purposeMapping: string;
  actor: string;
}

export async function createCandidate(
  input: CreateCandidateInput,
): Promise<AdmissionCandidate> {
  const now = new Date().toISOString();
  const candidate: AdmissionCandidate = {
    id: makeCandidateId(),
    candidateName: input.candidateName,
    candidateType: input.candidateType,
    sourceKind: input.sourceKind,
    sourceUrlOrPath: input.sourceUrlOrPath,
    sourceSlugOrRepo: input.sourceSlugOrRepo,
    purposeMapping: input.purposeMapping,
    provenanceStatus: 'unknown',
    installPathKnown: false,
    installCountStatus: 'unknown',
    securityReviewStatus: 'not_started',
    ownershipMapStatus: 'unknown',
    readinessGaps: '',
    readinessGapsReviewed: false,
    curatedSource: false,
    vettedSource: false,
    founderSafeAuthApproved: false,
    reviewState: 'draft',
    decisionReason: '',
    finalVerdict: null,
    reviewedBy: null,
    createdAt: now,
    updatedAt: now,
  };
  const candidates = await loadCandidates();
  candidates.push(candidate);
  await saveCandidates(candidates);

  await appendActivity({
    candidateId: candidate.id,
    actor: input.actor,
    action: 'created',
    result: 'draft',
    reasonDelta: `Candidate "${candidate.candidateName}" created as draft.`,
    at: now,
  });

  return candidate;
}

export async function listCandidates(): Promise<AdmissionCandidate[]> {
  return loadCandidates();
}

export async function getCandidateById(
  id: string,
): Promise<AdmissionCandidate | null> {
  const candidates = await loadCandidates();
  return candidates.find((c) => c.id === id) ?? null;
}

export type UpdateCandidateFields = Partial<
  Pick<
    AdmissionCandidate,
    | 'provenanceStatus'
    | 'installPathKnown'
    | 'installCountStatus'
    | 'securityReviewStatus'
    | 'ownershipMapStatus'
    | 'readinessGaps'
    | 'readinessGapsReviewed'
    | 'curatedSource'
    | 'vettedSource'
    | 'founderSafeAuthApproved'
    | 'purposeMapping'
    | 'decisionReason'
    | 'finalVerdict'
  >
>;

export async function updateCandidate(
  id: string,
  fields: UpdateCandidateFields,
  actor: string,
): Promise<AdmissionCandidate | null> {
  const candidates = await loadCandidates();
  const idx = candidates.findIndex((c) => c.id === id);
  if (idx === -1) return null;
  const existing = candidates[idx];
  if (existing.reviewState === 'approved' || existing.reviewState === 'rejected') {
    return existing;
  }
  const now = new Date().toISOString();
  const updated: AdmissionCandidate = {
    ...existing,
    ...fields,
    updatedAt: now,
  };
  candidates[idx] = updated;
  await saveCandidates(candidates);
  await appendActivity({
    candidateId: id,
    actor,
    action: 'updated',
    result: updated.reviewState,
    reasonDelta: `Fields updated: ${Object.keys(fields).join(', ')}`,
    at: now,
  });
  return updated;
}

export async function submitCandidate(
  id: string,
  actor: string,
): Promise<AdmissionCandidate | null> {
  const candidates = await loadCandidates();
  const idx = candidates.findIndex((c) => c.id === id);
  if (idx === -1) return null;
  const existing = candidates[idx];
  if (existing.reviewState !== 'draft') return existing;
  const now = new Date().toISOString();
  const updated: AdmissionCandidate = {
    ...existing,
    reviewState: 'pending_review',
    updatedAt: now,
  };
  candidates[idx] = updated;
  await saveCandidates(candidates);
  await appendActivity({
    candidateId: id,
    actor,
    action: 'submitted',
    result: 'pending_review',
    reasonDelta: 'Candidate submitted for review.',
    at: now,
  });
  return updated;
}

export interface ApproveResult {
  candidate: AdmissionCandidate | null;
  blocked: boolean;
  blockingReasons: string[];
  notFound: boolean;
}

export async function approveCandidate(
  id: string,
  actor: string,
  finalVerdict: FinalVerdict,
  decisionReason: string,
): Promise<ApproveResult> {
  const candidates = await loadCandidates();
  const idx = candidates.findIndex((c) => c.id === id);
  if (idx === -1) {
    return { candidate: null, blocked: false, blockingReasons: [], notFound: true };
  }
  const existing = candidates[idx];
  const gate = evaluateApprovalGate(existing);
  if (!gate.ok) {
    return {
      candidate: existing,
      blocked: true,
      blockingReasons: gate.blockingReasons,
      notFound: false,
    };
  }
  if (existing.reviewState === 'approved' || existing.reviewState === 'rejected') {
    return {
      candidate: existing,
      blocked: true,
      blockingReasons: [`candidate is already ${existing.reviewState}`],
      notFound: false,
    };
  }

  const now = new Date().toISOString();
  const updated: AdmissionCandidate = {
    ...existing,
    reviewState: 'approved',
    finalVerdict: finalVerdict ?? 'READY_FOR_THIN_INTEGRATION',
    decisionReason,
    reviewedBy: actor,
    updatedAt: now,
  };
  candidates[idx] = updated;
  await saveCandidates(candidates);
  await appendActivity({
    candidateId: id,
    actor,
    action: 'approved',
    result: 'approved',
    reasonDelta: decisionReason || 'Approved without additional note.',
    at: now,
  });
  return { candidate: updated, blocked: false, blockingReasons: [], notFound: false };
}

export async function rejectCandidate(
  id: string,
  actor: string,
  decisionReason: string,
): Promise<AdmissionCandidate | null> {
  const candidates = await loadCandidates();
  const idx = candidates.findIndex((c) => c.id === id);
  if (idx === -1) return null;
  const existing = candidates[idx];
  if (existing.reviewState === 'approved' || existing.reviewState === 'rejected') {
    return existing;
  }
  const now = new Date().toISOString();
  const updated: AdmissionCandidate = {
    ...existing,
    reviewState: 'rejected',
    finalVerdict: 'NOT_READY',
    decisionReason,
    reviewedBy: actor,
    updatedAt: now,
  };
  candidates[idx] = updated;
  await saveCandidates(candidates);
  await appendActivity({
    candidateId: id,
    actor,
    action: 'rejected',
    result: 'rejected',
    reasonDelta: decisionReason || 'Rejected without additional note.',
    at: now,
  });
  return updated;
}

export async function listActivity(
  candidateId?: string,
): Promise<AdmissionActivity[]> {
  const activity = await loadActivity();
  if (candidateId !== undefined) {
    return activity.filter((a) => a.candidateId === candidateId);
  }
  return activity;
}
