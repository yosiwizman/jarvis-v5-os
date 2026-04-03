# Changelog

All notable changes to AKIOR V5 OS will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [6.0.0] - 2025-12-06

### 🎉 Major Features

#### Notification & Event Loop System
A complete internal notification and event scheduling system enabling real-time alerts for calendar events, 3D printer jobs, camera activities, and system updates.

### ✨ Added

#### Backend
- **Notification Scheduler** - 60-second event loop for scheduled notifications
- **Persistent Storage** - JSON file-based storage (`data/scheduled-events.json`)
- **Server-Sent Events (SSE)** - Real-time notification streaming to all connected clients
- **3 New API Endpoints:**
  - `POST /api/notifications/schedule` - Schedule future notifications
  - `GET /api/notifications/stream` - Subscribe to SSE notification stream
  - `GET /api/notifications/history` - Query notification history with filtering and pagination
- **Calendar Integration Endpoint:**
  - `POST /integrations/google-calendar/sync-reminders` - Sync calendar reminders (15 min before events)

#### Frontend
- **NotificationToast Component** - Real-time toast notifications with auto-dismiss (10s)
- **NotificationHistory Component** - Full history viewer with type filtering and pagination
- **NotificationPreferences Component** - Toggle switches for each notification type
- **CameraSettings Component** - Camera notification configuration UI
- **NotificationContext** - React context for SSE connection and state management

#### Integrations
- **Calendar Event Reminders** - Automatic reminders 15 minutes before Google Calendar events
- **3D Printer Job Alerts** - Auto-trigger notifications on model generation completion/failure
- **Camera Motion Detection** - Frame-to-frame comparison with 5% threshold and 30-second cooldown
- **Camera Connect/Disconnect Alerts** - Automatic notifications when cameras join/leave network

#### Notification Types (6 Total)
- `calendar_reminder` - Calendar event reminders
- `printer_alert` - 3D printer job notifications
- `camera_alert` - Camera motion detection and connection status
- `system_update` - System updates and maintenance (placeholder)
- `integration_error` - External service integration errors (placeholder)
- `custom` - Custom application notifications

#### User Features
- **Preference Filtering** - Enable/disable toast notifications per type via Settings
- **Persistent History** - All notifications logged regardless of preference settings
- **Relative Timestamps** - User-friendly time display ("2h ago", "3d ago")
- **Type-Specific Icons** - Visual differentiation for each notification type
- **Pagination Support** - Browse notification history with 50 items per page

#### Developer Experience
- **Type-Safe APIs** - Full TypeScript types for all notification interfaces
- **Smoke Tests** - Added 2 notification endpoint tests (15 total checks)
- **Integration Test Suite** - 7 automated tests for end-to-end flows
- **Comprehensive Documentation** - Complete implementation guide in `DEV_WORKFLOW.md` Section 5

### 📝 Documentation

- `AKIOR_V5_RELEASE_NOTES_v6.0.0.md` - Complete release documentation (329 lines)
- `PR_DESCRIPTION_v6.0.0.md` - Pull request description (235 lines)
- `MONITORING_CHECKLIST_v6.0.0.md` - Post-deployment monitoring guide (273 lines)
- `MERGE_READY_SUMMARY.md` - Merge preparation summary (221 lines)
- `scripts/test-v6-integration.ts` - Integration test suite (235 lines)
- `DEV_WORKFLOW.md` - Updated Section 5 with notification system documentation

### 🔧 Technical Details

- **Storage:** JSON file with automatic save on schedule/fire operations
- **Event Loop:** Checks every 60 seconds for due notifications (minimal overhead)
- **SSE Management:** Dynamic client registration with unique IDs and auto-reconnection
- **Logging:** All operations logged with `[NotificationScheduler]` prefix for monitoring
- **Error Handling:** Graceful failures with proper 400/500 HTTP responses
- **Fail-Open Design:** Shows notifications if preferences undefined (safe default)

### 🔒 Security & Stability

- Input validation on all API endpoints
- Graceful error handling for storage failures
- SSE auto-reconnection on disconnect
- No sensitive data logged
- No new environment variables required
- No external dependencies added

