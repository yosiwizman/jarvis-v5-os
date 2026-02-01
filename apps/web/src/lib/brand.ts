/**
 * Centralized brand constants for AKIOR
 * Use these constants throughout the app for consistent branding
 */

export const BRAND = {
  productName: 'AKIOR',
  legacyName: 'Jarvis',
  tagline: 'Intelligent AI Assistant Console',
  description: 'AKIOR - Intelligent AI Assistant Console',
  canonicalUrl: 'https://akior.local'
};

export const productName = BRAND.productName;
export const legacyName = BRAND.legacyName;
export const tagline = BRAND.tagline;
export const description = BRAND.description;
export const canonicalUrl = BRAND.canonicalUrl;

/** Primary app name - use this in all user-facing text */
export const APP_NAME = BRAND.productName;

/** Full app name with expansion */
export const APP_NAME_FULL = `${BRAND.productName} (Advanced Knowledge & Intelligence Operating Resource)`;

/** Legacy name - kept for backward compatibility in routes/hostnames */
export const LEGACY_NAME = BRAND.legacyName;

/** App description for metadata */
export const APP_DESCRIPTION = BRAND.description;

/** Primary hostname for LAN access */
export const PRIMARY_HOSTNAME = 'akior.local';

/** Legacy hostname alias */
export const LEGACY_HOSTNAME = 'jarvis.local';

/** Voice assistant route */
export const VOICE_ROUTE = '/jarvis'; // Legacy route, keep for backward compat

/** Settings version for migration tracking */
export const SETTINGS_VERSION = 1;
