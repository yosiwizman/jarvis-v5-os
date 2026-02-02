/**
 * Auth Store
 * 
 * Persistent storage for authentication material.
 * Stores owner PIN hash, salt, and session secret.
 * 
 * SECURITY: Never log or expose raw auth values.
 */

import fs from 'fs';
import path from 'path';
import { randomBytes } from 'crypto';

export type AuthData = {
  ownerPinHash?: string;    // hex-encoded scrypt hash
  ownerPinSalt?: string;    // hex-encoded salt
  authSessionSecret?: string; // hex-encoded HMAC secret
};

const DATA_DIR = path.resolve(process.cwd(), 'data');
const AUTH_FILE = path.join(DATA_DIR, 'auth.json');

// Ensure data directory exists
fs.mkdirSync(DATA_DIR, { recursive: true });

/**
 * Read auth data from disk
 */
export function readAuthData(): AuthData {
  try {
    if (!fs.existsSync(AUTH_FILE)) {
      return {};
    }
    const raw = fs.readFileSync(AUTH_FILE, 'utf8');
    return JSON.parse(raw) as AuthData;
  } catch {
    return {};
  }
}

/**
 * Write auth data to disk
 */
export function writeAuthData(data: AuthData): void {
  fs.writeFileSync(AUTH_FILE, JSON.stringify(data, null, 2));
}

/**
 * Update specific auth fields (merge with existing)
 */
export function updateAuthData(updates: Partial<AuthData>): AuthData {
  const current = readAuthData();
  const next = { ...current, ...updates };
  writeAuthData(next);
  return next;
}

/**
 * Check if owner PIN is configured
 */
export function isPinConfigured(): boolean {
  const data = readAuthData();
  return Boolean(data.ownerPinHash && data.ownerPinSalt);
}

/**
 * Get or generate the session secret (used for HMAC signing)
 * Generated once and persisted.
 */
export function getOrCreateSessionSecret(): string {
  const data = readAuthData();
  
  if (data.authSessionSecret) {
    return data.authSessionSecret;
  }
  
  // Generate 32-byte (256-bit) secret
  const secret = randomBytes(32).toString('hex');
  updateAuthData({ authSessionSecret: secret });
  return secret;
}

/**
 * Clear all auth data (for testing or reset)
 */
export function clearAuthData(): void {
  writeAuthData({});
}
