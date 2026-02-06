/**
 * Origin Enforcement Middleware
 * 
 * Additional CSRF layer that validates the Origin header on state-changing
 * requests to admin endpoints. This provides defense-in-depth alongside
 * the double-submit cookie CSRF protection.
 * 
 * Behavior:
 * - Only applies to POST/PUT/PATCH/DELETE requests on admin routes
 * - Checks Origin header against allowlist
 * - Returns 403 ORIGIN_NOT_ALLOWED if Origin is missing or not allowed
 * 
 * Allowlist configuration:
 * - Default: https://{request Host} + http://localhost:3000 (dev)
 * - Override via ALLOWED_ORIGINS env: comma-separated list
 * 
 * SECURITY:
 * - Origin header cannot be spoofed by JavaScript in browsers
 * - Provides additional protection even if CSRF cookie is compromised
 */

import type { FastifyRequest, FastifyReply } from 'fastify';
import { audit } from './auditLog.js';
import { getClientIp } from './rateLimit.js';

/**
 * Standard 403 Origin error response format
 */
export interface OriginErrorResponse {
  ok: false;
  error: {
    code: 'ORIGIN_NOT_ALLOWED';
    message: string;
  };
}

/**
 * Parse ALLOWED_ORIGINS from environment variable
 * Format: comma-separated list of origins (trim whitespace)
 */
function parseAllowedOriginsEnv(): string[] {
  const env = process.env.ALLOWED_ORIGINS;
  if (!env || !env.trim()) {
    return [];
  }
  return env
    .split(',')
    .map(origin => origin.trim())
    .filter(origin => origin.length > 0);
}

// Cache parsed env at module load
const envAllowedOrigins = parseAllowedOriginsEnv();

/**
 * Get the default allowed origins based on the request
 * Includes the request's own origin (derived from Host) + localhost for dev
 */
function getDefaultAllowedOrigins(req: FastifyRequest): string[] {
  const origins: string[] = [];
  
  // Add https://<host> from the request
  const host = req.headers.host;
  if (host) {
    // Strip port if present for matching (Origin header doesn't include default ports)
    const hostWithoutDefaultPort = host.replace(/:443$/, '').replace(/:80$/, '');
    origins.push(`https://${hostWithoutDefaultPort}`);
    origins.push(`http://${hostWithoutDefaultPort}`);
  }
  
  // Always allow localhost for development
  origins.push('http://localhost:3000');
  origins.push('https://localhost:3000');
  origins.push('http://localhost:1234');
  origins.push('https://localhost:1234');
  
  return origins;
}

/**
 * Check if an origin is allowed for the given request
 */
export function isOriginAllowed(req: FastifyRequest): boolean {
  const origin = req.headers.origin as string | undefined;
  
  // If no Origin header, not allowed (browser always sends Origin on cross-origin requests)
  // Note: Same-origin requests may omit Origin, but for admin mutations we require it
  if (!origin) {
    return false;
  }
  
  // Build combined allowlist: env overrides + defaults
  const allowlist = envAllowedOrigins.length > 0 
    ? envAllowedOrigins 
    : getDefaultAllowedOrigins(req);
  
  // Also always include defaults even if env is set (merge behavior)
  const fullAllowlist = [...new Set([...allowlist, ...getDefaultAllowedOrigins(req)])];
  
  // Check exact match
  return fullAllowlist.includes(origin);
}

/**
 * Get the Origin header from request (for logging/debugging)
 */
export function getOrigin(req: FastifyRequest): string | undefined {
  return req.headers.origin as string | undefined;
}

/**
 * Origin enforcement middleware for admin mutations
 * Returns false and sends 403 if Origin is not allowed
 * 
 * Usage in route:
 *   if (!(await requireOrigin(req, reply))) return;
 */
export async function requireOrigin(
  req: FastifyRequest,
  reply: FastifyReply
): Promise<boolean> {
  // Only check state-changing methods
  const method = req.method.toUpperCase();
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
    return true; // GET, OPTIONS, HEAD don't need Origin check
  }
  
  const allowed = isOriginAllowed(req);
  
  if (!allowed) {
    const ip = getClientIp(req);
    const origin = getOrigin(req);
    
    // Log the rejection
    await audit.originRejected(ip, req.url, origin);
    
    const response: OriginErrorResponse = {
      ok: false,
      error: {
        code: 'ORIGIN_NOT_ALLOWED',
        message: origin 
          ? 'Origin not allowed. Request must come from a trusted origin.'
          : 'Origin header required for state-changing requests.',
      },
    };
    
    reply
      .status(403)
      .header('Cache-Control', 'no-store')
      .send(response);
    
    return false;
  }
  
  return true;
}
