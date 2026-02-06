/**
 * CSRF Protection Utility
 * 
 * Implements double-submit cookie pattern for CSRF protection.
 * - Server sets a CSRF token cookie (readable by JavaScript)
 * - Client must send the same token in X-CSRF-Token header
 * - Server validates that cookie and header match
 * 
 * SECURITY:
 * - Token is cryptographically random
 * - Cookie is NOT HttpOnly (client needs to read it)
 * - Cookie IS SameSite=Strict to prevent cross-site sending
 * - Header must exactly match cookie value
 */

import type { FastifyRequest, FastifyReply } from 'fastify';
import { randomBytes } from 'crypto';
import { audit } from './auditLog.js';
import { getClientIp } from './rateLimit.js';

// CSRF configuration
export const CSRF_COOKIE_NAME = 'akior_csrf_token';
export const CSRF_HEADER_NAME = 'x-csrf-token';
const CSRF_TOKEN_LENGTH = 32; // 256 bits

// Cookie options for CSRF token
export const CSRF_COOKIE_OPTIONS = {
  httpOnly: false,        // Client JS needs to read this
  secure: true,           // HTTPS only
  sameSite: 'strict' as const,
  path: '/',
  maxAge: 60 * 60,        // 1 hour (in seconds for Fastify)
};

/**
 * Generate a new CSRF token
 */
export function generateCsrfToken(): string {
  return randomBytes(CSRF_TOKEN_LENGTH).toString('hex');
}

/**
 * Standard 403 CSRF error response format
 */
export interface CsrfErrorResponse {
  ok: false;
  error: {
    code: 'CSRF_REQUIRED' | 'CSRF_INVALID';
    message: string;
  };
}

/**
 * Middleware to ensure CSRF token cookie is set
 * Call this on routes that need to issue a CSRF token (e.g., login page loads)
 */
export function ensureCsrfToken(req: FastifyRequest, reply: FastifyReply): string {
  const cookies = req.cookies || {};
  let token = cookies[CSRF_COOKIE_NAME];
  
  // Generate new token if none exists or it's invalid
  if (!token || token.length !== CSRF_TOKEN_LENGTH * 2) {
    token = generateCsrfToken();
    reply.setCookie(CSRF_COOKIE_NAME, token, CSRF_COOKIE_OPTIONS);
  }
  
  return token;
}

/**
 * Validate CSRF token from request
 * Returns true if valid, false if invalid
 */
export function validateCsrfToken(req: FastifyRequest): boolean {
  const cookies = req.cookies || {};
  const cookieToken = cookies[CSRF_COOKIE_NAME];
  
  // Get header token (case-insensitive header lookup)
  const headerToken = req.headers[CSRF_HEADER_NAME] as string | undefined;
  
  // Both must be present
  if (!cookieToken || !headerToken) {
    return false;
  }
  
  // Must match exactly (constant-time comparison for paranoia)
  if (cookieToken.length !== headerToken.length) {
    return false;
  }
  
  // Simple string comparison (both are hex strings, not secrets)
  return cookieToken === headerToken;
}

/**
 * CSRF validation middleware
 * Returns false and sends 403 if validation fails
 */
export async function requireCsrf(
  req: FastifyRequest,
  reply: FastifyReply
): Promise<boolean> {
  const isValid = validateCsrfToken(req);
  
  if (!isValid) {
    const cookies = req.cookies || {};
    const hasCookie = Boolean(cookies[CSRF_COOKIE_NAME]);
    const hasHeader = Boolean(req.headers[CSRF_HEADER_NAME]);
    
    // Log CSRF failure
    const ip = getClientIp(req);
    await audit.csrfFailed(ip, req.url);
    
    // Determine specific error code
    const code = (!hasCookie && !hasHeader) ? 'CSRF_REQUIRED' : 'CSRF_INVALID';
    const message = code === 'CSRF_REQUIRED'
      ? 'CSRF token required. Ensure you have loaded the page and include the X-CSRF-Token header.'
      : 'CSRF token invalid. Please refresh the page and try again.';
    
    const response: CsrfErrorResponse = {
      ok: false,
      error: { code, message },
    };
    
    reply
      .status(403)
      .header('Cache-Control', 'no-store')
      .send(response);
    
    return false;
  }
  
  return true;
}

/**
 * Rotate CSRF token (call after sensitive actions like login)
 */
export function rotateCsrfToken(reply: FastifyReply): string {
  const newToken = generateCsrfToken();
  reply.setCookie(CSRF_COOKIE_NAME, newToken, CSRF_COOKIE_OPTIONS);
  return newToken;
}

/**
 * Clear CSRF token (call on logout)
 */
export function clearCsrfToken(reply: FastifyReply): void {
  reply.clearCookie(CSRF_COOKIE_NAME, { path: '/' });
}

/**
 * Get CSRF token from request (for use in responses where client needs it)
 */
export function getCsrfToken(req: FastifyRequest): string | undefined {
  const cookies = req.cookies || {};
  return cookies[CSRF_COOKIE_NAME];
}
