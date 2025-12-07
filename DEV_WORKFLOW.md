# Jarvis V5 Development Workflow

This document explains how we manage code changes, CI, and releases for the Jarvis V5 OS repository.

---

## 1. Current Mode: Solo Dev, Direct-to-Main

### How It Works

Jarvis V5 currently uses a **direct-to-main workflow** optimized for a single primary developer:

- **Local feature branches** are used during development (e.g., `feature/v5-theme-backgrounds`, `feature/v5-web-search-integration`)
- **Local merges** happen on the developer's machine (not on GitHub)
- **Only `main` is pushed** to GitHub, along with version tags like `v5.2.0`, `v5.3.0`, `v5.4.0`
- **GitHub Actions CI** runs automatically on every push to `main` via the `Jarvis V5 CI` workflow
- **No pull requests** are created on GitHub — all merge decisions happen locally

### CI Pipeline

Every push to `main` triggers `.github/workflows/jarvis-ci.yml`, which runs:

1. `npm install` — Install dependencies
2. `npm run typecheck` — TypeScript compilation (0 errors expected)
3. `npm run build` — Production build (19 routes expected)
4. `npm run ci:smoke` — Smoke tests (8/8 checks expected)

If CI fails, the developer fixes issues locally and pushes again. The GitHub commit history shows a linear sequence of commits with green CI badges.

### When This Is Okay

Direct-to-main works well when:

- **Single owner / single primary developer** — One person makes all decisions
- **High trust in CI** — Strong automated testing catches issues before push
- **Fast iteration priority** — Speed matters more than formal code review
- **Personal project or early-stage startup** — Team size doesn't justify PR overhead

### Example Flow

```bash
# Create a local feature branch
git checkout -b feature/v5-local-llm

# Make changes, commit locally
git add .
git commit -m "feat(v5): add Local LLM integration"

# Run quality checks locally
npm run typecheck
npm run build
npm run ci:smoke

# Merge to main locally
git checkout main
git merge --no-ff feature/v5-local-llm

# Push to GitHub (triggers CI)
git push origin main

# Tag release after CI passes
git tag -a v5.4.0 -m "Jarvis V5.4.0 – Local LLM & Web Search"
git push origin v5.4.0
```

---

## 2. Future Mode: PR-Driven Workflow (For a Larger Team)

### When to Switch to PRs

As the team grows or when you start accepting external contributions, switch to a **pull request (PR) workflow**:

- **Multiple developers** working on different features simultaneously
- **External contributors** submitting changes from forks
- **Need for code review** with discussion threads and approval tracking
- **Stronger safety** around production changes with branch protection

### Recommended Setup

#### Step 1: Enable Branch Protection

On GitHub, configure `main` branch protection:

1. Go to **Settings → Branches → Add branch protection rule**
2. Branch name pattern: `main`
3. Enable:
   - ☑️ **Require a pull request before merging**
   - ☑️ **Require status checks to pass before merging**
     - Add: `Jarvis V5 CI` (from `.github/workflows/jarvis-ci.yml`)
   - ☑️ **(Optional) Require approvals** — Set to 1 for small teams, 2+ for larger teams
   - ☑️ **Require linear history** — Prevents messy merge commits
4. Save changes

#### Step 2: Branch Naming Convention

Use consistent branch names for easy filtering:

- **`feature/...`** — New features (e.g., `feature/v5-spotify-integration`)
- **`fix/...`** — Bug fixes (e.g., `fix/camera-stream-timeout`)
- **`release/...`** — Release preparation (e.g., `release/v5.5.0`)
- **`docs/...`** — Documentation updates (e.g., `docs/update-readme`)

#### Step 3: PR Workflow

```bash
# Create a branch for your change
git checkout -b feature/v5-spotify-integration

# Make changes, commit regularly
git add .
git commit -m "feat(v5): add Spotify integration UI"

# Push branch to GitHub
git push origin feature/v5-spotify-integration

# Open a PR on GitHub:
# - Base: main
# - Compare: feature/v5-spotify-integration
# - Add description, screenshots, testing notes

# CI runs automatically on the PR
# Wait for green checkmarks

# Request review (if team has multiple members)
# Address feedback, push additional commits

# Once approved and CI is green, merge:
# - Prefer "Squash and merge" for clean history
# - Or "Rebase and merge" if commit history is already clean
# - Avoid "Merge commit" to prevent clutter

# Delete the branch after merging
```

