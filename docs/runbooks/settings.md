# Settings Management Runbook

This document explains the settings normalization contract, how to debug settings issues, and how to run the test suites.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                          Client (Browser)                           │
├─────────────────────────────────────────────────────────────────────┤
│  localStorage ─────▶ readSettings() ─────▶ normalizeSettings()     │
│        ▲                    │                      │                │
│        │                    ▼                      ▼                │
│        └───────────── settingsCache ◀──── AppSettings (complete)   │
│                             │                                       │
│                             ▼                                       │
│                    loadSettingsFromServer()                        │
│                             │                                       │
└─────────────────────────────┼───────────────────────────────────────┘
                              │ fetch('/api/settings')
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                          Server (Fastify)                           │
├─────────────────────────────────────────────────────────────────────┤
│  GET /settings ─────▶ validateAndNormalizeSettings() ◀─── Zod      │
│        ▲                    │                                       │
│        │                    ▼                                       │
│   settings.json ◀──── normalizeServerSettings()                    │
│   (data/settings.json)      │                                       │
│                             ▼                                       │
│                    AppSettings (always complete)                   │
└─────────────────────────────────────────────────────────────────────┘
```

## Normalization Contract

### Guarantee
The settings API (`GET /api/settings`) **always** returns a complete, normalized `AppSettings` object. It will never return:
- Partial objects (missing nested keys)
- `null` or `undefined` values for required objects
- 500 errors for corrupted settings files

### Single Choke-Point Pattern
All settings pass through `normalizeSettings()` (client) or `normalizeServerSettings()` (server) which:
1. Deep-merges user values with defaults
2. Ensures all integration keys exist
3. Fills missing nested properties

### Required Integration Keys
The following integrations must always be present after normalization:
- `weather`, `webSearch`, `localLLM`, `elevenLabs`, `azureTTS`
- `spotify`, `gmail`, `googleCalendar`, `alexa`, `irobot`, `nest`, `smartLights`

## Key Files

| File | Purpose |
|------|---------|
| `packages/shared/src/settings.ts` | Client-side settings module with `readSettings()`, `normalizeSettings()` |
| `apps/server/src/utils/settingsContract.ts` | Server-side Zod schema and `validateAndNormalizeSettings()` |
| `apps/server/src/index.ts` (GET /settings) | API endpoint using contract validation |
| `scripts/test-settings-normalization.ts` | Client-side normalization unit tests |
| `scripts/test-settings-contract.ts` | Server-side contract validation tests |
| `e2e/settings.smoke.spec.ts` | Playwright E2E smoke tests |

## Debugging

### Symptom: `/settings` Page Crashes with TypeError

**Error pattern:**
```
TypeError: Cannot read properties of undefined (reading 'weather')
```

**Root cause:** Settings in localStorage or server response are partial/missing integration keys.

**Debug steps:**
1. Check browser console for the full stack trace
2. Open DevTools → Application → Local Storage → `smartMirrorSettings`
3. Verify the stored JSON has `integrations.weather` etc.

**Fix:**
```js
// Clear corrupted localStorage
localStorage.removeItem('smartMirrorSettings');
// Refresh page - will fetch normalized settings from server
```

### Symptom: Server Returns Partial Settings

**Debug steps:**
1. Check server logs for `[SettingsContract]` warnings
2. Inspect `data/settings.json` for missing keys
3. Run contract tests: `npm run test:contract`

**Fix (reset to defaults):**
```bash
# Backup and remove settings file
mv data/settings.json data/settings.json.bak
# Restart server - will return normalized defaults
```

### Symptom: Settings Changes Not Persisting

**Debug steps:**
1. Check browser console for "Failed to save settings to server" warnings
2. Verify server is running and `/api/settings` POST works
3. Check `data/settings.json` file permissions

## Running Tests

### Unit Tests (Client-Side Normalization)
```bash
npm run test:settings
```
Tests the client-side `normalizeSettings()` function with 15 regression scenarios.

### Contract Tests (Server-Side API)
```bash
npm run test:contract
```
Tests the server-side Zod validation and normalization with 25+ test cases including:
- JSON parsing edge cases
- Partial settings normalization
- PR #48 regression scenarios

### E2E Smoke Tests (Playwright)
```bash
# Local (starts dev server automatically)
npm run test:e2e

# CI (headless chromium only)
npm run test:e2e:ci
```
Tests:
- `/settings` loads without JavaScript errors
- Fresh context (empty localStorage) doesn't crash
- Corrupted localStorage recovery
- API contract validation

### Full CI Pipeline
```bash
# Run all tests locally
npm run test:settings && npm run test:contract

# CI runs these plus lint, typecheck, build, smoke, and e2e-smoke jobs
```

## Schema Versioning

The settings schema is versioned implicitly through the default values in:
- `packages/shared/src/settings.ts` (defaultSettings)
- `apps/server/src/utils/settingsContract.ts` (defaultSettings)

When adding new settings:
1. Add to both files' `defaultSettings`
2. Add to Zod schema in `settingsContract.ts` (optional for backwards compat)
3. Add test case in `test-settings-contract.ts`

## Incident Response

### Settings Crash (Production)

1. **Immediate:** Clear localStorage via browser DevTools
2. **If persists:** Check server logs for API errors
3. **If server issue:** Restart server to regenerate defaults
4. **Post-incident:** Add regression test case

### Settings Data Loss

1. Check for `data/settings.json.bak` backup
2. Server always falls back to defaults if file is missing
3. User will need to reconfigure integrations

## CI/CD Integration

The following CI jobs protect against settings regressions:

| Job | Script | Purpose |
|-----|--------|---------|
| `unit-tests` | `test:settings` | Client normalization |
| `contract-tests` | `test:contract` | Server API contract |
| `e2e-smoke` | `test:e2e:ci` | Browser integration |

All three must pass before PR merge.
