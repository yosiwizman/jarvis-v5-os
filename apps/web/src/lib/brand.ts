/**
 * Centralized brand constants for AKIOR
 * Use these constants throughout the app for consistent branding
 */

/** Primary hostname for LAN access (RFC 8375 recommended) */
export const PRIMARY_HOSTNAME = 'akior.home.arpa';

/** Legacy hostname aliases */
export const SECONDARY_HOSTNAMES = ['akior.local', 'jarvis.local', 'localhost'];

export const BRAND = {
  productName: 'AKIOR',
  legacyName: 'Jarvis',
  tagline: 'Intelligent AI Assistant Console',
  description: 'AKIOR - Intelligent AI Assistant Console',
  /** Derived from PRIMARY_HOSTNAME to keep single source of truth */
  canonicalUrl: `https://${PRIMARY_HOSTNAME}`
};

/** Branding version for cache-busting (increment when branding assets change) */
export const BRAND_VERSION = '2026-02-02-canonical-host';

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