#### Step 4: Merge Strategy

**Recommended:** **Squash and merge** (default for most PRs)

- Combines all commits in the PR into a single commit on `main`
- Keeps history clean and easy to navigate
- Good for features with many small "work-in-progress" commits

**Alternative:** **Rebase and merge** (for well-structured PRs)

- Replays PR commits on top of `main` without a merge commit
- Keeps individual commit messages
- Use when PR commits are already clean and meaningful

**Avoid:** **Merge commit** (creates clutter)

- Adds an extra "Merge branch..." commit
- Makes history harder to read
- Only use for special cases (e.g., merging long-lived branches)

### Example PR Workflow

```bash
# Developer A: Create feature branch
git checkout -b feature/v5-gmail-integration
git push origin feature/v5-gmail-integration

# Developer A: Open PR on GitHub
# Title: "feat(v5): add Gmail integration"
# Description: "Adds Gmail API client, settings UI, and inbox widget"

# CI runs automatically
# ✅ Typecheck: passed
# ✅ Build: passed
# ✅ Smoke tests: 8/8 passed

# Developer B: Review PR
# - Leave comments on code
# - Request changes or approve

# Developer A: Address feedback
git add .
git commit -m "fix: handle Gmail API rate limits"
git push origin feature/v5-gmail-integration

# CI runs again on updated PR
# ✅ All checks pass

# Developer B or A: Merge PR via GitHub UI
# - Click "Squash and merge"
# - Edit commit message if needed
# - Confirm merge

# GitHub automatically:
# - Merges to main
# - Runs CI on main
# - Closes the PR
# - Optionally deletes the branch
```

---

## 3. Tagging and Releases

### Current Tagging Strategy

Jarvis V5 uses **semantic versioning** with tags for each release:

- **Format:** `vMAJOR.MINOR.PATCH` (e.g., `v5.0.0`, `v5.2.0`, `v5.4.0`)
- **When to tag:** After a successful release commit on `main` with CI passing
- **Where to document:** Create a release notes file like `JARVIS_V5_RELEASE_NOTES_v5.4.0.md`

### Versioning Guidelines

- **Major version (v6.0.0):** Breaking changes, major architecture overhaul
- **Minor version (v5.5.0):** New features, backward-compatible changes
- **Patch version (v5.4.1):** Bug fixes, documentation updates

### Release Process

#### Direct-to-Main (Current)

```bash
# Ensure main is clean and CI is green
git checkout main
npm run typecheck && npm run build && npm run ci:smoke

# Create release notes
# (e.g., JARVIS_V5_RELEASE_NOTES_v5.5.0.md)

# Commit release notes
git add .
git commit -m "release(v5): add v5.5.0 release notes"
git push origin main

# Wait for CI to pass on GitHub

# Create annotated tag
git tag -a v5.5.0 -m "Jarvis V5.5.0 – Brief description"

# Push tag to GitHub
git push origin v5.5.0

# Optional: Create GitHub Release
# - Go to Releases → Draft a new release
# - Choose tag: v5.5.0
# - Add release notes summary
# - Publish release
```

#### PR-Based Workflow (Future)

```bash
# Create release branch
git checkout -b release/v5.5.0

# Bump version numbers, update docs
# (e.g., JARVIS_V5_RELEASE_NOTES_v5.5.0.md)

# Commit changes
git add .
git commit -m "release(v5): prepare v5.5.0"
git push origin release/v5.5.0

# Open PR: release/v5.5.0 → main
# Title: "Release v5.5.0"

# CI runs, team reviews

# Merge PR via GitHub (CI must be green)

# After merge, pull latest main locally
git checkout main
git pull origin main

# Create annotated tag
git tag -a v5.5.0 -m "Jarvis V5.5.0 – Brief description"

# Push tag to GitHub
git push origin v5.5.0

# Create GitHub Release (same as above)
```

