/**
 * Centralized brand constants for AKIOR
 * Use these constants throughout the app for consistent branding
 */

/** Primary hostname for LAN access (single source of truth) */
export const PRIMARY_HOSTNAME = 'akior.local';

/** Legacy hostname alias */
export const LEGACY_HOSTNAME = 'jarvis.local';

export const BRAND = {
  productName: 'AKIOR',
  legacyName: 'Jarvis',
  tagline: 'Intelligent AI Assistant Console',
  description: 'AKIOR - Intelligent AI Assistant Console',
  /** Derived from PRIMARY_HOSTNAME to keep single source of truth */
  canonicalUrl: `https://${PRIMARY_HOSTNAME}`
};

/** Branding version for cache-busting (increment when branding assets change) */
export const BRAND_VERSION = '2026-02-01-hotfix2';

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

/** Voice assistant route */
export const VOICE_ROUTE = '/jarvis'; // Legacy route, keep for backward compat

/** Settings version for migration tracking */
export const SETTINGS_VERSION = 1;
