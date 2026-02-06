/**
 * Rate Limiting Utility
 * 
 * Provides brute-force protection for sensitive endpoints.
 * In-memory sliding window implementation (resets on server restart).
 * 
 * Features:
 * - Keying by client IP (respects X-Forwarded-For from reverse proxy)
 * - Configurable window, max attempts, and lockout duration
 * - Standard JSON error response with Retry-After header
 * 
 * SECURITY:
 * - IP addresses are hashed in audit logs (not in limiter memory)
 * - Lockout applies per-route to prevent cross-route abuse
 */

import type { FastifyRequest, FastifyReply } from 'fastify';
import { auditLog, AuditEventType } from './auditLog.js';

export interface RateLimitConfig {
  /** Maximum attempts allowed within the window */
  maxAttempts: number;
  /** Time window in milliseconds */
  windowMs: number;
  /** Lockout duration after max attempts exceeded (ms) */
  lockoutMs: number;
  /** Route identifier for keying (e.g., 'pin-login', 'admin-keys') */
  routeKey: string;
  /** Optional: also key by username/identifier in request body */
  bodyKeyField?: string;
}

interface AttemptRecord {
  timestamps: number[];
  lockedUntil?: number;
}

// In-memory store: Map<compositeKey, AttemptRecord>
const attemptStore = new Map<string, AttemptRecord>();

// Cleanup interval (every 5 minutes)
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;
let cleanupTimer: ReturnType<typeof setInterval> | null = null;

/**
 * Get client IP from request, respecting X-Forwarded-For header
 */
export function getClientIp(req: FastifyRequest): string {
  // X-Forwarded-For may contain multiple IPs: "client, proxy1, proxy2"
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    const first = Array.isArray(forwarded) ? forwarded[0] : forwarded.split(',')[0];
    if (first?.trim()) {
      return first.trim();
    }
  }
  
  // Fall back to connection remote address
  return req.ip || req.socket.remoteAddress || 'unknown';
}

/**
 * Build composite key for rate limiting
 */
function buildKey(
  config: RateLimitConfig,
  ip: string,
  bodyKey?: string
): string {
  const parts = [config.routeKey, ip];
  if (bodyKey) {
    parts.push(bodyKey);
  }
  return parts.join(':');
}

/**
 * Clean up expired entries from the attempt store
 */
function cleanupExpiredEntries(): void {
  const now = Date.now();
  const keysToDelete: string[] = [];
  
  for (const [key, record] of attemptStore.entries()) {
    // Remove if lockout expired and no recent timestamps
    if (record.lockedUntil && record.lockedUntil < now) {
      record.lockedUntil = undefined;
    }
    
    // Filter out old timestamps
    const windowStart = now - (60 * 60 * 1000); // 1 hour max window
    record.timestamps = record.timestamps.filter(t => t > windowStart);
    
    // Delete empty records
    if (record.timestamps.length === 0 && !record.lockedUntil) {
      keysToDelete.push(key);
    }
  }
  
  for (const key of keysToDelete) {
    attemptStore.delete(key);
  }
}

/**
 * Start the cleanup timer if not already running
 */
function ensureCleanupTimer(): void {
  if (!cleanupTimer) {
    cleanupTimer = setInterval(cleanupExpiredEntries, CLEANUP_INTERVAL_MS);
    // Don't prevent process exit
    if (cleanupTimer.unref) {
      cleanupTimer.unref();
    }
  }
}

/**
 * Presets for common use cases
 */
export const RateLimitPresets = {
  /** Strict limit for PIN authentication: 5 attempts per 15 min, 30 min lockout */
  PIN_AUTH: {
    maxAttempts: 5,
    windowMs: 15 * 60 * 1000,      // 15 minutes
    lockoutMs: 30 * 60 * 1000,     // 30 minutes
    routeKey: 'pin-auth',
  } satisfies Omit<RateLimitConfig, 'routeKey'> & { routeKey: string },
  
  /** Moderate limit for admin endpoints: 20 attempts per 5 min, 5 min lockout */
  ADMIN_MODERATE: {
    maxAttempts: 20,
    windowMs: 5 * 60 * 1000,       // 5 minutes
    lockoutMs: 5 * 60 * 1000,      // 5 minutes
    routeKey: 'admin-moderate',
  } satisfies Omit<RateLimitConfig, 'routeKey'> & { routeKey: string },
  
  /** Light limit for test/config endpoints: 30 attempts per 5 min, 2 min lockout */
  ADMIN_LIGHT: {
    maxAttempts: 30,
    windowMs: 5 * 60 * 1000,       // 5 minutes
    lockoutMs: 2 * 60 * 1000,      // 2 minutes
    routeKey: 'admin-light',
  } satisfies Omit<RateLimitConfig, 'routeKey'> & { routeKey: string },
} as const;