### Release Notes

Every release should have a corresponding release notes file:

- **Filename:** `JARVIS_V5_RELEASE_NOTES_vX.Y.Z.md`
- **Location:** Repository root
- **Contents:**
  - Summary of changes
  - What's new in this version
  - How to run/test
  - Known limitations
  - Migration notes (if applicable)

**Example:** See `JARVIS_V5_RELEASE_NOTES_v5.4.0.md` for reference.

---

## 4. CI Expectations

### Quality Gates

Every change (code or docs) must pass three quality gates:

1. **TypeScript compilation:** `npm run typecheck`
   - Expected: 0 errors
   - Checks: Type safety across all packages

2. **Production build:** `npm run build`
   - Expected: All packages build successfully
   - Checks: Next.js routes (19 expected), server compilation, shared types

3. **Smoke tests:** `npm run ci:smoke`
   - Expected: 8/8 checks pass
   - Checks:
     - 5 page routes (Home, Settings, Chat, Menu, Holomat)
     - 3 API endpoints (System metrics, 3D print status, Web search)

### CI Configuration

The CI pipeline is defined in `.github/workflows/jarvis-ci.yml`:

```yaml
name: Jarvis V5 CI

on:
  push:
    branches:
      - main
      - 'feature/**'
  pull_request:
    branches:
      - main

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - run: npm run typecheck
      - run: npm run build
      - run: npm run ci:smoke
```

### When CI Runs

- **Direct-to-main (current):** On every push to `main`
- **PR-based (future):** On every push to PR branches + on merge to `main`

### If CI Fails

**Direct-to-main:**
1. Check GitHub Actions logs for errors
2. Fix issues locally
3. Run `npm run typecheck && npm run build && npm run ci:smoke` locally
4. Commit fixes
5. Push to `main` (CI runs again)

**PR-based:**
1. Check GitHub Actions logs on the PR
2. Fix issues locally
3. Run quality gates locally
4. Commit fixes
5. Push to PR branch (CI runs again on PR)
6. Merge only when CI is green

### Running CI Locally

Before pushing, run all quality gates locally to catch issues early:

```bash
# Run all checks in sequence
npm run typecheck && npm run build && npm run ci:smoke

# Or run individually:
npm run typecheck   # TypeScript compilation
npm run build       # Production build
npm run ci:smoke    # Start system, run smoke tests, stop system
```

**Note:** `npm run ci:smoke` starts the full stack (Next.js + Fastify), runs tests, then stops everything. It takes ~60-90 seconds.

---

## Summary

### Current Workflow (Direct-to-Main)

✅ **Works for:** Solo developer, fast iteration, high CI trust  
✅ **Process:** Local branches → local merge → push to `main` → CI runs → tag release  
✅ **CI:** Automatic on every push to `main`

### Future Workflow (PR-Based)

✅ **Works for:** Multiple developers, code review, external contributors  
✅ **Process:** Feature branch → push to GitHub → open PR → CI runs → review → merge → tag release  
✅ **CI:** Automatic on every PR push + every merge to `main`  
✅ **Protection:** Branch rules require CI to pass before merge

### Both Workflows

✅ **Tagging:** Semantic versioning (`v5.x.x`) after successful releases  
✅ **Release Notes:** Document every version in `JARVIS_V5_RELEASE_NOTES_vX.Y.Z.md`  
✅ **Quality Gates:** TypeScript, build, smoke tests must pass  
✅ **CI Config:** `.github/workflows/jarvis-ci.yml` (unchanged between workflows)

---

## 5. Notification & Event Loop Subsystem (v6.0 Foundation)

### Overview

As of **feature/v6-notification-foundation**, Jarvis V5 OS includes the foundational infrastructure for an internal notification and event scheduling system. This subsystem is designed to support future features like calendar reminders, printer alerts, security camera notifications, and system updates.

### Current Status: Foundation Only

