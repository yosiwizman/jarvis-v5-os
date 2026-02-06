import { getCookie } from './cookies';

/**
 * CSRF cookie name - must match server's CSRF_COOKIE_NAME.
 * The server sets this cookie as NOT HttpOnly so client JS can read it.
 */
export const CSRF_COOKIE_NAME = 'akior_csrf_token';

/**
 * CSRF header name - must match server's CSRF_HEADER_NAME.
 */
export const CSRF_HEADER_NAME = 'x-csrf-token';

/**
 * Retrieve the current CSRF token from the cookie.
 * Returns undefined if not found (e.g., not yet authenticated or server-side).
 */
export function getCsrfToken(): string | undefined {
  return getCookie(CSRF_COOKIE_NAME);
}
