/**
 * Auth Module
 * 
 * Exports all authentication primitives for the Owner PIN system.
 */

export { readAuthData, isPinConfigured, clearAuthData } from './authStore.js';
export { validatePinFormat, setOwnerPin, verifyOwnerPin } from './pinAuth.js';
export { 
  createSessionToken, 
  verifySessionToken, 
  rotateSessionToken,
  getTokenExpiration,
  SESSION_COOKIE_NAME,
  SESSION_COOKIE_OPTIONS 
} from './sessionToken.js';
