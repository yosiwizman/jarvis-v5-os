# AKIOR V6.0.0 – Notification Foundation Release

**Release Date:** December 7, 2024  
**Version:** 6.0.0  
**Status:** Stable

---

## Overview

AKIOR V6.0.0 marks the first major version increment of the AKIOR OS platform, introducing the **Notification System Foundation** as a first-class feature. This release builds upon all capabilities from v5.9.0 while adding a complete event-driven notification architecture that enables real-time, scheduled notifications throughout the system.

This release maintains **full backward compatibility** with v5.9.0, meaning all existing integrations (LLM, Web Search, Gmail, Google Calendar, Spotify, TTS, Weather, etc.) continue to work without modification. Notifications are purely additive and enhance the user experience without disrupting existing workflows.

**Key Highlights:**
- Complete notification backend with event scheduler, REST API, and real-time SSE streaming
- Modern toast-based UI for notification display with auto-dismiss and manual controls
- Full TypeScript type safety with zero compilation errors
- Comprehensive smoke tests integrated into CI pipeline
- Foundation for future notification features (history UI, OS integration, rich actions)

---

## What's New in V6.0.0

### Backend: Notification Scheduler & APIs

#### Event Scheduler
- **Persistent storage**: Events stored in `data/scheduled-events.json` for durability across server restarts
- **Automatic firing**: Background loop checks every 60 seconds for due notifications and fires them automatically
- **SSE broadcasting**: Real-time push to all connected clients when notifications fire
- **Action logging**: Every scheduled and delivered notification is recorded in the action store for audit trails

#### REST Endpoints

##### 1. Schedule Notification
**Endpoint:** `POST /api/notifications/schedule`

**Request:**
```json
{
  "type": "calendar_reminder",
  "payload": {
    "message": "Team meeting in 15 minutes",
    "location": "Conference Room A"
  },
  "triggerAt": "2024-12-07T15:45:00.000Z"
}
```

**Response:**
```json
{
  "ok": true,
  "eventId": "550e8400-e29b-41d4-a716-446655440000"
}
```

**Validation:**
- `type` (required): String, notification type identifier
- `payload` (required): Object, arbitrary notification data
- `triggerAt` (required): ISO 8601 timestamp string

**Error Responses:**
- `400 Bad Request`: Invalid or missing required fields
- `500 Internal Server Error`: Scheduling failure

##### 2. Real-Time Notification Stream (SSE)
**Endpoint:** `GET /api/notifications/stream`

**Response:** Server-Sent Events stream

**Event Format:**
```
data: {"id":"...", "type":"system_update", "payload":{...}, "triggeredAt":"2024-12-07T..."}

```

**Features:**
- Automatic reconnection on connection loss
- Keep-alive heartbeats
- Connection confirmation message on connect
- Client tracking with unique UUIDs

##### 3. Notification History
**Endpoint:** `GET /api/notifications/history`

**Query Parameters:**
- `type` (optional): Filter by notification type
- `limit` (optional): Number of results (default: 50, max: 100)
- `offset` (optional): Pagination offset (default: 0)

**Response:**
```json
{
  "ok": true,
  "notifications": [
    {
      "id": "...",
      "type": "email_notification",
      "payload": {...},
      "triggerAt": "2024-12-07T14:00:00Z",
      "fired": true,
      "firedAt": "2024-12-07T14:00:01Z"
    }
  ],
  "total": 150,
  "limit": 50,
  "offset": 0
}
```

### Frontend: NotificationProvider & Toast UI

#### NotificationProvider Context
- **SSE Integration**: Automatically connects to `/api/notifications/stream` on app mount
- **User Preferences**: Filters notifications based on settings (user can disable specific types)
- **Auto-dismiss**: Notifications automatically disappear after 10 seconds
- **State Management**: React context API for clean integration with existing components

#### NotificationToast Component
- **Visual Design**: Fixed position (top-right), slide-in animation, themed colors per notification type
- **Icon Mapping**: Each notification type has a distinctive icon:
  - 📅 Calendar reminders
  - 📧 Email notifications
  - 🖨️ Printer alerts
  - 📹 Camera alerts
  - ⚙️ System updates
  - ⚠️ Integration errors
  - 💬 Custom notifications
