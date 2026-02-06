/**
 * Security Audit Log
 * 
 * Append-only JSONL file for security-relevant events.
 * All sensitive data is redacted before logging.
 * 
 * Events logged:
 * - PIN set, login success/failure
 * - Admin key changes
 * - LLM config changes
 * - Rate limit triggers
 * - CSRF failures
 * 
 * SECURITY:
 * - Never logs PINs, API keys, tokens, or session values
 * - IP addresses are hashed for privacy
 * - File rotation at 10MB to prevent disk exhaustion
 */

import { createWriteStream, existsSync, statSync, renameSync, mkdirSync, WriteStream } from 'fs';
import { createHash } from 'crypto';
import path from 'path';

// Configuration
const DATA_DIR = path.resolve(process.cwd(), 'data');
const AUDIT_FILE = path.join(DATA_DIR, 'audit.log');
const AUDIT_FILE_ROTATED = path.join(DATA_DIR, 'audit.log.1');
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

// Ensure data directory exists
mkdirSync(DATA_DIR, { recursive: true });

// Audit event types
export const AuditEventType = {
  PIN_SET: 'pin_set',
  PIN_LOGIN_SUCCESS: 'pin_login_success',
  PIN_LOGIN_FAILED: 'pin_login_failed',
  ADMIN_KEY_SET: 'admin_key_set',
  ADMIN_KEY_DELETE: 'admin_key_delete',
  LLM_CONFIG_SAVED: 'llm_config_saved',
  LLM_TEST_RUN: 'llm_test_run',
  RATE_LIMITED: 'rate_limited',
  CSRF_FAILED: 'csrf_failed',
  ORIGIN_REJECTED: 'origin_rejected',
  SESSION_CREATED: 'session_created',
  SESSION_ROTATED: 'session_rotated',
  LOGOUT: 'logout',
} as const;

export type AuditEventTypeValue = typeof AuditEventType[keyof typeof AuditEventType];

export interface AuditEntry {
  event: AuditEventTypeValue;
  timestamp?: string;
  requestId?: string;
  ip?: string;
  sessionId?: string;
  route?: string;
  outcome?: 'success' | 'failure' | 'blocked';
  metadata?: Record<string, unknown>;
}

interface AuditLogLine {
  event: string;
  timestamp: string;
  requestId?: string;
  ipHash?: string;
  sessionIdHash?: string;
  route?: string;
  outcome?: string;
  metadata?: Record<string, unknown>;
}

// Stream handle for async writes
let writeStream: WriteStream | null = null;
let pendingWrites: string[] = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * Hash an IP address for privacy-preserving logging
 */
function hashIp(ip: string): string {
  if (!ip || ip === 'unknown') return 'unknown';
  return createHash('sha256')
    .update(ip + ':audit-salt-v1')
    .digest('hex')
    .slice(0, 16);
}

/**
 * Hash a session ID for privacy-preserving logging
 */
function hashSessionId(sessionId: string): string {
  if (!sessionId) return '';
  return createHash('sha256')
    .update(sessionId + ':session-salt-v1')
    .digest('hex')
    .slice(0, 12);
}

/**
 * Ensure write stream is open
 */
function ensureStream(): WriteStream {
  if (!writeStream || writeStream.closed) {
    writeStream = createWriteStream(AUDIT_FILE, { flags: 'a' });
    writeStream.on('error', (err) => {
      console.error('[AuditLog] Write error:', err.message);
    });
  }
  return writeStream;
}

/**
 * Check file size and rotate if needed
 */
function checkRotation(): void {
  try {
    if (existsSync(AUDIT_FILE)) {
      const stats = statSync(AUDIT_FILE);
      if (stats.size >= MAX_FILE_SIZE_BYTES) {
        // Close current stream
        if (writeStream) {
          writeStream.end();
          writeStream = null;
        }
        
        // Rotate: audit.log.1 is deleted, audit.log becomes audit.log.1
        if (existsSync(AUDIT_FILE_ROTATED)) {
          // We only keep one backup
          // In production, you might want more sophisticated rotation
        }
        renameSync(AUDIT_FILE, AUDIT_FILE_ROTATED);
      }
    }
  } catch (error) {
    console.error('[AuditLog] Rotation check failed:', error);
  }
}

/**
 * Flush pending writes to disk
 */
function flushPendingWrites(): void {
  if (pendingWrites.length === 0) return;
  
  checkRotation();
  
  const stream = ensureStream();
  const lines = pendingWrites.join('');
  pendingWrites = [];
  
  stream.write(lines);
}

/**
 * Schedule a flush (batches writes for efficiency)
 */
function scheduleFlush(): void {
  if (!flushTimer) {
    flushTimer = setTimeout(() => {
      flushTimer = null;
      flushPendingWrites();
    }, 100); // 100ms batch window
    
    // Don't prevent process exit
    if (flushTimer.unref) {
      flushTimer.unref();
    }
  }
}

