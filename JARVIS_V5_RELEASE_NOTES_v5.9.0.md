# AKIOR V5.9.0 – Google Calendar Integration Skeleton

**Release Date:** December 6, 2025  
**Version:** v5.9.0

---

## Summary

AKIOR V5.9.0 introduces a **Google Calendar integration skeleton** using OAuth2 refresh token flow. This release establishes the backend wiring, configuration UI, and testing infrastructure needed for future calendar management features. The implementation includes a Google Calendar API client, test endpoint, full Settings card, and CI smoke test validation.

This is a **backend + config + test** release. The Google Calendar integration provides connection testing and upcoming event fetching through the API, with full configuration options in Settings. User-facing calendar UI, event creation/editing, and OAuth wizard will arrive in future releases (v5.9.x or v5.10.0).

All previous features from v5.0.0–v5.8.0 remain intact: Gmail integration, Spotify integration, dual TTS providers (ElevenLabs + Azure), Local LLM support, Web Search, Weather integration, comprehensive theming, real-time HUD, and more. Google Calendar is **purely additive**—AKIOR continues to work exactly like v5.8.0 when Google Calendar is not configured.

---

## What's New in v5.9.0

### 📅 Google Calendar Integration (Backend Skeleton)

Google Calendar is now a fully supported integration in AKIOR, offering backend calendar connectivity via Google's Calendar API with OAuth2 refresh token authentication.

#### Google Calendar Configuration Card

Settings → Integrations → Google Calendar now features a complete configuration card:

- **Status pill:** Green "Connected" when all required fields are set, gray "Not connected" otherwise
- **Enable toggle:** Turn Google Calendar integration on/off
- **Client ID field:** Text input for Google OAuth2 Client ID
- **Client Secret field:** Password-masked input for Google OAuth2 Client Secret
- **Redirect URI field (optional):** Text input for OAuth callback URL
- **Calendar ID field:** Calendar identifier (defaults to "primary" for main calendar)
- **Refresh Token field:** Password-masked input for long-lived OAuth2 refresh token
  - Helper text: "Obtain via manual OAuth2 consent flow (see docs)"

All settings persist to server-side JSON and sync across devices on your LAN.

#### Backend Implementation

- **New Google Calendar client:** `apps/server/src/clients/googleCalendarClient.ts` (192 lines)
  - Implements OAuth2 Refresh Token Flow: `POST https://oauth2.googleapis.com/token`
  - Exchanges refresh token for short-lived access token (10s timeout)
  - Calls Google Calendar API: `GET https://www.googleapis.com/calendar/v3/calendars/{calendarId}/events`
  - Fetches upcoming events with query parameters:
    - `maxResults=5` - Limit to 5 events
    - `orderBy=startTime` - Chronological order
    - `singleEvents=true` - Expand recurring events
    - `timeMin=now` - Only future/current events
  - Returns normalized event summaries with essential metadata
  - 20-second timeout for event fetching, 30s total for full connection test
  - Robust error handling without logging secrets or tokens

- **New Google Calendar endpoint:** `POST /integrations/google-calendar/test`
  - **Request body:** None required (empty `{}`)
  - **Success response (200):**
    - `Content-Type: application/json`
    - Returns `{ ok: true, events: GoogleCalendarEventSummary[] }`
    - Each event summary includes:
      - `id`: Calendar event ID
      - `summary`: Event title/description
      - `start`: ISO 8601 start date/time (from `dateTime` or `date` field)
      - `end`: ISO 8601 end date/time (from `dateTime` or `date` field)
  - **Error responses:**
    - `503 Service Unavailable` with JSON `{ ok: false, error: 'google_calendar_not_configured' }` when integration is disabled or missing required fields
    - `502 Bad Gateway` with specific error codes when token exchange or Calendar API fails:
      - `token_exchange_failed` - Google rejected refresh token
      - `calendar_api_request_failed` - Calendar API error or network issue
      - `connection_test_timeout` - Request exceeded timeout

#### Configuration Model Updates

- **`GoogleCalendarIntegrationConfig`** in `packages/shared/src/integrations.ts`:
  ```typescript
  {
    enabled: boolean;
    clientId: string | null;
    clientSecret: string | null;
    redirectUri: string | null;   // optional for connection status
    refreshToken: string | null;
    calendarId: string | null;     // e.g., "primary" or specific calendar ID
  }
  ```

