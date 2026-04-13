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
 * - Session tokens are HttpOnly cookies (Secure, SameSite=strict)
 * - Rate limiting prevents brute-force attacks
 * - Session rotation on login prevents fixation attacks
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { z } from "zod";
import {
  isPinConfigured,
  setOwnerPin,
  verifyOwnerPin,
  rotateSessionToken,
  verifySessionToken,
  SESSION_COOKIE_NAME,
  SESSION_COOKIE_OPTIONS,
} from "../auth/index.js";
import { logger } from "../utils/logger.js";
import {
  RateLimitPresets,
  checkRateLimit,
  getClientIp,
  ensureCsrfToken,
  rotateCsrfToken,
  clearCsrfToken,
  audit,
} from "../security/index.js";

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
export function requireAdmin(
  req: FastifyRequest,
  reply: FastifyReply,
): boolean {
  if (!isAdminSession(req)) {
    reply
      .status(401)
      .send({ ok: false, error: "Admin authentication required" });
    return false;
  }
  return true;
}

/**
 * Helper that allows access if PIN is not yet configured (setup mode)
 * OR if the caller has a valid admin session.
 * Use for read-only status endpoints that the setup wizard needs before auth.
 */
export function requireAdminOrSetup(
  req: FastifyRequest,
  reply: FastifyReply,
): boolean {
  // During initial setup (no PIN set), allow access so the wizard can load status
  if (!isPinConfigured()) {
    return true;
  }
  // After PIN is configured, require a valid admin session
  return requireAdmin(req, reply);
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
   *
   * SECURITY: Rate limited to prevent PIN hammering.
   */
  fastify.post("/api/auth/pin/set", async (req, reply) => {
    const ip = getClientIp(req);
    const pinConfigured = isPinConfigured();

    // Rate limit PIN set attempts (same limits as login)
    const rateCheck = checkRateLimit(
      { ...RateLimitPresets.PIN_AUTH, routeKey: "pin-set" },
      ip,
    );
    if (!rateCheck.allowed && rateCheck.response) {
      return reply
        .status(429)
        .header("Retry-After", String(rateCheck.response.retryAfterSec))
        .header("Cache-Control", "no-store")
        .send(rateCheck.response);
    }

    // If PIN already set, require admin session to change it
    if (pinConfigured && !isAdminSession(req)) {
      return reply.status(401).send({
        ok: false,
        error: "Admin authentication required to change PIN",
      });
    }

    const body = SetPinSchema.safeParse(req.body);
    if (!body.success) {
      return reply
        .status(400)
        .send({ ok: false, error: "Invalid request body" });
    }

    const result = await setOwnerPin(body.data.pin);

    if (!result.ok) {
      return reply.status(400).send({ ok: false, error: result.error });
    }

    // Log security event (without PIN value)
    logger.info(
      { type: "security", event: "pin_set", wasRotation: pinConfigured },
      pinConfigured ? "Owner PIN rotated" : "Owner PIN configured",
    );

    // Audit log
    await audit.pinSet(ip, pinConfigured);

    return reply.send({ ok: true });
  });

  /**
   * POST /api/auth/pin/login
   *
   * Verify PIN and create admin session.
   * Sets HttpOnly cookie on success.
   *
   * SECURITY:
   * - Rate limited to prevent brute-force attacks
   * - Session rotated on login to prevent fixation
   * - CSRF token rotated on login
   */
  fastify.post("/api/auth/pin/login", async (req, reply) => {
    const ip = getClientIp(req);

    // Rate limit login attempts
    const rateCheck = checkRateLimit(
      { ...RateLimitPresets.PIN_AUTH, routeKey: "pin-login" },
      ip,
    );
    if (!rateCheck.allowed && rateCheck.response) {
      return reply
        .status(429)
        .header("Retry-After", String(rateCheck.response.retryAfterSec))
        .header("Cache-Control", "no-store")
        .send(rateCheck.response);
    }

    if (!isPinConfigured()) {
      return reply.status(400).send({
        ok: false,
        error: "PIN not configured. Complete setup first.",
      });
    }

    const body = LoginSchema.safeParse(req.body);
    if (!body.success) {
      return reply
        .status(400)
        .send({ ok: false, error: "Invalid request body" });
    }

    const valid = await verifyOwnerPin(body.data.pin);

    if (!valid) {
      // Log failed attempt (without PIN value)
      logger.warn(
        { type: "security", event: "login_failed" },
        "PIN login failed",
      );
      await audit.pinLoginFailed(ip);
      return reply.status(401).send({ ok: false, error: "Invalid PIN" });
    }

    // SECURITY: Rotate session token on login to prevent session fixation
    const token = rotateSessionToken();

    reply.setCookie(SESSION_COOKIE_NAME, token, {
      httpOnly: SESSION_COOKIE_OPTIONS.httpOnly,
      secure: SESSION_COOKIE_OPTIONS.secure,
      sameSite: SESSION_COOKIE_OPTIONS.sameSite,
      path: SESSION_COOKIE_OPTIONS.path,
      maxAge: SESSION_COOKIE_OPTIONS.maxAge / 1000, // Fastify uses seconds
    });

    // Rotate CSRF token on login as well
    rotateCsrfToken(reply);

    // Add no-store cache header for auth responses
    reply.header("Cache-Control", "no-store");

    logger.info(
      { type: "security", event: "login_success" },
      "Admin login successful",
    );
    await audit.pinLoginSuccess(ip);

    return reply.send({ ok: true });
  });

  /**
   * POST /api/auth/pin/logout
   *
   * Clear the admin session cookie and CSRF token.
   */
  fastify.post("/api/auth/pin/logout", async (req, reply) => {
    const ip = getClientIp(req);

    reply.clearCookie(SESSION_COOKIE_NAME, {
      path: SESSION_COOKIE_OPTIONS.path,
    });

    // Clear CSRF token on logout
    clearCsrfToken(reply);

    logger.info({ type: "security", event: "logout" }, "Admin logout");
    await audit.logout(ip);

    return reply.send({ ok: true });
  });

  /**
   * POST /api/auth/e2e/bootstrap
   *
   * TEST-ONLY admin session bootstrap for Playwright E2E.
   *
   * SAFETY:
   * - Returns 404 unless process.env.PLAYWRIGHT_E2E_AUTH === "1"
   * - The env var is intentionally NOT set in production (Docker/Fly.io) —
   *   only in the local `start:ci` / Playwright harness.
   * - Normal auth wall (PIN + middleware redirect) is untouched for real users.
   * - Uses the same session-cookie plumbing as /api/auth/pin/login, so the
   *   issued session is a real admin session — no middleware changes needed.
   */
  fastify.post("/api/auth/e2e/bootstrap", async (req, reply) => {
    if (process.env["PLAYWRIGHT_E2E_AUTH"] !== "1") {
      return reply.status(404).send({ ok: false, error: "Not found" });
    }

    const token = rotateSessionToken();

    reply.setCookie(SESSION_COOKIE_NAME, token, {
      httpOnly: SESSION_COOKIE_OPTIONS.httpOnly,
      secure: SESSION_COOKIE_OPTIONS.secure,
      sameSite: SESSION_COOKIE_OPTIONS.sameSite,
      path: SESSION_COOKIE_OPTIONS.path,
      maxAge: SESSION_COOKIE_OPTIONS.maxAge / 1000,
    });

    rotateCsrfToken(reply);
    reply.header("Cache-Control", "no-store");

    logger.info(
      { type: "security", event: "e2e_auth_bootstrap" },
      "E2E auth bootstrap issued (test-only)",
    );

    return reply.send({ ok: true, mode: "e2e-test" });
  });

  /**
   * GET /api/auth/me
   *
   * Returns current auth state (no sensitive data).
   * Also issues CSRF token cookie if not present.
   */
  fastify.get("/api/auth/me", async (req, reply) => {
    const pinConfigured = isPinConfigured();
    const admin = isAdminSession(req);

    // Ensure CSRF token is issued (used for subsequent state-changing requests)
    ensureCsrfToken(req, reply);

    return reply.send({
      ok: true,
      admin,
      pinConfigured,
    });
  });
}