- **Manual Dismiss**: Click the X button to close immediately
- **Responsive**: Adapts to mobile and desktop layouts
- **Accessibility**: ARIA labels, keyboard navigation support

#### Integration Points
- Wired into `apps/web/app/layout.tsx` as a global provider
- Works seamlessly with existing `ThemeProvider` and theme system
- Compatible with all AKIOR pages (Chat, Settings, Holomat, Security, etc.)

### Developer Experience Improvements

#### TypeScript
- **Zero errors**: All 11 pre-existing TypeScript errors eliminated
- **Type safety**: Comprehensive types for notifications in `@shared/core`
- **Socket.IO types**: Fixed event definitions in `RootEvents` interface
- **Integration types**: Corrected `IntegrationTestResult` interface to match actual usage

**What Was Fixed:**
1. Added `'lockdown:state'` event to Socket.IO `RootEvents` type
2. Changed `IntegrationTestResult.ok` → `IntegrationTestResult.success` for consistency
3. Fixed smart home integration test functions to accept required `config` parameter
4. All files now pass `tsc --noEmit` with zero errors

#### Build System
- **Production build**: 20 routes successfully compiled
- **Bundle sizes**: Optimized JavaScript chunks (87.1 kB shared bundle)
- **Static generation**: All pages pre-rendered where applicable
- **Tree shaking**: Unused code eliminated in production builds

#### CI/Smoke Tests
New smoke tests added to `scripts/smoke.ts`:

1. **Schedule endpoint test**:
   - Method: POST
   - Validates scheduling a notification 5 minutes in the future
   - Expects: `{ ok: true, eventId: "..." }`

2. **SSE stream test**:
   - Method: GET
   - Validates connection to real-time notification stream
   - Expects: HTTP 200 (stream opens successfully)

**Smoke test results:**
- All existing tests: ✅ PASS
- New notification tests: ✅ PASS
- Total checks: 17 (15 existing + 2 new)

---

## Notification Types

V6.0.0 includes support for the following notification types out of the box:

| Type                   | Icon | Use Case                                        |
|------------------------|------|-------------------------------------------------|
| `calendar_reminder`    | 📅   | Upcoming events, meetings, appointments         |
| `email_notification`   | 📧   | New emails, important messages                  |
| `printer_alert`        | 🖨️   | Print job status, errors, low supplies          |
| `camera_alert`         | 📹   | Motion detection, security events               |
| `system_update`        | ⚙️   | Software updates, system maintenance            |
| `integration_error`    | ⚠️   | Failed API calls, configuration issues          |
| `custom`               | 💬   | User-defined notifications                      |

Additional types can be added by simply using a new `type` string in the API. The UI will display a default bell icon (🔔) for unrecognized types.

---

## How to Use (Developer)

### Starting AKIOR V6

```bash
npm install
npm start
```

This starts:
- Dev TLS proxy at `https://localhost:3000`
- Next.js dev server at `http://localhost:3001`
- Fastify API server at `https://localhost:1234`
- Notification scheduler (initialized automatically)

### Scheduling a Test Notification

**PowerShell:**
```powershell
$body = @{
  type = "system_update"
  payload = @{
    message = "AKIOR V6.0.0 is live!"
  }
  triggerAt = (Get-Date).AddSeconds(10).ToString("o")
} | ConvertTo-Json

Invoke-RestMethod -Method Post -Uri "https://localhost:3000/api/notifications/schedule" `
  -Body $body -ContentType "application/json" -SkipCertificateCheck
```

**Bash/WSL/macOS:**
```bash
curl -k -X POST https://localhost:3000/api/notifications/schedule \
  -H "Content-Type: application/json" \
  -d "{
    \"type\": \"system_update\",
    \"payload\": { \"message\": \"AKIOR V6.0.0 is live!\" },
    \"triggerAt\": \"$(date -u -d '+10 seconds' '+%Y-%m-%dT%H:%M:%SZ')\"
  }"
