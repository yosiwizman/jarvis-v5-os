/**
 * Security Module
 * 
 * Exports all security utilities for easy import:
 * - Rate limiting
 * - CSRF protection
 * - Audit logging
 */

export {
  // Rate limiting
  type RateLimitConfig,
  type RateLimitErrorResponse,
  RateLimitPresets,
  checkRateLimit,
  createRateLimitMiddleware,
  getClientIp,
  resetRateLimit,
  getAttemptCount,
} from './rateLimit.js';

export {
  // CSRF protection
  type CsrfErrorResponse,
  CSRF_COOKIE_NAME,
  CSRF_HEADER_NAME,
  CSRF_COOKIE_OPTIONS,
  generateCsrfToken,
  ensureCsrfToken,
  validateCsrfToken,
  requireCsrf,
  rotateCsrfToken,
  clearCsrfToken,
  getCsrfToken,
} from './csrf.js';

export {
  // Audit logging
  type AuditEntry,
  type AuditEventTypeValue,
  AuditEventType,
  auditLog,
  flushAuditLog,
  closeAuditLog,
  audit,
} from './auditLog.js';
