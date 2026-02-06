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

---

# Security Baseline v2

Security Baseline v2 extends v1 with HTTP security headers and Origin enforcement.

## HTTP Security Headers

### Headers Applied

The following headers are applied to ALL server responses:

| Header | Value | Purpose |
|--------|-------|---------|
| X-Content-Type-Options | nosniff | Prevents MIME-type sniffing attacks |
| X-Frame-Options | DENY | Prevents clickjacking by blocking iframes |
| Referrer-Policy | no-referrer | Prevents leaking URL info in referrer header |
| Permissions-Policy | camera=(), microphone=() | Disables camera/microphone access |
| Strict-Transport-Security | max-age=604800; includeSubDomains | Enforces HTTPS for 1 week |
| Content-Security-Policy-Report-Only | default-src 'self'; frame-ancestors 'none' | CSP in report-only mode for monitoring |

### Implementation Locations

- **Server:** `apps/server/src/security/headers.ts` - Fastify `onSend` hook applies headers to all responses
- **Web:** `apps/web/next.config.mjs` - Next.js `headers()` function applies headers to all routes

### Rationale

**X-Content-Type-Options: nosniff**
Prevents browsers from MIME-sniffing the response content type. Mitigates attacks where malicious files are interpreted as executable content.

**X-Frame-Options: DENY**
Prevents the page from being embedded in iframes, blocking clickjacking attacks where attackers overlay invisible iframes to trick users into clicking malicious elements.

**Referrer-Policy: no-referrer**
Prevents sending the full URL in the Referer header to external sites, protecting sensitive URL parameters and internal paths from leaking.

**Permissions-Policy**
Explicitly disables access to sensitive browser features (camera, microphone). Even if the app doesn't use these features, blocking them prevents exploitation if XSS occurs.

**Strict-Transport-Security (HSTS)**
Tells browsers to only connect via HTTPS for the next 7 days (604800 seconds). Prevents SSL stripping attacks and accidental HTTP connections.

**Content-Security-Policy-Report-Only**
Defines a Content Security Policy but only reports violations without blocking. Allows monitoring before enforcing. The policy:
- `default-src 'self'` - Only allow resources from same origin by default
- `frame-ancestors 'none'` - Equivalent to X-Frame-Options: DENY

## Origin Enforcement

### Mechanism

State-changing admin endpoints validate the `Origin` header to prevent cross-origin attacks:

1. Extract `Origin` header from the request
2. Compare against an allowlist of trusted origins
3. If Origin is missing or not in allowlist → 403 ORIGIN_NOT_ALLOWED
4. Request proceeds if Origin is valid

### Protected Endpoints

Origin enforcement applies to these state-changing admin routes:
- `PUT /api/admin/keys`
- `DELETE /api/admin/keys/:name`
- `POST /api/admin/llm/config`

### Default Allowlist

By default, the following origins are allowed:
- `https://{request-host}` - Same host over HTTPS
- `http://{request-host}` - Same host over HTTP (dev)
- `http://localhost:3000` - Next.js dev server
- `http://localhost:1234` - Backend dev server

### Environment Configuration

To customize allowed origins, set the `ALLOWED_ORIGINS` environment variable:

```bash
# Comma-separated list of allowed origins
ALLOWED_ORIGINS=https://app.example.com,https://admin.example.com
```

When `ALLOWED_ORIGINS` is set, only those origins are allowed (the dynamic defaults are NOT used).

### Origin Rejection Response

When Origin validation fails, endpoints return HTTP 403:

```json
{
  "ok": false,
  "error": {
    "code": "ORIGIN_NOT_ALLOWED",
    "message": "Request origin not allowed"
  }
}
```

The event is logged to the audit log as `origin_rejected`.

### Order of Security Checks

With v2, the order of checks for admin mutation routes is:

1. Setup complete? → 428 if not
2. Authenticated? → 401 if not
3. Origin valid? → 403 ORIGIN_NOT_ALLOWED if not
4. Rate limited? → 429 if yes
5. CSRF valid? → 403 CSRF_REQUIRED/CSRF_INVALID if not

## Testing Security v2

Run security headers and origin contract tests:

```bash
npm run test:security-headers-contract
```

Or with custom backend:

```bash
BACKEND_URL=https://your-server:1234 TEST_PIN=your-pin npm run test:security-headers-contract
```

## References

- [OWASP Session Management Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html)
- [OWASP CSRF Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html)
- [RFC 6585 - 429 Too Many Requests](https://tools.ietf.org/html/rfc6585#section-4)
- [OWASP Secure Headers Project](https://owasp.org/www-project-secure-headers/)
- [MDN: Content Security Policy](https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP)
- [MDN: Strict-Transport-Security](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Strict-Transport-Security)