/**
 * Redact sensitive fields from metadata
 */
function redactMetadata(metadata?: Record<string, unknown>): Record<string, unknown> | undefined {
  if (!metadata) return undefined;
  
  const redactedKeys = [
    'pin', 'password', 'secret', 'token', 'apiKey', 'api_key',
    'key', 'credential', 'auth', 'authorization', 'cookie',
  ];
  
  const result: Record<string, unknown> = {};
  
  for (const [key, value] of Object.entries(metadata)) {
    const lowerKey = key.toLowerCase();
    const shouldRedact = redactedKeys.some(k => lowerKey.includes(k));
    
    if (shouldRedact) {
      result[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null) {
      result[key] = redactMetadata(value as Record<string, unknown>);
    } else {
      result[key] = value;
    }
  }
  
  return result;
}

/**
 * Log a security audit event
 */
export async function auditLog(entry: AuditEntry): Promise<void> {
  try {
    const logLine: AuditLogLine = {
      event: entry.event,
      timestamp: entry.timestamp || new Date().toISOString(),
    };
    
    if (entry.requestId) {
      logLine.requestId = entry.requestId;
    }
    
    if (entry.ip) {
      logLine.ipHash = hashIp(entry.ip);
    }
    
    if (entry.sessionId) {
      logLine.sessionIdHash = hashSessionId(entry.sessionId);
    }
    
    if (entry.route) {
      logLine.route = entry.route;
    }
    
    if (entry.outcome) {
      logLine.outcome = entry.outcome;
    }
    
    if (entry.metadata) {
      logLine.metadata = redactMetadata(entry.metadata);
    }
    
    const line = JSON.stringify(logLine) + '\n';
    pendingWrites.push(line);
    scheduleFlush();
  } catch (error) {
    // Never throw from audit log - it's observability, not critical path
    console.error('[AuditLog] Failed to log event:', error);
  }
}

/**
 * Synchronous flush for graceful shutdown
 */
export function flushAuditLog(): void {
  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }
  flushPendingWrites();
}

/**
 * Close the audit log stream
 */
export function closeAuditLog(): void {
  flushAuditLog();
  if (writeStream) {
    writeStream.end();
    writeStream = null;
  }
}

/**
 * Convenience functions for common events
 */
export const audit = {
  pinSet: (ip: string, wasRotation: boolean) =>
    auditLog({
      event: AuditEventType.PIN_SET,
      ip,
      outcome: 'success',
      metadata: { wasRotation },
    }),
    
  pinLoginSuccess: (ip: string) =>
    auditLog({
      event: AuditEventType.PIN_LOGIN_SUCCESS,
      ip,
      outcome: 'success',
    }),
    
  pinLoginFailed: (ip: string) =>
    auditLog({
      event: AuditEventType.PIN_LOGIN_FAILED,
      ip,
      outcome: 'failure',
    }),
    
  adminKeySet: (ip: string, keyName: string) =>
    auditLog({
      event: AuditEventType.ADMIN_KEY_SET,
      ip,
      outcome: 'success',
      metadata: { keyName },
    }),
    
  adminKeyDelete: (ip: string, keyName: string) =>
    auditLog({
      event: AuditEventType.ADMIN_KEY_DELETE,
      ip,
      outcome: 'success',
      metadata: { keyName },
    }),
    
  llmConfigSaved: (ip: string, provider: string) =>
    auditLog({
      event: AuditEventType.LLM_CONFIG_SAVED,
      ip,
      outcome: 'success',
      metadata: { provider },
    }),
    
  llmTestRun: (ip: string, success: boolean, provider: string) =>
    auditLog({
      event: AuditEventType.LLM_TEST_RUN,
      ip,
      outcome: success ? 'success' : 'failure',
      metadata: { provider },
    }),
    
  csrfFailed: (ip: string, route: string) =>
    auditLog({
      event: AuditEventType.CSRF_FAILED,
      ip,
      route,
      outcome: 'blocked',
    }),
    
  sessionCreated: (ip: string) =>
    auditLog({
      event: AuditEventType.SESSION_CREATED,
      ip,
      outcome: 'success',
    }),
    
  sessionRotated: (ip: string) =>
    auditLog({
      event: AuditEventType.SESSION_ROTATED,
      ip,
      outcome: 'success',
    }),
    
  logout: (ip: string) =>
    auditLog({
      event: AuditEventType.LOGOUT,
      ip,
      outcome: 'success',
    }),
    
  originRejected: (ip: string, route: string, origin?: string) =>
    auditLog({
      event: AuditEventType.ORIGIN_REJECTED,
      ip,
      route,
      outcome: 'blocked',
      metadata: { origin: origin || 'missing' },
    }),
};
