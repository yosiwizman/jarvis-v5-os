/**
 * PIN Authentication
 * 
 * Secure PIN hashing using Node.js crypto scrypt.
 * Uses high-cost parameters suitable for local authentication.
 * 
 * SECURITY:
 * - Never log PIN values
 * - Use constant-time comparison for hash verification
 */

import { scrypt, randomBytes, timingSafeEqual, ScryptOptions } from 'crypto';
import { readAuthData, updateAuthData } from './authStore.js';

// Scrypt parameters (OWASP recommended for interactive logins)
const SCRYPT_N = 16384;  // CPU/memory cost parameter
const SCRYPT_R = 8;      // Block size
const SCRYPT_P = 1;      // Parallelization parameter
const KEY_LENGTH = 64;   // Output length in bytes
const SALT_LENGTH = 16;  // Salt length in bytes

/**
 * Validate PIN format (4-8 digits)
 */
export function validatePinFormat(pin: string): { valid: boolean; error?: string } {
  if (!pin || typeof pin !== 'string') {
    return { valid: false, error: 'PIN is required' };
  }
  
  if (!/^\d{4,8}$/.test(pin)) {
    return { valid: false, error: 'PIN must be 4-8 digits' };
  }
  
  return { valid: true };
}

/**
 * Hash a PIN using scrypt (promisified)
 */
function hashPin(pin: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const options: ScryptOptions = {
      N: SCRYPT_N,
      r: SCRYPT_R,
      p: SCRYPT_P,
    };
    scrypt(pin, salt, KEY_LENGTH, options, (err, derivedKey) => {
      if (err) reject(err);
      else resolve(derivedKey);
    });
  });
}

/**
 * Set the owner PIN (first-time setup or rotation)
 * 
 * @param pin - The PIN to set (4-8 digits)
 * @returns Success status
 */
export async function setOwnerPin(pin: string): Promise<{ ok: boolean; error?: string }> {
  const validation = validatePinFormat(pin);
  if (!validation.valid) {
    return { ok: false, error: validation.error };
  }
  
  // Generate new salt
  const salt = randomBytes(SALT_LENGTH);
  
  // Hash the PIN
  const hash = await hashPin(pin, salt);
  
  // Store hash and salt (hex-encoded)
  updateAuthData({
    ownerPinHash: hash.toString('hex'),
    ownerPinSalt: salt.toString('hex'),
  });
  
  return { ok: true };
}

/**
 * Verify a PIN against the stored hash
 * 
 * @param pin - The PIN to verify
 * @returns Whether the PIN is correct
 */
export async function verifyOwnerPin(pin: string): Promise<boolean> {
  const data = readAuthData();
  
  if (!data.ownerPinHash || !data.ownerPinSalt) {
    return false;
  }
  
  const validation = validatePinFormat(pin);
  if (!validation.valid) {
    return false;
  }
  
  const storedHash = Buffer.from(data.ownerPinHash, 'hex');
  const salt = Buffer.from(data.ownerPinSalt, 'hex');
  
  const computedHash = await hashPin(pin, salt);
  
  // Constant-time comparison to prevent timing attacks
  return timingSafeEqual(storedHash, computedHash);
}
