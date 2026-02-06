import { getCsrfToken, CSRF_HEADER_NAME } from './csrf';

/** HTTP methods that are considered "unsafe" and require CSRF protection. */
const UNSAFE_METHODS = ['POST', 'PUT', 'PATCH', 'DELETE'];

/**
 * Custom error class for CSRF validation failures (403 CSRF_REQUIRED).
 */
export class CsrfError extends Error {
  constructor(message = 'CSRF validation failed') {
    super(message);
    this.name = 'CsrfError';
  }
}

/**
 * Wrapper around fetch that automatically attaches the CSRF token header
 * for unsafe HTTP methods (POST, PUT, PATCH, DELETE).
 *
 * - Reads the `akior_csrf_token` cookie and sets `X-CSRF-Token` header.
 * - Always includes `credentials: 'include'` to send cookies.
 * - Throws `CsrfError` when response is 403 with `code: 'CSRF_REQUIRED'`.
 *
 * @param input - URL or Request object
 * @param init - Standard fetch RequestInit options
 * @returns Promise<Response>
 */
/**
 * User-friendly error message for CSRF validation failures.
 */
export const CSRF_ERROR_MESSAGE = 'Your session has expired. Please refresh the page and try again.';

/**
 * Check if an error is a CsrfError and return a user-friendly message.
 */
export function getCsrfErrorMessage(error: unknown): string | null {
  if (error instanceof CsrfError) {
    return CSRF_ERROR_MESSAGE;
  }
  return null;
}

export async function apiFetch(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  const method = (init?.method ?? 'GET').toUpperCase();
  const headers = new Headers(init?.headers);

  // Attach CSRF token for unsafe methods
  if (UNSAFE_METHODS.includes(method)) {
    const csrfToken = getCsrfToken();
    if (csrfToken) {
      headers.set(CSRF_HEADER_NAME, csrfToken);
    }
  }

  const response = await fetch(input, {
    ...init,
    headers,
    credentials: 'include',
  });

  // Check for CSRF rejection
  if (response.status === 403) {
    try {
      const clone = response.clone();
      const body = await clone.json();
      if (body?.code === 'CSRF_REQUIRED') {
        throw new CsrfError(body.error ?? 'CSRF validation failed');
      }
    } catch (e) {
      // If not a CsrfError, rethrow only CsrfError instances
      if (e instanceof CsrfError) throw e;
    }
  }

  return response;
}
