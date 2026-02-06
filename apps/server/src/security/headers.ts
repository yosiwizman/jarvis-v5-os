/**
 * Security Headers Middleware
 * 
 * Applies baseline HTTP security headers to all responses.
 * These headers provide defense-in-depth even if Caddy configuration changes.
 * 
 * Headers applied:
 * - X-Content-Type-Options: nosniff - Prevents MIME-sniffing attacks
 * - X-Frame-Options: DENY - Prevents clickjacking (legacy, but still useful)
 * - Referrer-Policy: no-referrer - Prevents leaking referrer info
 * - Permissions-Policy: Restricts access to browser features
 * - Strict-Transport-Security: Enforces HTTPS (1 week initial ramp)
 * - Content-Security-Policy-Report-Only: CSP in report-only mode for safe rollout
 */

import type { FastifyRequest, FastifyReply, FastifyInstance } from 'fastify';

/**
 * Security headers configuration
 */
export const SECURITY_HEADERS = {
  // Prevent MIME-sniffing attacks
  'X-Content-Type-Options': 'nosniff',
  
  // Prevent clickjacking - DENY is strictest (also covered by CSP frame-ancestors)
  'X-Frame-Options': 'DENY',
  
  // Don't leak referrer info to other origins
  'Referrer-Policy': 'no-referrer',
  
  // Restrict browser feature access - allow camera/mic for voice features (self only)
  'Permissions-Policy': "camera=(self), microphone=(self), geolocation=(), payment=(), usb=()",
  
  // HSTS - 1 week initial ramp (604800 seconds), will increase once stable
  'Strict-Transport-Security': 'max-age=604800; includeSubDomains',
  
  // CSP in report-only mode for safe rollout - doesn't block, just reports
  // This allows us to identify issues before enforcing
  'Content-Security-Policy-Report-Only': [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'", // Next.js needs unsafe-inline/eval
    "style-src 'self' 'unsafe-inline'", // Next.js needs unsafe-inline for styles
    "img-src 'self' data: blob:",
    "font-src 'self'",
    "connect-src 'self' wss: ws:", // WebSocket connections
    "media-src 'self' blob:",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
  ].join('; '),
} as const;

/**
 * Apply security headers to a response
 */
export function applySecurityHeaders(reply: FastifyReply): void {
  for (const [header, value] of Object.entries(SECURITY_HEADERS)) {
    reply.header(header, value);
  }
}

/**
 * Fastify hook to apply security headers to all responses
 * Note: onSend signature is (request, reply, payload, done)
 */
export function securityHeadersHook(
  _request: FastifyRequest,
  reply: FastifyReply,
  payload: unknown,
  done: (err?: Error | null, value?: unknown) => void
): void {
  applySecurityHeaders(reply);
  done(null, payload);
}

/**
 * Register security headers middleware with Fastify
 */
export function registerSecurityHeaders(fastify: FastifyInstance): void {
  fastify.addHook('onSend', securityHeadersHook);
}