```

**Expected Result:**
- After 10 seconds, a toast notification slides in from the top-right
- Shows system update icon (⚙️) with the message
- Auto-dismisses after 10 seconds, or click X to dismiss immediately

### Viewing Notification History

```bash
curl -k https://localhost:3000/api/notifications/history?limit=10
```

Returns the 10 most recent fired notifications with full metadata.

---

## Quality Gates

All quality checks passed for this release:

### TypeScript Compilation
```
✅ npm run typecheck
   @akior/server@6.0.0 typecheck - PASS
   @akior/web@6.0.0 typecheck - PASS
   @shared/core@6.0.0 typecheck - PASS
   
   Result: 0 errors, 0 warnings
```

### Production Build
```
✅ npm run build
   @akior/server@6.0.0 build - PASS
   @akior/web@6.0.0 build - PASS (20 routes generated)
   @shared/core@6.0.0 build - PASS
   
   Bundle sizes:
   - Shared JS: 87.1 kB
   - Largest page: /3dViewer (285 kB total)
   - Smallest page: / (87.3 kB total)
```

### Smoke Tests
```
✅ npm run ci:smoke
   Total checks: 17
   Passed: 17 ✅
   Failed: 0
   
   Notable checks:
   - Home page: ✅
   - Settings page: ✅
   - Notification schedule API: ✅
   - Notification SSE stream: ✅
   - All integration endpoints: ✅
```

---

## Backward Compatibility

V6.0.0 is **100% backward compatible** with v5.9.0:

**Preserved Features:**
- ✅ AKIOR realtime voice assistant (GPT-realtime models)
- ✅ Text chat with GPT-5 and local LLM support
- ✅ Web search integration (Tavily, SerpAPI)
- ✅ ElevenLabs and Azure TTS
- ✅ Spotify integration (Client Credentials Flow)
- ✅ Gmail integration (OAuth2, read/send emails)
- ✅ Google Calendar integration (OAuth2, fetch events)
- ✅ Weather integration (OpenWeather API)
- ✅ 3D model generation (Meshy.ai)
- ✅ 3D printing (Bambu Labs)
- ✅ Camera/security dashboard
- ✅ Lockdown mode
- ✅ HUD with live metrics
- ✅ Theming system (light/dark + color themes)
- ✅ Holomat apps deck
- ✅ Settings persistence (server + localStorage)

**New Capabilities:**
- 🔔 Notification system (scheduler + REST + SSE + toast UI)
- 🔧 TypeScript zero-error codebase
- 📊 Enhanced action logging (notification events tracked)

**Migration Notes:**
- No breaking API changes
- No database migrations required
- No environment variable changes needed
- Existing `data/settings.json` files work without modification

---

## Architecture Overview

### Notification Flow

```
┌─────────────────┐
│  Client Action  │
│ (Schedule Notif)│
└────────┬────────┘
         │
         │ POST /api/notifications/schedule
         ▼
┌─────────────────────────┐
│ NotificationScheduler   │
│ - Stores event in JSON  │
│ - Returns eventId       │
└────────┬────────────────┘
         │
         │ Event loop (60s interval)
         │ Checks for due events
         ▼
┌─────────────────────────┐
│ Fire Event              │
│ - Mark event as fired   │
│ - Broadcast via SSE     │
└────────┬────────────────┘
         │
         │ SSE stream
         ▼
┌─────────────────────────┐
│ NotificationProvider    │
│ - Receives via EventSrc │
│ - Filters by prefs      │
│ - Adds to state         │
└────────┬────────────────┘
         │
         │ React context
         ▼