**What's Implemented:**
- ✅ **Shared Types** (`packages/shared/src/notifications.ts`)
  - `Notification`, `ScheduledEvent`, `ScheduleNotificationRequest` types
  - Support for notification types: calendar_reminder, printer_alert, camera_alert, system_update, integration_error, custom
- ✅ **Backend Scheduler** (`apps/server/src/notificationScheduler.ts`)
  - Event storage in JSON file (`data/scheduled-events.json`)
  - Event loop checking every 60 seconds for due events
  - SSE client management for real-time notification delivery
  - Singleton `notificationScheduler` instance initialized on server startup
- ✅ **Backend API Endpoints** (`apps/server/src/index.ts`)
  - `POST /api/notifications/schedule` - Schedule notifications with validation
  - `GET /api/notifications/stream` - SSE endpoint for real-time event delivery
  - Returns proper error codes (400 for validation, 500 for failures)
  - Auto-schedule camera_alert notifications when cameras connect/disconnect
- ✅ **Smoke Tests** (`scripts/smoke.ts`)
  - Test notification scheduling endpoint (validates request/response)
  - Test SSE stream connectivity (200 status check)
- ✅ **Frontend NotificationProvider** (`apps/web/context/NotificationContext.tsx`)
  - React context with SSE subscription to `/api/notifications/stream`
  - Auto-dismiss notifications after 10 seconds
  - `scheduleNotification()` helper for programmatic scheduling
- ✅ **NotificationToast Component** (`apps/web/components/NotificationToast.tsx`)
  - Toast display with type-specific icons and colors
  - Manual dismiss button + auto-dismiss
  - Positioned top-right with slide-in animation
- ✅ **Root Layout Integration** (`apps/web/app/layout.tsx`)
  - NotificationProvider wraps entire app
  - NotificationToast rendered globally
- ✅ **Camera Settings UI** (`apps/web/components/CameraSettings.tsx`)
  - Permission status display and request button
  - Wi-Fi configuration placeholder (SSID + password inputs)
  - Security dashboard logging for camera connect/disconnect events

### Architecture

**Event Flow:**
1. External system (calendar, printer, camera, etc.) schedules a notification via API
2. Scheduler stores event with `triggerAt` ISO timestamp in JSON file
3. Event loop checks every minute for events where `triggerAt <= now`
4. When due, event fires and broadcasts to all connected SSE clients
5. Frontend receives notification via SSE stream and displays toast

**Storage:**
- File: `apps/server/data/scheduled-events.json`
- Format: Array of `ScheduledEvent` objects with `fired` boolean flag
- Persistence: Events persist across server restarts

**Event Loop:**
- Check interval: 60 seconds
- Startup behavior: Loads events from disk, fires any overdue events immediately
- Shutdown behavior: Stops interval timer cleanly

### API Usage

**Schedule a Notification:**
```bash
curl -X POST https://localhost:3000/api/notifications/schedule \
  -H "Content-Type: application/json" \
  -d '{
    "type": "calendar_reminder",
    "payload": { "eventName": "Team standup", "location": "Zoom" },
    "triggerAt": "2025-12-06T10:00:00Z"
  }'

# Response (200 OK):
# { "ok": true, "eventId": "uuid-here" }

# Validation errors (400 Bad Request):
# { "ok": false, "error": "type is required and must be a string" }
# { "ok": false, "error": "payload is required and must be an object" }
# { "ok": false, "error": "triggerAt must be a valid ISO 8601 timestamp" }
```

**Subscribe to Notifications (SSE):**
```javascript
const eventSource = new EventSource('https://localhost:3000/api/notifications/stream');

eventSource.onmessage = (event) => {
  const notification = JSON.parse(event.data);
  console.log('Notification received:', notification);
  // { type: 'calendar_reminder', payload: {...}, triggeredAt: '...' }
};

eventSource.onerror = () => {
  console.error('SSE connection lost');
};
```

### Camera Integration