- **Integration metadata** updated:
  - `comingSoon: false` for Google Calendar
  - Description: "Connect Google Calendar via OAuth2 (refresh token). Backend test endpoint available; calendar UI coming later."
  - `isIntegrationConnected()` checks: `enabled && clientId && clientSecret && refreshToken && calendarId`

---

## How to Configure Google Calendar

### Prerequisites

1. **Google Cloud OAuth2 Client:**
   - Sign up for Google Cloud Console at [https://console.cloud.google.com](https://console.cloud.google.com)
   - Create a new project or use existing project
   - Enable Google Calendar API for your project
   - Create OAuth 2.0 credentials (Web application or Desktop app)
   - Note the **Client ID** and **Client Secret**

2. **Obtain Refresh Token (Manual Process):**
   - **Note:** This release does NOT include an OAuth wizard UI
   - Use Google OAuth2 Playground or a custom script to complete consent flow
   - Scopes needed: `https://www.googleapis.com/auth/calendar.readonly` (minimum)
   - For event creation/modification (future): `https://www.googleapis.com/auth/calendar` (full access)
   - After consent, exchange authorization code for refresh token
   - Save the refresh token securely

### Configuration Steps

1. **Open Settings:**
   - Navigate to `https://localhost:3000/settings` (or your LAN IP)
   - Scroll to **Integrations → Google Calendar**

2. **Enable Integration:**
   - Check the **"Enable"** checkbox

3. **Enter Configuration:**
   - **Client ID:** Paste your Google OAuth2 Client ID (e.g., `123-abc.apps.googleusercontent.com`)
   - **Client Secret:** Paste your Client Secret (password-masked)
   - **Redirect URI (optional):** Enter if needed (e.g., `http://localhost:3000/oauth/callback`)
   - **Calendar ID:** Enter "primary" for your main calendar, or a specific calendar ID
   - **Refresh Token:** Paste the refresh token obtained from OAuth flow

4. **Verify Connection:**
   - Status pill should change to green **"Connected"**
   - If not connected, verify all required fields are filled correctly

### Current Behavior (v5.9.0)

- **Backend connection test works:** The `/integrations/google-calendar/test` endpoint is fully functional
- **Settings show connection status:** Green "Connected" when enabled with valid credentials
- **No calendar UI yet:** Future versions will add user-facing calendar viewing, event creation, and management interfaces

### Expected Use Cases (Developer/API Testing)

You can test the Google Calendar connection endpoint using:

```bash
curl -X POST https://localhost:3000/api/integrations/google-calendar/test \
  -H "Content-Type: application/json" \
  -d '{}'
```

**Expected response (unconfigured):**
```json
{
  "ok": false,
  "error": "google_calendar_not_configured"
}
```

**Expected response (configured):**
```json
{
  "ok": true,
  "events": [
    {
      "id": "abc123xyz789",
      "summary": "Team Meeting",
      "start": "2025-12-07T14:00:00Z",
      "end": "2025-12-07T15:00:00Z"
    },
    {
      "id": "def456uvw012",
      "summary": "Doctor's Appointment",
      "start": "2025-12-08T10:30:00-05:00",
      "end": "2025-12-08T11:30:00-05:00"
    }
  ]
}
```

---

## Architecture Overview

### Google Calendar Client Design

The Google Calendar client (`apps/server/src/clients/googleCalendarClient.ts`) follows the same architectural pattern as the Gmail client introduced in v5.8.0:

1. **Token Exchange Layer:**
   - `fetchAccessToken()` - Exchanges refresh token for temporary access token
   - 10-second timeout with abort controller
   - Uses same OAuth2 endpoint as Gmail: `https://oauth2.googleapis.com/token`
   - Returns short-lived bearer token for Calendar API calls

2. **Calendar API Layer:**
   - `fetchUpcomingEvents()` - Retrieves upcoming events from specified calendar
   - 20-second timeout for API request
   - Query filtering: future events only (`timeMin=now`)
   - Event expansion: recurring events shown as individual instances (`singleEvents=true`)
   - Chronological sorting (`orderBy=startTime`)

3. **High-Level Test Wrapper:**
   - `testGoogleCalendarConnection()` - Orchestrates token exchange + event fetch
   - Returns normalized result object with `ok` boolean and optional `events` or `error`
   - Maps exceptions to specific error codes for client debugging

### Similarities to Gmail Integration

| Feature | Gmail (v5.8.0) | Google Calendar (v5.9.0) |
|---------|---------------|--------------------------|
| **OAuth2 Flow** | Refresh token → Access token | Refresh token → Access token |
| **Token Endpoint** | `https://oauth2.googleapis.com/token` | `https://oauth2.googleapis.com/token` |
| **Settings Fields** | 5 fields (clientId, clientSecret, redirectUri, refreshToken, userEmail) | 5 fields (clientId, clientSecret, redirectUri, refreshToken, calendarId) |
| **Connection Logic** | `enabled && clientId && clientSecret && refreshToken && userEmail` | `enabled && clientId && clientSecret && refreshToken && calendarId` |
| **Test Endpoint** | `POST /integrations/gmail/test` | `POST /integrations/google-calendar/test` |
| **Unconfigured Response** | 503 with `gmail_not_configured` | 503 with `google_calendar_not_configured` |
| **Success Response** | 200 with message summaries | 200 with event summaries |
| **Error Response** | 502 with error code | 502 with error code |
| **Settings UI** | Connection status pill + 5 fields | Connection status pill + 5 fields |

### Key Differences

- **Data Scope:** Gmail fetches *past* messages; Calendar fetches *future* events
- **Identifier Field:** Gmail uses `userEmail`; Calendar uses `calendarId`
- **API Endpoint:** Gmail uses `gmail.googleapis.com/gmail/v1`; Calendar uses `www.googleapis.com/calendar/v3`
- **Data Structure:** Gmail returns message metadata (subject, from, date); Calendar returns event data (summary, start, end)

---

## Quality Gates

All quality gates passed before release:

### TypeScript Type Checking
```bash
npm run typecheck
```
**Result:** ✅ 0 errors across entire monorepo (server, web, shared packages)

### Production Build
```bash
npm run build
```
**Result:** ✅ Successfully compiled
- **Web app:** 19 routes (static + dynamic)
- **Server:** TypeScript compilation successful
- **Shared packages:** Type definitions built

### Smoke Tests
```bash
npm run ci:smoke
```
**Result:** ✅ 13/13 checks passed
- **5 HTML pages:** Home, Settings, Chat, Menu, Holomat (all 200 OK)
- **8 API endpoints:**
  - System metrics API (200)
  - 3D print token status API (200)
  - Web search API - unconfigured (503) ✓
  - ElevenLabs TTS API - unconfigured (503) ✓
  - Azure TTS API - unconfigured (503) ✓
  - Spotify API - unconfigured (503) ✓
  - Gmail API - unconfigured (503) ✓
  - **Google Calendar API - unconfigured (503) ✓** ← NEW in v5.9.0

---

## Backward Compatibility

### Full Backward Compatibility with v5.8.0

- **No breaking changes:** All existing v5.8.0 features work identically
- **Settings migration:** Existing `settings.json` files are automatically compatible
  - If `googleCalendar` section is missing, defaults are applied
  - Gmail settings from v5.8.0 are preserved
- **API endpoints:** All v5.8.0 endpoints remain unchanged
- **UI/UX:** Settings page layout extended with new Google Calendar card; no changes to existing cards

### Migration from v5.8.0

**Zero-effort upgrade:**
1. Pull latest code from `main` branch (tag `v5.9.0`)
2. Restart AKIOR server
3. Google Calendar card appears in Settings → Integrations
4. All Gmail, Spotify, and other integrations remain configured and functional

**No data loss:** Server-side `settings.json` is extended, not replaced. Existing configuration persists.

---

## Known Limitations

### Google Calendar Limitations (v5.9.0)

1. **Manual OAuth Flow Required:**
   - No built-in OAuth wizard or redirect handler
   - Users must obtain refresh token via external tools (Google OAuth2 Playground, custom script)
   - Future versions will include `/api/integrations/google-calendar/callback` for automated flow

2. **No Calendar UI:**
   - Backend test endpoint works, but no user-facing calendar interface
   - Cannot view events in AKIOR UI yet
   - Cannot create, edit, or delete events from UI
   - Future: `/calendar` route with event list, day/week/month views

3. **No Token Refresh in UI:**
   - Backend client automatically refreshes access tokens as needed
   - Settings card doesn't expose manual refresh trigger
   - No token health monitoring or expiration warnings

4. **No OAuth Scope Validation:**
   - System doesn't verify Calendar API scopes for refresh token
   - User may encounter 502 errors if token lacks required scopes
   - Must ensure `calendar.readonly` scope at minimum during OAuth consent

5. **Single Calendar Only:**
   - Configuration limited to one `calendarId` at a time
   - Cannot switch between multiple calendars without reconfiguring
   - Future: Calendar picker UI to select from user's calendar list

6. **Read-Only Test Endpoint:**
   - `/integrations/google-calendar/test` only fetches events
   - No endpoints for event creation, update, or deletion yet
   - Future: CRUD endpoints for full calendar management

---

## Future Work

### Roadmap for v5.9.x and v5.10.0

**High Priority (v5.9.x or v5.10.0):**

1. **OAuth Redirect Handler:**
   - Endpoint: `POST /integrations/google-calendar/callback`
   - Automated token exchange after user consent
   - Redirect flow: Settings → Google consent screen → callback → auto-save token

2. **Calendar UI (`/calendar` route):**
   - **Event List View:** Upcoming events with date/time, summary, location
   - **Day/Week/Month Views:** Visual calendar grid
   - **Event Details Modal:** Full event info (attendees, description, recurrence)
   - **Search & Filtering:** Find events by keyword, date range, attendee
   - **Connection Status Indicator:** Show sync status and last refresh time

3. **Event Creation/Editing:**
   - **Create Event Form:** Title, date/time, description, attendees, location
   - **Edit Event:** Modify existing events (if user has write permissions)
   - **Delete Event:** Remove events with confirmation dialog
   - **Recurring Events:** UI for setting recurrence rules

**Medium Priority (v5.10.x+):**

4. **Multiple Calendar Support:**
   - Fetch user's calendar list from Google
   - Calendar picker in Settings UI
   - Toggle visibility of different calendars in UI
   - Color coding per calendar

5. **Calendar Widget:**
   - HUD widget showing today's upcoming events
   - Home page calendar summary card
   - Quick event creation from widget

6. **Advanced Features:**
   - Event reminders and notifications
   - Invite/RSVP handling
   - Free/busy status display
   - Calendar sharing and permissions management

**Low Priority (Future):**

7. **Calendar Integration with AKIOR AI:**
   - Voice commands: "What's on my calendar today?"
   - Event creation via voice: "Schedule meeting tomorrow at 3 PM"
   - Smart suggestions: "When am I free this week?"
   - Conflict detection and resolution

---

## Quick Recap of Earlier v5.x Releases

### v5.8.0 – Gmail Integration Skeleton (December 2025)

- **Gmail integration:** OAuth2 refresh token flow, backend client, test endpoint
- **Settings card:** 5 OAuth fields, connection status pill
- **Smoke test:** 12/12 checks including Gmail unconfigured test
- **No inbox UI yet:** Backend wiring only

### v5.7.0 – Spotify Integration (December 2025)

- **Spotify integration:** Track search via Spotify Web API
- **Client credentials flow:** Server-to-server authentication (no user OAuth)
- **Settings card:** Client ID, Client Secret, default market
- **Backend endpoint:** `/integrations/spotify/search` for track lookup

### v5.6.0 – Azure TTS Integration (December 2025)

- **Azure TTS integration:** Cloud-based text-to-speech via Azure Cognitive Services
- **Settings card:** API key, region, voice name, style, rate, pitch
- **Backend endpoint:** `/integrations/azure-tts/tts` for speech synthesis
- **Dual TTS support:** Works alongside ElevenLabs integration

### v5.5.0 – ElevenLabs TTS Integration (December 2025)

- **ElevenLabs integration:** High-quality neural TTS via ElevenLabs API
- **Settings card:** API key, voice ID, model ID, voice tuning parameters
- **Backend endpoint:** `/integrations/elevenlabs/tts` for voice generation
- **Voice stability controls:** Adjustable stability, similarity boost, and style

### v5.4.0 – Local LLM Integration (December 2025)

- **Local LLM support:** Ollama and custom HTTP API providers
- **Intelligent routing:** Local-primary, cloud-primary, and legacy modes with automatic fallback
- **Settings card:** Base URL, API key (optional), model name, temperature, max tokens
- **Text Chat integration:** Use local LLM as primary or fallback in Text Chat

### v5.3.0 – Web Search Integration (November 2025)

- **Web Search integration:** Generic HTTP client for Tavily, SerpAPI, and other search providers
- **Web-aware chat:** Enable web search in Text Chat settings for up-to-date information
- **Settings card:** Base URL, API key, default region
- **Backend endpoint:** `/integrations/web-search` with result aggregation

### v5.2.0 – Theming, HUD, Weather & Integrations Cockpit (November 2025)

- **Full theming system:** Light/Dark modes, custom accent colors, persistent preferences
- **HUD with live metrics:** CPU load, memory usage, system stats on all pages
- **Weather integration:** OpenWeather API with location-based forecasts
- **Integrations cockpit:** Centralized UI for managing integrations
- **System metrics API:** Real-time OS stats at `/system/metrics`

### v5.0.0 – Initial Local OS (June 2025)

- Holomat radial app launcher with draggable windows
- AKIOR voice assistant with real-time API
- 3D model generation and viewer
- Camera streaming and security dashboard
- Local HTTPS setup with mkcert + dev TLS proxy
- Server-side settings storage

---

## Installation & Upgrade

### Fresh Installation

1. **Clone repository:**
   ```bash
   git clone https://github.com/yosiwizman/akior-v5-os.git
   cd akior-v5-os
   git checkout v5.9.0
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Set up TLS certificates** (if not already done):
   ```bash
   # Follow instructions in README.md for mkcert setup
   ```

4. **Start development server:**
   ```bash
   npm start
   ```

5. **Access AKIOR:**
   - Navigate to `https://localhost:3000`
   - Configure Google Calendar in Settings → Integrations

### Upgrade from v5.8.0

1. **Pull latest changes:**
   ```bash
   git fetch origin
   git checkout main
   git pull origin main
   ```

2. **Verify version:**
   ```bash
   git tag --list "v5.9.0"
   ```

3. **Restart server:**
   ```bash
   npm start
   ```

4. **Verify upgrade:**
   - Open Settings → Integrations
   - Confirm Google Calendar card is visible
   - All previous configurations (Gmail, Spotify, etc.) remain intact

---

## Technical Details

### File Changes (v5.9.0)

**New Files:**
- `apps/server/src/clients/googleCalendarClient.ts` (192 lines)

**Modified Files:**
- `packages/shared/src/integrations.ts` - GoogleCalendarIntegrationConfig interface, connection logic
- `apps/server/src/index.ts` - POST /integrations/google-calendar/test endpoint
- `apps/web/app/settings/page.tsx` - Google Calendar Settings card
- `scripts/smoke.ts` - 13th smoke test for Google Calendar
- `apps/server/data/settings.json` - Complete Google Calendar field structure

**Changeset:** 6 files changed, 342 insertions(+), 10 deletions(-)

### Configuration Schema

**Google Calendar Config (JSON):**
```json
{
  "integrations": {
    "googleCalendar": {
      "enabled": false,
      "clientId": null,
      "clientSecret": null,
      "redirectUri": null,
      "refreshToken": null,
      "calendarId": "primary"
    }
  }
}
```

**Connection Requirements:**
- `enabled`: Must be `true`
- `clientId`: Non-null string
- `clientSecret`: Non-null string
- `refreshToken`: Non-null string
- `calendarId`: Non-null string (defaults to "primary")
- `redirectUri`: Optional (not checked for connection status)

---

## Security Considerations

### Token Security

1. **Refresh Token Storage:**
   - Stored server-side in `apps/server/data/settings.json`
   - Never transmitted to web client
   - Never logged in server logs
   - Masked in Settings UI (password input type)

2. **Access Token Handling:**
   - Short-lived (typically 1 hour)
   - Only exists in server memory during API calls
   - Not persisted to disk
   - Automatically refreshed as needed

3. **Client Secret Protection:**
   - Stored server-side only
   - Never transmitted to web client
   - Never logged in server logs
   - Masked in Settings UI (password input type)

### API Security

- **HTTPS Required:** All OAuth2 flows require HTTPS
- **Token Endpoint:** Uses official Google OAuth2 endpoint (`oauth2.googleapis.com`)
- **API Endpoint:** Uses official Google Calendar API (`www.googleapis.com/calendar/v3`)
- **Timeout Protection:** All network requests have abort timeouts (10-20s)
- **Error Sanitization:** Error messages don't leak sensitive config data

### Recommended OAuth Scopes

**Minimum (Read-Only):**
```
https://www.googleapis.com/auth/calendar.readonly
```

**Full Access (Future Event Management):**
```
https://www.googleapis.com/auth/calendar
```

**Additional Scopes (Optional):**
```
https://www.googleapis.com/auth/calendar.events.readonly  # Events only
https://www.googleapis.com/auth/calendar.events           # Event management
```

---

## Troubleshooting

### Google Calendar Not Connecting

**Symptom:** Status pill remains gray "Not connected" despite entering credentials

**Possible Causes & Solutions:**

1. **Missing Required Fields:**
   - Verify Client ID, Client Secret, Refresh Token, and Calendar ID are all filled
   - Check for accidental whitespace in fields
   - Ensure Calendar ID is set (default: "primary")

2. **Invalid Refresh Token:**
   - Test refresh token using curl or Postman against Google's token endpoint
   - Verify token was obtained with correct scopes (`calendar.readonly` minimum)
   - Re-run OAuth consent flow to get new refresh token

3. **Invalid Calendar ID:**
   - Use "primary" for main calendar
   - If using specific calendar ID, verify it exists in your Google account
   - Check Calendar API is enabled in Google Cloud Console

4. **API Not Enabled:**
   - Go to Google Cloud Console → APIs & Services → Library
   - Search for "Google Calendar API"
   - Click "Enable" if not already enabled

### Test Endpoint Returns 502

**Symptom:** `/integrations/google-calendar/test` returns 502 Bad Gateway

**Possible Error Codes:**

1. **`token_exchange_failed`:**
   - Refresh token is invalid or expired
   - Client ID/Secret mismatch
   - OAuth2 client was deleted in Google Cloud Console
   - **Solution:** Re-run OAuth consent flow to get new refresh token

2. **`calendar_api_request_failed`:**
   - Calendar API quota exceeded
   - Calendar ID doesn't exist
   - Network connectivity issues
   - **Solution:** Check Google Cloud Console quota limits, verify calendar ID

3. **`connection_test_timeout`:**
   - Network latency too high
   - Google API temporarily unavailable
   - **Solution:** Retry after a few seconds, check internet connectivity

### Smoke Test Fails

**Symptom:** `npm run ci:smoke` reports Google Calendar test failure

**Expected Behavior (Unconfigured):**
- Endpoint should return 503 status
- JSON body: `{ "ok": false, "error": "google_calendar_not_configured" }`

**If Test Fails:**
- Verify server is running on port 1234 (or configured API port)
- Check `apps/server/data/settings.json` has `googleCalendar.enabled: false`
- Restart server and rerun smoke tests

---

## Support & Resources

### Documentation

- **Release Notes:** `AKIOR_V5_RELEASE_NOTES_v5.9.0.md` (this file)
- **Test Plan:** `AKIOR_V5_TEST_PLAN.md`
- **Repo Overview:** `AKIOR_V5_REPO_OVERVIEW.md`
- **README:** `README.md`

### Google Resources

- **Google Calendar API Docs:** [https://developers.google.com/calendar/api](https://developers.google.com/calendar/api)
- **OAuth2 Playground:** [https://developers.google.com/oauthplayground](https://developers.google.com/oauthplayground)
- **Google Cloud Console:** [https://console.cloud.google.com](https://console.cloud.google.com)

### Community

- **GitHub Repository:** [https://github.com/yosiwizman/akior-v5-os](https://github.com/yosiwizman/akior-v5-os)
- **Issues:** Report bugs and feature requests via GitHub Issues
- **Discussions:** Community Q&A and feature discussions on GitHub Discussions

---

## Acknowledgments

AKIOR V5.9.0 builds on the architectural patterns established in v5.8.0 (Gmail) and continues the integration skeleton approach for third-party API connectivity. Special thanks to the open-source community for feedback on the v5.8.0 release, which informed the design decisions for v5.9.0.

---

**Happy Scheduling! 📅**

*AKIOR V5.9.0 - Bringing Google Calendar to your personal AI OS*
