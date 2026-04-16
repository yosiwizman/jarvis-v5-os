/**
 * Auth/Connect Store — M-CP-4 AUTH/CONNECT ORCHESTRATOR.
 *
 * Control-plane persistence for connect-orchestration records. Pure storage —
 * no HTTP, no external fetch, no runtime provider work, no secret handling.
 *
 * Admissible founder-safe connect methods are exactly:
 *   - "browser_oauth"  (mapped from channels registry browser-session-*)
 *   - "qr"             (mapped from channels registry qr-scan)
 *
 * Nothing else is admissible. Secrets, credential files, API keys, dev-console
 * steps, and manual terminal flows are forbidden by contract.
 *
 * Pattern mirrors apps/server/src/storage/assistantStore.ts (PR #134) and
 * admissionCandidateStore.ts (PR #135).
 */

import { readFile, writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { randomBytes } from 'crypto';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), 'data');
const AUTH_CONNECT_DIR = path.join(DATA_DIR, 'auth-connect');
const SESSIONS_FILE = path.join(AUTH_CONNECT_DIR, 'sessions.json');

export type AuthConnectMethod = 'browser_oauth' | 'qr';

export type AuthConnectState =
  | 'pending'
  | 'ready'
  | 'blocked'
  | 'unsupported'
  | 'cancelled';

export interface AuthConnectSession {
  id: string;
  provider: string;
  method: AuthConnectMethod;
  state: AuthConnectState;
  stateReason: string;
  founderSafe: boolean;
  forbiddenReason: string | null;
  requestedBy: string;
  createdAt: string;
  updatedAt: string;
}

function makeSessionId(): string {
  return 'acs_' + randomBytes(8).toString('hex');
}

async function createIfMissing(filePath: string, initialContent: string): Promise<void> {
  try {
    await writeFile(filePath, initialContent, { encoding: 'utf-8', flag: 'wx' });
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException)?.code === 'EEXIST') return;
    throw err;
  }
}

export async function initAuthConnectStore(): Promise<void> {
  try {
    await mkdir(AUTH_CONNECT_DIR, { recursive: true });
    await createIfMissing(SESSIONS_FILE, JSON.stringify({ sessions: [] }, null, 2));
    console.log('[AuthConnectStore] Initialized');
  } catch (error) {
    console.error('[AuthConnectStore] Failed to initialize:', error);
    throw error;
  }
}

async function loadSessions(): Promise<AuthConnectSession[]> {
  try {
    if (!existsSync(SESSIONS_FILE)) return [];
    const content = await readFile(SESSIONS_FILE, 'utf-8');
    const data = JSON.parse(content);
    return Array.isArray(data.sessions) ? data.sessions : [];
  } catch {
    return [];
  }
}

async function saveSessions(sessions: AuthConnectSession[]): Promise<void> {
  sessions.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
  await writeFile(
    SESSIONS_FILE,
    JSON.stringify({ sessions, lastUpdated: new Date().toISOString() }, null, 2),
    'utf-8',
  );
}

export interface CreateSessionInput {
  provider: string;
  method: AuthConnectMethod;
  state: AuthConnectState;
  stateReason: string;
  founderSafe: boolean;
  forbiddenReason: string | null;
  requestedBy: string;
}

export async function createSession(
  input: CreateSessionInput,
): Promise<AuthConnectSession> {
  const now = new Date().toISOString();
  const session: AuthConnectSession = {
    id: makeSessionId(),
    provider: input.provider,
    method: input.method,
    state: input.state,
    stateReason: input.stateReason,
    founderSafe: input.founderSafe,
    forbiddenReason: input.forbiddenReason,
    requestedBy: input.requestedBy,
    createdAt: now,
    updatedAt: now,
  };
  const sessions = await loadSessions();
  sessions.push(session);
  await saveSessions(sessions);
  return session;
}

export async function listSessions(): Promise<AuthConnectSession[]> {
  return loadSessions();
}

export async function getSessionById(
  id: string,
): Promise<AuthConnectSession | null> {
  const sessions = await loadSessions();
  return sessions.find((s) => s.id === id) ?? null;
}

export async function cancelSession(
  id: string,
  reason: string,
): Promise<AuthConnectSession | null> {
  const sessions = await loadSessions();
  const idx = sessions.findIndex((s) => s.id === id);
  if (idx === -1) return null;
  const existing = sessions[idx];
  if (existing.state === 'cancelled') return existing;
  const now = new Date().toISOString();
  const updated: AuthConnectSession = {
    ...existing,
    state: 'cancelled',
    stateReason: reason || 'Cancelled by reviewer.',
    updatedAt: now,
  };
  sessions[idx] = updated;
  await saveSessions(sessions);
  return updated;
}