**Camera Feed Architecture:**
- **Live Streaming:** WebRTC-based peer-to-peer streaming between camera devices and security dashboard
- **Frame Broadcasting:** JPEG frames sent via Socket.IO at 8 FPS for thumbnail preview
- **Auto-Discovery:** Cameras announce themselves via Socket.IO and appear in security dashboard automatically
- **RTCPeerConnection:** Signaling via Socket.IO for SDP offers/answers and ICE candidates

**Camera Settings:**
- **Permission Management:** Browser getUserMedia permission status and request UI
- **Wi-Fi Configuration (Placeholder):** Future feature for configuring standalone camera devices
- **Automatic Notifications:** Camera connect/disconnect events trigger camera_alert notifications

**Security Dashboard Features:**
- **Camera Grid:** Thumbnail previews with live/offline status indicators
- **Expand View:** Click to open full-screen WebRTC live stream
- **Snapshot Download:** Save current frame as JPEG
- **Connection Logging:** Console logs for camera join/leave/frame events

### v6.0 Enhancements (Implemented)

**Calendar Event Reminders:**
- `POST /integrations/google-calendar/sync-reminders` endpoint
- Fetches upcoming Google Calendar events (next 5 events)
- Schedules `calendar_reminder` notifications 15 minutes before each event
- Includes event name, ID, start time, and reminder minutes in payload
- Logs sync results (events found, notifications scheduled)
- Returns: `{ ok, eventsFound, scheduledCount, message }`

**Printer Job Completion Alerts:**
- Auto-trigger `printer_alert` notifications on 3D model job completion/failure
- Monitors `ModelJob` status changes in `updateJob()` function
- Completion notification: job ID, prompt (truncated to 50 chars), status='completed'
- Failure notification: job ID, error message (truncated), status='failed', error details
- Prevents duplicate notifications (only fires on status transition)
- Logs all printer notification scheduling attempts

**Motion Detection:**
- Simple frame-to-frame comparison using base64 string length difference
- Motion threshold: 5% change between consecutive frames
- Cooldown: 30 seconds between motion alerts per camera (prevents spam)
- Triggers `camera_alert` with action='motion_detected', timestamp, camera details
- Stores `previousFrameBase64` and `lastMotionAlertTs` in camera directory
- Logs motion detection events with camera ID and friendly name
- Production note: Could be upgraded to proper image diff/computer vision libraries

### Notification History & Preferences (Implemented)

**Notification History API:**
- `GET /api/notifications/history` endpoint with filtering and pagination
- Query parameters: `?type=camera_alert&limit=50&offset=0`
- Returns: `{ ok, notifications, total, limit, offset }`
- Logs all access attempts with timestamp and filter details
- Uses existing scheduler's `getFiredEvents()` - no additional storage needed
- Sorts by `firedAt` descending (most recent first)

**Notification History UI:**
- `NotificationHistory.tsx` component (207 lines)
- Displays past notifications with type icons, timestamps, payload summaries
- Filter dropdown: All Types, Calendar, Printer, Camera, System, Integration
- Relative timestamps (e.g., "2h ago", "3d ago") with fallback to absolute dates
- "Delivered" status badge for all fired notifications
- Empty state with type-specific messaging
- Pagination support (50 per page, showing X of Y total)

**User Preferences Backend:**
- Extended `AppSettings` with `notificationPreferences?: NotificationPreferences`
- Schema: `{ calendar_reminder, printer_alert, camera_alert, system_update, integration_error, custom }` (all boolean)
- Defaults: All types enabled (true)
- Persisted to server via `/api/settings` endpoint
- Merged with defaults in settings loader (localStorage fallback)

**User Preferences UI:**
- `NotificationPreferences.tsx` component (70 lines)
- Toggle switches for each notification type with icons and descriptions
- Real-time updates via `updateSettings()` and `readSettings()`
- Accessible toggle UI (focus rings, keyboard support)
- Explanatory text: "Disabled notifications still logged in history"

**Preference Filtering:**
- `NotificationContext.tsx` updated to check preferences before displaying toasts
- Filters incoming SSE notifications based on user preferences
- Logs filtered notifications to console: `"Notification filtered by preferences: {type}"`
- Default behavior: If preference not set, notification is shown (fail-open)
- History API does NOT filter by preferences (all events returned regardless)

