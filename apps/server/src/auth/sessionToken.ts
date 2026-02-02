/**
 * Session Token Management
 * 
 * Creates and verifies HMAC-signed, time-bound session tokens.
 * Tokens are stored in HttpOnly cookies for security.
 * 
 * Token format: base64(JSON({ exp, nonce })) + "." + base64(HMAC-SHA256)
 * 
 * SECURITY:
 * - Never log token values
 * - Tokens expire after SESSION_DURATION_MS
 * - HMAC prevents tampering
 */

import { createHmac, randomBytes } from 'crypto';
import { getOrCreateSessionSecret } from './authStore.js';

// Session duration: 1 hour
const SESSION_DURATION_MS = 60 * 60 * 1000;

// Cookie configuration
export const SESSION_COOKIE_NAME = 'akior_admin_session';
export const SESSION_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: true,
  sameSite: 'lax' as const,
  path: '/',
  maxAge: SESSION_DURATION_MS,
};

type TokenPayload = {
  exp: number;   // Expiration timestamp (ms since epoch)
  nonce: string; // Random value to ensure uniqueness
};

/**
 * Create a signed session token
 */
export function createSessionToken(): string {
  const secret = getOrCreateSessionSecret();
  
  const payload: TokenPayload = {
    exp: Date.now() + SESSION_DURATION_MS,
    nonce: randomBytes(16).toString('hex'),
  };
  
  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = createHmac('sha256', secret)
    .update(payloadB64)
    .digest('base64url');
  
  return `${payloadB64}.${signature}`;
}

/**
 * Verify a session token
 * 
 * @param token - The token to verify
 * @returns Whether the token is valid and not expired
 */
export function verifySessionToken(token: string | undefined): boolean {
  if (!token || typeof token !== 'string') {
    return false;
  }
  
  const parts = token.split('.');
  if (parts.length !== 2) {
    return false;
  }
  
  const [payloadB64, signature] = parts;
  
  // Verify signature
  const secret = getOrCreateSessionSecret();
  const expectedSignature = createHmac('sha256', secret)
    .update(payloadB64!)
    .digest('base64url');
  
  if (signature !== expectedSignature) {
    return false;
  }
  
  // Parse and check expiration
  try {
    const payloadJson = Buffer.from(payloadB64!, 'base64url').toString('utf8');
    const payload = JSON.parse(payloadJson) as TokenPayload;
    
    if (!payload.exp || payload.exp < Date.now()) {
      return false;
    }
    
    return true;
  } catch {
    return false;
  }
}

/**
 * Parse the expiration time from a token (for debugging/display only)
 */
export function getTokenExpiration(token: string): Date | null {
  if (!token) return null;
  
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  
  try {
    const payloadJson = Buffer.from(parts[0]!, 'base64url').toString('utf8');
    const payload = JSON.parse(payloadJson) as TokenPayload;
    return new Date(payload.exp);
  } catch {
    return null;
  }
}