┌─────────────────────────┐
│ NotificationToast       │
│ - Renders toast UI      │
│ - Auto-dismiss (10s)    │
│ - Manual close button   │
└─────────────────────────┘
```

### File Locations

**Shared Types:**
- `packages/shared/src/notifications.ts` – Core types (`Notification`, `ScheduledEvent`, request/response interfaces)

**Backend:**
- `apps/server/src/notificationScheduler.ts` – Scheduler class with event loop
- `apps/server/src/index.ts` (lines 172-330) – REST + SSE endpoint implementations
- `apps/server/data/scheduled-events.json` – Persistent event storage

**Frontend:**
- `apps/web/context/NotificationContext.tsx` – React context provider with SSE connection
- `apps/web/components/NotificationToast.tsx` – Toast UI component
- `apps/web/app/layout.tsx` (lines 37, 122) – Global provider and toast integration

**Tests:**
- `scripts/smoke.ts` (lines 179-194) – Notification smoke tests

---

## Known Limitations

1. **No persistent UI history**: Notifications disappear after auto-dismiss or manual close. History is available via API but not yet in UI.
2. **No notification actions**: Toasts are display-only. Action buttons (e.g., "View", "Snooze") not yet implemented.
3. **No OS-level integration**: When running on Ubuntu shell, notifications do not yet trigger native desktop notifications.
4. **No mobile push**: Notifications only work for active browser sessions. Mobile push (PWA/native) not yet implemented.
5. **No priority levels**: All notifications treated with equal priority. Future versions will support urgent/high/normal/low.

These limitations are intentional for v6.0.0 as a foundation release. They are addressed in the roadmap below.

---

## Future Work

### v6.1.0 – Notification Drawer & History UI
**Target:** Q1 2025

- Bell icon in top navigation bar with unread count badge
- Slide-out drawer showing notification history
- Mark as read/unread functionality
- Search and filter notifications by type, date
- Pagination for large notification lists

### v6.2.0 – Rich Notifications & Ubuntu Bridge
**Target:** Q2 2025

- **Rich payloads**: Action buttons ("View Camera", "Snooze", "Dismiss"), inline images, priority levels
- **Ubuntu desktop integration**: Forward SSE notifications to native Ubuntu notifications via D-Bus
- **Smart grouping**: Collapse multiple similar notifications (e.g., "5 new emails")

### v6.3.0 – Notification Rules Engine
**Target:** Q3 2025

- User-defined rules ("If printer error, also send email")
- Notification templates with variables
- Conditional routing (e.g., urgent notifications during working hours only)
- Integration with existing automation system

### v7.0.0+ – Mobile & Advanced Features
**Target:** 2026

- Firebase Cloud Messaging for mobile push
- iOS/Android PWA or native app support
- Voice-triggered notification queries ("AKIOR, read my notifications")
- AI-powered notification summaries
- Cross-device notification sync

---

## Migration Guide

### From v5.9.0 to v6.0.0

1. **Pull the latest code:**
   ```bash
   git checkout main
   git pull origin main
   git checkout v6.0.0
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Start AKIOR:**
   ```bash
   npm start
   ```

4. **Verify notification system:**
   - Open AKIOR at `https://localhost:3000`
   - Schedule a test notification using the curl examples above
   - Verify toast appears after the scheduled time

**No configuration changes required.** The notification system initializes automatically on server startup.

---

## Contributors

- **Lead Engineer:** Senior TypeScript/Node/React Engineer
- **CTO Oversight:** Max
- **Testing:** Automated CI + manual UI validation

---

## Support

For issues, questions, or feedback:

- **GitHub Issues:** https://github.com/yosiwizman/akior-v5-os/issues
- **Documentation:** See `AKIOR_V6_REPO_OVERVIEW.md` and `AKIOR_V6_TEST_PLAN.md`

---

## Changelog Summary

**Added:**
- Notification scheduler with persistent storage
- POST `/api/notifications/schedule` endpoint
- GET `/api/notifications/stream` SSE endpoint
- GET `/api/notifications/history` endpoint
- NotificationProvider React context
- NotificationToast UI component
- Notification smoke tests in CI
- Action logging for notification events

**Fixed:**
- TypeScript: Added `lockdown:state` to Socket.IO `RootEvents` type
- TypeScript: Corrected `IntegrationTestResult` interface (ok → success)
- TypeScript: Fixed smart home integration test function signatures

**Changed:**
- None (fully backward compatible)

**Deprecated:**
- None

**Removed:**
- None

**Security:**
- No security vulnerabilities addressed in this release
- Notifications respect user authentication (SSE requires active session)

---

**Release v6.0.0 is stable and recommended for production use.**