### Future Enhancements (Optional)

The notification system is now **fully complete** with history and preferences. Additional polish could include:

3. **Advanced Motion Detection:**
   - Upgrade to proper image diff libraries (e.g. pixelmatch, opencv)
   - Region-of-interest (ROI) selection for motion detection zones
   - Sensitivity tuning per camera

4. **Additional Integrations:**
   - System update notifications (low disk space, security updates)
   - Smart home device alerts (temperature, humidity, door sensors)
   - Reminder snooze functionality for calendar events

### Implementation Files

**Backend:**
- **Types:** `packages/shared/src/notifications.ts` (71 lines)
- **Scheduler:** `apps/server/src/notificationScheduler.ts` (262 lines)
- **API Endpoints:** `apps/server/src/index.ts` (notification routes + camera event triggers)
- **Storage:** `apps/server/data/scheduled-events.json` (event persistence)

**Frontend:**
- **Context:** `apps/web/context/NotificationContext.tsx` (with preference filtering)
- **Toast Component:** `apps/web/components/NotificationToast.tsx` (131 lines)
- **History Component:** `apps/web/components/NotificationHistory.tsx` (207 lines)
- **Preferences Component:** `apps/web/components/NotificationPreferences.tsx` (70 lines)
- **Camera Settings:** `apps/web/components/CameraSettings.tsx` (100 lines)
- **Root Integration:** `apps/web/app/layout.tsx` (NotificationProvider + NotificationToast)

**Testing:**
- **Smoke Tests:** `scripts/smoke.ts` (15 checks including notification endpoints)

**Documentation:**
- This section in `DEV_WORKFLOW.md`

### Design Decisions

- **Why SSE over WebSocket?** Simpler for one-way server→client push, no need for bidirectional communication
- **Why JSON file storage?** Sufficient for MVP, easy to debug, no DB dependency. Can migrate to SQLite/Postgres later
- **Why 60-second intervals?** Balances responsiveness with server load; minute-level precision is sufficient for most use cases
- **Why internal-only?** No external notification services (email, SMS, push) yet — focus on in-app notifications first

---

## 6. Local Memory & Enhanced Logging System

### Overview

Jarvis includes a comprehensive local memory and logging infrastructure designed to:
- Store conversation history for context-aware interactions
- Track all user and system actions for auditing and debugging
- Provide structured logging with rotation and retention policies
- Enable users to view and search through their interaction history

### Architecture

**Storage Systems:**
- **Conversations:** JSON-based storage with indexed metadata for fast searching
- **Actions:** Rolling history with 10,000-item limit and automatic cleanup
- **Logs:** Structured pino-based logging with daily rotation and compression

**Data Directories:**
```
data/
├── conversations/         # Conversation storage
│   ├── index.json        # Conversation metadata index
│   └── {uuid}.json       # Individual conversation files
├── actions/              # Action tracking
│   ├── index.json        # Action index
│   └── {yyyy-mm-dd}.json # Daily action logs
└── logs/                 # System logs
    ├── app.log           # Application logs
    ├── error.log         # Error-only logs
    ├── security.log      # Security events
    └── actions.log       # User action logs
```

### Backend Components

**Conversation Store** (`apps/server/src/storage/conversationStore.ts`):
- Stores conversations with messages, metadata, tags, and timestamps
- Supports three sources: chat, voice, realtime
- Full-text search across messages and metadata
- Automatic indexing for performance
- Statistics API for analytics

**Action Store** (`apps/server/src/storage/actionStore.ts`):
- Tracks 14 action types including:
  - User actions: message_sent, voice_command, settings_changed, integration_toggled
  - System events: notification_scheduled, notification_delivered, notification_failed
  - Function executions: 3d_model_generated, image_generated, email_sent, calendar_event_created
  - Security: camera_connected, camera_disconnected, motion_detected
- Automatic cleanup of old actions (keeps most recent 10,000)
- Filtering by type, source, and date range