/**
 * Standard 429 error response format
 */
export interface RateLimitErrorResponse {
  ok: false;
  error: {
    code: 'RATE_LIMITED';
    message: string;
  };
  retryAfterSec: number;
  security: {
    attemptsRemaining: number;
    windowSec: number;
    lockedOut: boolean;
  };
}

/**
 * Check rate limit and return result
 */
export function checkRateLimit(
  config: RateLimitConfig,
  ip: string,
  bodyKey?: string
): { allowed: boolean; response?: RateLimitErrorResponse } {
  ensureCleanupTimer();
  
  const now = Date.now();
  const key = buildKey(config, ip, bodyKey);
  
  let record = attemptStore.get(key);
  if (!record) {
    record = { timestamps: [] };
    attemptStore.set(key, record);
  }
  
  // Check if currently locked out
  if (record.lockedUntil && record.lockedUntil > now) {
    const retryAfterSec = Math.ceil((record.lockedUntil - now) / 1000);
    return {
      allowed: false,
      response: {
        ok: false,
        error: {
          code: 'RATE_LIMITED',
          message: `Too many attempts. Try again in ${retryAfterSec} seconds.`,
        },
        retryAfterSec,
        security: {
          attemptsRemaining: 0,
          windowSec: Math.ceil(config.windowMs / 1000),
          lockedOut: true,
        },
      },
    };
  }
  
  // Clean old timestamps
  const windowStart = now - config.windowMs;
  record.timestamps = record.timestamps.filter(t => t > windowStart);
  
  // Check attempt count
  if (record.timestamps.length >= config.maxAttempts) {
    // Apply lockout
    record.lockedUntil = now + config.lockoutMs;
    const retryAfterSec = Math.ceil(config.lockoutMs / 1000);
    
    return {
      allowed: false,
      response: {
        ok: false,
        error: {
          code: 'RATE_LIMITED',
          message: `Too many attempts. Try again in ${retryAfterSec} seconds.`,
        },
        retryAfterSec,
        security: {
          attemptsRemaining: 0,
          windowSec: Math.ceil(config.windowMs / 1000),
          lockedOut: true,
        },
      },
    };
  }
  
  // Record this attempt
  record.timestamps.push(now);
  
  return {
    allowed: true,
  };
}

/**
 * Create rate limit middleware for a Fastify route
 */
export function createRateLimitMiddleware(config: RateLimitConfig) {
  return async function rateLimitMiddleware(
    req: FastifyRequest,
    reply: FastifyReply
  ): Promise<boolean> {
    const ip = getClientIp(req);
    
    // Extract body key if configured
    let bodyKey: string | undefined;
    if (config.bodyKeyField && req.body && typeof req.body === 'object') {
      const bodyValue = (req.body as Record<string, unknown>)[config.bodyKeyField];
      if (typeof bodyValue === 'string') {
        bodyKey = bodyValue;
      }
    }
    
    const result = checkRateLimit(config, ip, bodyKey);
    
    if (!result.allowed && result.response) {
      // Log rate limit event
      await auditLog({
        event: AuditEventType.RATE_LIMITED,
        ip,
        route: req.url,
        outcome: 'blocked',
        metadata: {
          routeKey: config.routeKey,
          lockedOut: result.response.security.lockedOut,
        },
      });
      
      reply
        .status(429)
        .header('Retry-After', String(result.response.retryAfterSec))
        .header('Cache-Control', 'no-store')
        .send(result.response);
      
      return false;
    }
    
    return true;
  };
}

/**
 * Reset rate limit for testing purposes
 */
export function resetRateLimit(
  config: RateLimitConfig,
  ip: string,
  bodyKey?: string
): void {
  const key = buildKey(config, ip, bodyKey);
  attemptStore.delete(key);
}

/**
 * Get current attempt count for testing/debugging
 */
export function getAttemptCount(
  config: RateLimitConfig,
  ip: string,
  bodyKey?: string
): number {
  const key = buildKey(config, ip, bodyKey);
  const record = attemptStore.get(key);
  if (!record) return 0;
  
  const now = Date.now();
  const windowStart = now - config.windowMs;
  return record.timestamps.filter(t => t > windowStart).length;
}
