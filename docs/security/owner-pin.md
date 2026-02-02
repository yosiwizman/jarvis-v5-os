# Owner PIN Authentication

## Overview

AKIOR uses an Owner PIN to protect administrative access to sensitive configuration pages and APIs. This is a local-only authentication system designed for LAN deployments where the threat model is shared network access.

## Purpose

The Owner PIN system:
- **Protects admin surfaces** - Setup Wizard, Settings, and admin API endpoints require authentication after initial setup
- **Enables first-run setup** - New installations can complete initial configuration before PIN is required
- **Provides session-based access** - Authenticated sessions last 1 hour via HttpOnly cookies
- **Keeps secrets server-side** - PIN hash, salt, and session secrets are never exposed to clients

## Protected Routes

### Pages (redirect to /login when not authenticated)
- `/setup` - Setup Wizard (except during first-run when PIN not configured)
- `/settings` - System configuration

### API Endpoints (return 401 JSON when not authenticated)
- `/api/admin/*` - All admin API routes
- `/api/auth/pin/set` - Requires admin session for PIN rotation (first-time setup allowed without auth)

## First-Run Flow

1. User visits AKIOR for the first time
2. `/api/health/status` returns `setup_required` with reason "Owner PIN not configured"
3. Menu shows "Setup Wizard" card with "First run" badge
4. `/setup` is accessible without authentication
5. User sets 4-8 digit PIN in Step 1 of Setup Wizard
6. After PIN is set, admin routes require authentication

## Authentication Flow

### Setting PIN (First-time or Rotation)
```
POST /api/auth/pin/set
Content-Type: application/json

{ "pin": "1234" }
```

**Requirements:**
- PIN must be 4-8 numeric digits
- First-time: No authentication required
- Rotation: Requires existing admin session

### Logging In
```
POST /api/auth/pin/login
Content-Type: application/json

{ "pin": "1234" }
```

**On success:**
- Sets HttpOnly `akior_admin_session` cookie
- Returns `{ "ok": true }`
- Session valid for 1 hour

### Logging Out
```
POST /api/auth/pin/logout
```

**Effect:**
- Clears session cookie
- Subsequent requests are unauthenticated

### Checking Auth State
```
GET /api/auth/me
```

**Returns:**
```json
{
  "ok": true,
  "admin": false,
  "pinConfigured": true
}
```

## Security Implementation

### PIN Storage
- PIN is hashed using **scrypt** with:
  - N=16384 (CPU/memory cost)
  - r=8 (block size)
  - p=1 (parallelization)
  - 64-byte output length
- 16-byte random salt per PIN
- Stored in `data/auth.json` (hash and salt only, never the PIN)

### Session Tokens
- HMAC-SHA256 signed with persistent server secret
- Token format: `base64(payload).base64(signature)`
- Payload contains expiration time and random nonce
- 1-hour validity

### Cookie Security
```
HttpOnly: true
Secure: true
SameSite: Lax
Path: /
```

### Logging
- Failed login attempts are logged (without PIN value)
- Successful logins are logged
- PIN set/rotation events are logged
- No sensitive values (PIN, hash, token) are ever logged

## Threat Model

### Protected Against
- **Casual LAN access** - Prevents unauthorized users on the same network from modifying configuration
- **Client-side inspection** - PIN is never stored or transmitted in localStorage/sessionStorage
- **Timing attacks** - Constant-time comparison for PIN verification
- **Session hijacking** - HttpOnly cookies prevent JavaScript access

### Not Protected Against
- **Physical access to server** - `data/auth.json` is readable on disk
- **Root access on server** - Can read session secret and forge tokens
- **Network interception** - Requires HTTPS to protect cookie in transit (enforced by Caddy)

## Reset Procedure

If you forget your PIN:

1. Stop AKIOR containers: `docker compose down`
2. Delete auth data: `rm data/auth.json`
3. Start containers: `.\ops\deploy.ps1`
4. Complete first-run setup again

⚠️ **Warning:** This also clears the session secret, invalidating any existing sessions.

## UI Indicators

### Menu Page
- **Admin unlocked** (green) - Active admin session
- **Admin locked** (gray) - Not authenticated
- Lock icons on protected cards when not admin

### Setup Page
- Step 1 shows "Configured ✓" when PIN is set
- Shows "Owner PIN is configured. Admin routes are protected."

### Diagnostics Page
- Shows "Owner PIN: Configured/Not configured"
- Shows "Admin session: Active/Inactive"

## API Response Codes

| Code | Meaning |
|------|---------|
| 200 | Success |
| 400 | Invalid request (bad PIN format, PIN not configured) |
| 401 | Authentication required or invalid PIN |