**Logging System** (`apps/server/src/utils/logger.ts`):
- Pino-based structured JSON logging
- Multiple log streams:
  - `app.log`: All application logs (INFO, WARN, ERROR)
  - `error.log`: ERROR-level only
  - `security.log`: Security-related events
  - `actions.log`: User action logs
- Daily rotation with automatic gzip compression
- 30-day retention policy
- Pretty console output in development

### API Endpoints

**Conversations:**
```bash
# Save a conversation
POST /api/conversations/save
{
  "source": "chat",
  "messages": [{"role": "user", "content": "Hello"}],
  "metadata": {"title": "Greeting"},
  "tags": ["casual"]
}

# Get a conversation by ID
GET /api/conversations/{id}

# List all conversations with filters
GET /api/conversations?source=chat&limit=50&offset=0

# Search conversations
GET /api/conversations?search=reminder&source=voice

# Delete a conversation
DELETE /api/conversations/{id}

# Get conversation statistics
GET /api/conversations/stats
```

**Actions:**
```bash
# Record an action
POST /api/actions/record
{
  "type": "message_sent",
  "source": "user",
  "metadata": {"messageId": "abc123", "contentLength": 42}
}

# Get an action by ID
GET /api/actions/{id}

# List actions with filters
GET /api/actions?type=notification_scheduled&limit=100

# Get action statistics
GET /api/actions/stats

# Cleanup old actions
POST /api/actions/cleanup
```

### Frontend Components

**Conversation History** (`apps/web/components/ConversationHistory.tsx`):
- Master-detail layout with conversation list and message viewer
- Source indicators: 💬 Chat, 🎙️ Voice, ⚡ Real-time
- Full-text search and filtering by source
- Tag display and management
- Delete conversations with confirmation
- Smart date formatting (relative for recent, absolute for old)
- Pagination support (50 items per page)

**Action Timeline** (`apps/web/components/ActionTimeline.tsx`):
- Chronological timeline view with date grouping
- Visual timeline connector line
- 14 action types with custom icons:
  - 💬 Message Sent
  - 🎙️ Voice Command
  - ⚙️ Settings Changed
  - 🔌 Integration Toggled
  - 🔔 Notification Scheduled
  - ✅ Notification Delivered
  - ❌ Notification Failed
  - 🎨 3D Model Generated
  - 🖼️ Image Generated
  - 📧 Email Sent
  - 📅 Calendar Event
  - 📹 Camera Connected
  - 📹 Camera Disconnected
  - 🚨 Motion Detected
- Color-coded source badges (User/System/Integration)
- JSON metadata viewer in detail panel
- Filtering by action type and source
- Pagination support

**Log Viewer** (`apps/web/components/LogViewer.tsx`):
- Demo UI with sample data (live log retrieval API pending)
- Color-coded log levels (Info/Warn/Error/Debug)
- Category filtering (App/Error/Security/Actions)
- Full-text search functionality
- Detail view with JSON context
- Export/download buttons (placeholder)
- Info banner indicating demo mode

**Settings Integration** (`apps/web/app/settings/page.tsx`):
- New "Memory & Logs" section with tabbed interface
- Three tabs:
  - 💬 Conversations: Browse conversation history
  - ⚡ Actions: View action timeline
  - 📋 System Logs: Access system logs
- Section headers with descriptions
- Consistent design with other settings sections
- Responsive layout

### Usage Examples

**Accessing Memory & Logs:**
1. Open J.A.R.V.I.S. settings page
2. Scroll to "Memory & Logs" section
3. Click on desired tab (Conversations, Actions, or System Logs)
4. Use filters and search to find specific information

**Viewing Conversation History:**
- Select a conversation from the list to view full message history
- Use the search bar to find conversations by content
- Filter by source (Chat, Voice, Real-time)
- Delete unwanted conversations

**Browsing Action Timeline:**
- View chronological timeline of all actions
- Filter by action type to see specific events
- Filter by source (User, System, Integration)
- Click on an action to view detailed metadata

**Reviewing System Logs:**
- Filter by log level (Info, Warn, Error)
- Filter by category (App, Error, Security, Actions)
- Search for specific log messages
- View detailed context for each log entry

