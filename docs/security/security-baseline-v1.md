# Security Baseline v1

This document describes the production-grade security controls implemented in JARVIS V5 OS.

## Overview

Security Baseline v1 provides:
- **Brute-force protection** via rate limiting on authentication endpoints
- **CSRF protection** via double-submit cookie pattern
- **Session cookie hardening** per OWASP guidelines
- **Audit logging** for security-relevant events

## Rate Limiting

### Protected Endpoints

| Endpoint | Limit | Window | Lockout |
|----------|-------|--------|---------|
| POST /api/auth/pin/login | 5 attempts | 15 min | 30 min |
| POST /api/auth/pin/set | 5 attempts | 15 min | 30 min |
| PUT /api/admin/keys | 20 attempts | 5 min | 5 min |
| DELETE /api/admin/keys/:name | 20 attempts | 5 min | 5 min |
| POST /api/admin/llm/config | 20 attempts | 5 min | 5 min |
| POST /api/admin/llm/test | 30 attempts | 5 min | 2 min |

### Rate Limit Response Format

When rate limited, endpoints return HTTP 429 with:

```json
{
  "ok": false,
  "error": {
    "code": "RATE_LIMITED",
    "message": "Too many attempts. Try again in X seconds."
  },
  "retryAfterSec": 1800,
  "security": {
    "attemptsRemaining": 0,
    "windowSec": 900,
    "lockedOut": true
  }
}
```

The `Retry-After` header is also set with the lockout duration in seconds.

### IP Detection

Rate limiting keys by client IP address, respecting `X-Forwarded-For` header from reverse proxies (Caddy).

## CSRF Protection

### Mechanism

We use the **double-submit cookie pattern**:

1. Server issues a CSRF token in the `akior_csrf_token` cookie
2. Cookie is **not HttpOnly** so JavaScript can read it
3. Cookie is **SameSite=Strict** to prevent cross-site sending
4. Client must include the token in the `X-CSRF-Token` header
5. Server validates that cookie and header match exactly

### Token Issuance

CSRF tokens are issued on:
- `GET /api/auth/me` (page load)
- `POST /api/auth/pin/login` (rotated on login)

### Protected Endpoints

CSRF validation is required on all state-changing admin routes:
- `PUT /api/admin/keys`
- `DELETE /api/admin/keys/:name`
- `POST /api/admin/llm/config`

Note: `GET /api/admin/keys/meta` is intentionally **not** CSRF-protected as it's read-only and needed by the setup page.

### CSRF Error Response

When CSRF validation fails, endpoints return HTTP 403:

```json
{
  "ok": false,
  "error": {
    "code": "CSRF_REQUIRED",
    "message": "CSRF token required..."
  }
}
```

### Web App Integration (Client Side)

The web app provides built-in CSRF support via the `apiFetch` utility:

**Location:** `apps/web/src/lib/apiFetch.ts`

**Usage:**
```typescript
import { apiFetch, CsrfError } from '@/lib/apiFetch';

// apiFetch automatically:
// - Reads akior_csrf_token cookie
// - Attaches X-CSRF-Token header for POST/PUT/PATCH/DELETE
// - Includes credentials: 'include' for cookies
// - Throws CsrfError on 403 CSRF_REQUIRED response

try {
  const response = await apiFetch('/api/admin/keys', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ openai: 'sk-...' })
  });
} catch (error) {
  if (error instanceof CsrfError) {
    // Session expired, show user-friendly message
    showError('Your session has expired. Please refresh the page.');
  }
}
```

**Supporting utilities:**
- `apps/web/src/lib/cookies.ts` - `getCookie(name)` for reading browser cookies
- `apps/web/src/lib/csrf.ts` - `getCsrfToken()` and constants for CSRF cookie/header names

**Manual integration (if not using apiFetch):**
```javascript
import { getCsrfToken, CSRF_HEADER_NAME } from '@/lib/csrf';

fetch('/api/admin/keys', {
  method: 'PUT',
  credentials: 'include',
  headers: {
    'Content-Type': 'application/json',
    [CSRF_HEADER_NAME]: getCsrfToken() || ''
  },
  body: JSON.stringify({ openai: 'sk-...' })
});
```

## Session Cookie Security

### Cookie Flags

Session cookies (`akior_admin_session`) are set with:

| Flag | Value | Purpose |
|------|-------|---------|
| HttpOnly | true | Prevents XSS access to session |
| Secure | true | HTTPS only |
| SameSite | Strict | Prevents CSRF by blocking cross-site sending |
| Path | / | Valid for all routes |
| Max-Age | 3600 | 1 hour session duration |

### Session Rotation

Sessions are rotated (new token issued) on successful login to prevent session fixation attacks.

### Cache Headers

Authentication responses include `Cache-Control: no-store` to prevent caching of sensitive data.

## Audit Log

### Location

Audit events are logged to `/app/data/audit.log` (JSONL format).

### Events Logged

| Event | Description |
|-------|-------------|
| pin_set | Owner PIN configured or rotated |
| pin_login_success | Successful PIN login |
| pin_login_failed | Failed PIN login attempt |
| admin_key_set | API key saved |
| admin_key_delete | API key deleted |
| llm_config_saved | LLM provider configuration changed |
| llm_test_run | LLM connectivity test executed |
| rate_limited | Request blocked by rate limiter |
| csrf_failed | CSRF validation failed |
| logout | Admin logged out |

### Log Entry Format

```json
{
  "event": "pin_login_failed",
  "timestamp": "2026-02-06T03:00:00.000Z",
  "ipHash": "a1b2c3d4e5f6...",
  "route": "/api/auth/pin/login",
  "outcome": "failure"
}
```

### Redaction Guarantees

The following are **never logged**:
- PIN values
- API keys
- Session tokens
- Full IP addresses (hashed with salt)
- Cookie values

### File Rotation

The audit log rotates at 10MB, keeping one backup (`audit.log.1`).

## HTTP Status Code Semantics

The security middleware maintains proper HTTP status code semantics:

| Status | Meaning | When Used |
|--------|---------|-----------|
| 428 | Precondition Required | Setup incomplete (PIN or LLM not configured) |
| 401 | Unauthorized | Not authenticated (valid session required) |
| 429 | Too Many Requests | Rate limit exceeded |
| 403 | Forbidden | CSRF token missing or invalid |

Order of checks:
1. Setup complete? → 428 if not
2. Authenticated? → 401 if not
3. Rate limited? → 429 if yes
4. CSRF valid? → 403 if not

## Testing

Run security contract tests:

```bash
npm run test:security-contract
```

Or with custom backend:

```bash
BACKEND_URL=https://your-server:1234 TEST_PIN=your-pin npm run test:security-contract
```

## References

- [OWASP Session Management Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html)
- [OWASP CSRF Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html)
- [RFC 6585 - 429 Too Many Requests](https://tools.ietf.org/html/rfc6585#section-4)