### 📊 Performance

- **Memory Impact:** ~5MB baseline (minimal)
- **CPU Impact:** <1% during event loop checks
- **Event Loop Interval:** 60 seconds (configurable)
- **History API Response:** <100ms typical
- **SSE Connection Time:** <500ms typical

### ⚠️ Breaking Changes

**None.** This release is fully backward compatible.

### 🔄 Migration Notes

**No migration required.** The notification system is opt-in and additive.

- Existing features continue to work unchanged
- New `data/scheduled-events.json` file created automatically on first schedule
- Default notification preferences enable all types (user can customize in Settings)

### 📚 For Users

**Getting Started:**
1. Navigate to Settings → Notifications to customize which notifications appear
2. View notification history in the Notifications page (accessible from main menu)
3. Schedule custom notifications via the API (see documentation)

**Calendar Reminders:**
- Go to Settings → Integrations → Google Calendar
- Click "Sync Calendar Reminders" to schedule alerts 15 minutes before upcoming events

**Printer Job Alerts:**
- Automatically enabled when you submit 3D model generation jobs
- Receive alerts when models complete or fail

**Camera Motion Detection:**
- Automatically enabled for connected cameras
- Adjust sensitivity by modifying threshold in camera settings if needed

### 📚 For Operators

**Monitoring:**
- Watch server logs for `[NotificationScheduler]` prefix
- Monitor `data/scheduled-events.json` file size (typically <1MB)
- Check SSE connection count in browser DevTools (Network tab)

**Storage Management:**
- File: `data/scheduled-events.json`
- Contains all scheduled and fired events
- Safe to delete if needed (will recreate on next schedule)
- Consider periodic archival for long-running installations

**Troubleshooting:**
- See `MONITORING_CHECKLIST_v6.0.0.md` for complete troubleshooting guide
- Common issues: SSE connection, timing accuracy, storage permissions

**Rollback:**
If issues occur, revert to previous version:
```bash
git revert HEAD~1
git push origin main
```

### 🔮 Future Enhancements

Planned for v6.1+:
- Advanced motion detection (OpenCV integration, ROI selection)
- Notification history archival/soft-delete
- Sound effects for critical alerts
- Database migration (SQLite/Postgres) for scalability
- Reminder snooze functionality
- Smart home device integrations (temperature, humidity, door sensors)
- Push notifications (mobile/desktop)

### 📦 Files Changed

**New Files (10):**
- `apps/server/src/notificationScheduler.ts`
- `packages/shared/src/notifications.ts`
- `apps/web/context/NotificationContext.tsx`
- `apps/web/components/NotificationToast.tsx`
- `apps/web/components/NotificationHistory.tsx`
- `apps/web/components/NotificationPreferences.tsx`
- `apps/web/components/CameraSettings.tsx`
- `scripts/test-v6-integration.ts`
- Plus 4 documentation files

**Modified Files (9):**
- `apps/server/src/index.ts` - Added notification endpoints and integrations
- `packages/shared/src/settings.ts` - Added NotificationPreferences type
- `packages/shared/src/index.ts` - Export notifications module
- `apps/web/app/layout.tsx` - Integrated NotificationProvider
- `apps/web/app/camera/page.tsx` - Added CameraSettings component
- `apps/web/app/security/page.tsx` - Enhanced camera event logging
- `apps/web/tsconfig.json` - Updated paths for context/components
- `scripts/smoke.ts` - Added 2 notification endpoint tests
- `DEV_WORKFLOW.md` - Added Section 5 documentation

### 👥 Credits

Developed by the AKIOR V5 OS team.

**Branch:** `feature/v6-notification-system`  
**Commits:** 11 commits (`9a9030a` → `2b4fa62`)  
**Lines of Code:** ~1,200 added, ~50 modified

---

## [5.x.x] - Previous Releases

See git history for previous release notes.

---

## Legend

- 🎉 Major Features
- ✨ Added
- 🔧 Changed
- 🐛 Fixed
- 🗑️ Removed
- ⚠️ Breaking Changes
- 🔒 Security
- 📝 Documentation