### Integration Points

**Chat Integration** (Pending):
- Update `apps/web/app/chat/page.tsx` to save conversations
- Update `apps/web/src/components/JarvisAssistant.tsx` for realtime conversations
- Add "New Conversation" button to start fresh sessions
- Load previous conversation on mount (optional continuation)
- Track function executions as actions

**Context Recall** (Pending):
- Create `recall_memory` function in `apps/web/lib/jarvis-functions.ts`
- Implement search across conversations and actions
- Add time range filtering support
- Enable J.A.R.V.I.S. to answer questions about past interactions
- Examples: "What did we discuss yesterday?", "Show images I generated last week"

**Logging Integration** (Pending):
- Replace all `fastify.log` calls with new logger
- Add logging middleware to track API requests with duration
- Log notification events (scheduled, delivered, failed)
- Log conversation starts/ends in chat endpoints
- Log function executions (image generation, 3D models, navigation)
- Log security events from camera system

### Performance Considerations

**Storage Optimization:**
- Conversations are indexed for fast searching
- Actions limited to 10,000 most recent items
- Logs compressed daily to save disk space
- Automatic cleanup of old data

**Retrieval Optimization:**
- Pagination support for large datasets
- Indexed metadata for fast filtering
- Minimal memory footprint for large conversation lists
- Lazy loading of conversation details

### Future Enhancements

**Context-Aware J.A.R.V.I.S.:**
- Automatic context injection based on conversation history
- Smart suggestions based on past interactions
- Personalized responses based on user preferences

**Advanced Analytics:**
- Conversation analytics dashboard
- Action frequency charts
- Usage patterns visualization
- Export reports in various formats

**Log Retrieval API:**
- Backend endpoint to fetch real log files
- Stream logs in real-time
- Advanced filtering and aggregation
- Download logs as ZIP archives

### Implementation Files

**Backend:**
- **Conversation Store:** `apps/server/src/storage/conversationStore.ts` (409 lines)
- **Action Store:** `apps/server/src/storage/actionStore.ts` (385 lines)
- **Logger:** `apps/server/src/utils/logger.ts` (268 lines)
- **API Endpoints:** `apps/server/src/index.ts` (11 new endpoints)
- **Types:** `packages/shared/src/types.ts` (extended with memory types)

**Frontend:**
- **Conversation History:** `apps/web/components/ConversationHistory.tsx` (408 lines)
- **Action Timeline:** `apps/web/components/ActionTimeline.tsx` (373 lines)
- **Log Viewer:** `apps/web/components/LogViewer.tsx` (309 lines)
- **Settings Integration:** `apps/web/app/settings/page.tsx` (updated with Memory & Logs section)

**Documentation:**
- **API Documentation:** `API_DOCUMENTATION.md` (693 lines)
- This section in `DEV_WORKFLOW.md`

### Dependencies

```json
{
  "pino": "^8.16.1",
  "pino-pretty": "^10.2.3",
  "rotating-file-stream": "^3.1.1"
}
```

### Design Decisions

- **Why JSON storage over SQLite?** Simpler for MVP, no DB setup required, easy to debug and backup
- **Why pino over Winston?** Better performance, structured logging, native JSON output
- **Why file-based logs?** Standard practice for server applications, easy to integrate with log aggregation tools
- **Why 10,000 action limit?** Balances storage usage with useful history (covers several months of normal use)
- **Why separate components?** Modular design allows independent usage and maintenance

---

## References

- **CI Workflow:** `.github/workflows/jarvis-ci.yml`
- **Release Notes:** `JARVIS_V5_RELEASE_NOTES_v5.4.0.md` (example)
- **Test Plan:** `JARVIS_V5_TEST_PLAN.md`
- **Repository Overview:** `JARVIS_V5_REPO_OVERVIEW.md`
- **Notification Foundation:** `packages/shared/src/notifications.ts`, `apps/server/src/notificationScheduler.ts`

For questions or workflow improvements, open an issue or discussion on GitHub.
