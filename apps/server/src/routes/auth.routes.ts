/**
 * Auth Routes
 * 
 * Handles Owner PIN authentication:
 * - POST /api/auth/pin/set - Set or rotate PIN
 * - POST /api/auth/pin/login - Verify PIN and create session
 * - POST /api/auth/pin/logout - Clear session
 * - GET /api/auth/me - Get current auth state
 * 
 * SECURITY:
 * - PIN values are never logged
 * - Session tokens are HttpOnly cookies
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import {
  isPinConfigured,
  setOwnerPin,
  verifyOwnerPin,
  createSessionToken,
  verifySessionToken,
  SESSION_COOKIE_NAME,
  SESSION_COOKIE_OPTIONS,
} from '../auth/index.js';
import { logger } from '../utils/logger.js';

const SetPinSchema = z.object({
  pin: z.string(),
});

const LoginSchema = z.object({
  pin: z.string(),
});

/**
 * Helper to check if request has valid admin session
 */
function isAdminSession(req: FastifyRequest): boolean {
  const cookies = req.cookies || {};
  const token = cookies[SESSION_COOKIE_NAME];
  return verifySessionToken(token);
}

/**
 * Helper to require admin for a request (returns 401 if not admin)
 */
export function requireAdmin(req: FastifyRequest, reply: FastifyReply): boolean {
  if (!isAdminSession(req)) {
    reply.status(401).send({ ok: false, error: 'Admin authentication required' });
    return false;
  }
  return true;
}

export function registerAuthRoutes(fastify: FastifyInstance) {
  // Register cookie parser if not already registered
  // Note: @fastify/cookie should be registered in main index.ts
  
  /**
   * POST /api/auth/pin/set
   * 
   * Set the owner PIN. Allowed when:
   * - PIN is not yet configured (first-run)
   * - Caller is already admin (rotation)
   */
  fastify.post('/api/auth/pin/set', async (req, reply) => {
    const pinConfigured = isPinConfigured();
    
    // If PIN already set, require admin session to change it
    if (pinConfigured && !isAdminSession(req)) {
      return reply.status(401).send({ 
        ok: false, 
        error: 'Admin authentication required to change PIN' 
      });
    }
    
    const body = SetPinSchema.safeParse(req.body);
    if (!body.success) {
      return reply.status(400).send({ ok: false, error: 'Invalid request body' });
    }
    
    const result = await setOwnerPin(body.data.pin);
    
    if (!result.ok) {
      return reply.status(400).send({ ok: false, error: result.error });
    }
    
    // Log security event (without PIN value)
    logger.info({ type: 'security', event: 'pin_set', wasRotation: pinConfigured }, 
      pinConfigured ? 'Owner PIN rotated' : 'Owner PIN configured');
    
    return reply.send({ ok: true });
  });
  
  /**
   * POST /api/auth/pin/login
   * 
   * Verify PIN and create admin session.
   * Sets HttpOnly cookie on success.
   */
  fastify.post('/api/auth/pin/login', async (req, reply) => {
    if (!isPinConfigured()) {
      return reply.status(400).send({ 
        ok: false, 
        error: 'PIN not configured. Complete setup first.' 
      });
    }
    
    const body = LoginSchema.safeParse(req.body);
    if (!body.success) {
      return reply.status(400).send({ ok: false, error: 'Invalid request body' });
    }
    
    const valid = await verifyOwnerPin(body.data.pin);
    
    if (!valid) {
      // Log failed attempt (without PIN value)
      logger.warn({ type: 'security', event: 'login_failed' }, 'PIN login failed');
      return reply.status(401).send({ ok: false, error: 'Invalid PIN' });
    }
    
    // Create session token and set cookie
    const token = createSessionToken();
    
    reply.setCookie(SESSION_COOKIE_NAME, token, {
      httpOnly: SESSION_COOKIE_OPTIONS.httpOnly,
      secure: SESSION_COOKIE_OPTIONS.secure,
      sameSite: SESSION_COOKIE_OPTIONS.sameSite,
      path: SESSION_COOKIE_OPTIONS.path,
      maxAge: SESSION_COOKIE_OPTIONS.maxAge / 1000, // Fastify uses seconds
    });
    
    logger.info({ type: 'security', event: 'login_success' }, 'Admin login successful');
    
    return reply.send({ ok: true });
  });
  
  /**
   * POST /api/auth/pin/logout
   * 
   * Clear the admin session cookie.
   */
  fastify.post('/api/auth/pin/logout', async (req, reply) => {
    reply.clearCookie(SESSION_COOKIE_NAME, {
      path: SESSION_COOKIE_OPTIONS.path,
    });
    
    logger.info({ type: 'security', event: 'logout' }, 'Admin logout');
    
    return reply.send({ ok: true });
  });
  
  /**
   * GET /api/auth/me
   * 
   * Returns current auth state (no sensitive data).
   */
  fastify.get('/api/auth/me', async (req, reply) => {
    const pinConfigured = isPinConfigured();
    const admin = isAdminSession(req);
    
    return reply.send({
      ok: true,
      admin,
      pinConfigured,
    });
  });
}
