# AKIOR V5 OS - Release Notes v6.0.0

**Release Date:** December 6, 2025  
**Branch:** `feature/v6-notification-system`  
**Breaking Changes:** None (backward compatible)

---

## 🎉 Major Features

### **Notification & Event Loop System**

v6.0 introduces a production-ready internal notification and event scheduling system, enabling real-time alerts for calendar events, 3D printer jobs, camera activities, and system updates.

---

## ✨ New Features

### **1. Backend Notification Scheduler**
- **Event Loop:** 60-second interval checking for due notifications
- **Persistent Storage:** JSON file (`data/scheduled-events.json`)
- **SSE Delivery:** Real-time Server-Sent Events streaming to all connected clients
- **Event Types:** `calendar_reminder`, `printer_alert`, `camera_alert`, `system_update`, `integration_error`, `custom`

### **2. Notification API Endpoints**

#### `POST /api/notifications/schedule`
Schedule a notification with future trigger time.

**Request:**
```json
{
  "type": "calendar_reminder",
  "payload": { "eventName": "Team Meeting", "location": "Zoom" },
  "triggerAt": "2025-12-06T10:00:00Z"
}
```

**Response:**
```json
{ "ok": true, "eventId": "uuid-here" }
```

#### `GET /api/notifications/stream`
Subscribe to real-time notification events via Server-Sent Events (SSE).

#### `GET /api/notifications/history`
Retrieve fired notification history with filtering and pagination.

**Query Parameters:**
- `type` - Filter by notification type (optional)
- `limit` - Results per page (default: 50)
- `offset` - Pagination offset (default: 0)

**Response:**
```json
{
  "ok": true,
  "notifications": [...],
  "total": 42,
  "limit": 50,
  "offset": 0
}
```

### **3. Frontend Notification Components**

#### **NotificationToast**
- Real-time toast notifications with type-specific icons
- Auto-dismiss after 10 seconds
- Manual dismiss button
- Positioned top-right with slide-in animation
- 6 notification types with distinct colors

#### **NotificationHistory**
- View past notifications with timestamps and payload summaries
- Filter by type (Calendar, Printer, Camera, System, Integration)
- Relative timestamps ("2h ago", "3d ago")
- Pagination support (50 per page)
- Empty state with helpful messaging

#### **NotificationPreferences**
- Toggle switches for each notification type
- Enable/disable toast notifications per type
- Disabled notifications still logged in history
- Real-time preference updates
- Accessible UI with focus states

### **4. Integration Features**

#### **Calendar Event Reminders**
- **Endpoint:** `POST /integrations/google-calendar/sync-reminders`
- Fetches upcoming Google Calendar events (next 5 events)
- Schedules reminders **15 minutes before** each event
- Returns sync summary: events found, notifications scheduled

#### **3D Printer Job Alerts**
- Auto-triggers on model generation completion/failure
- Includes job ID, prompt, and status in payload
- Separate alerts for success vs error states

#### **Camera Motion Detection**
- Frame-to-frame comparison (5% change threshold)
- 30-second cooldown per camera (prevents spam)
- Triggers `camera_alert` with motion timestamp

#### **Camera Connect/Disconnect Alerts**
- Automatic notifications when cameras join/leave
- Includes camera friendly name and ID

### **5. User Preferences**

**Schema:**
```typescript
{
  calendar_reminder: boolean;
  printer_alert: boolean;
  camera_alert: boolean;
  system_update: boolean;
  integration_error: boolean;
  custom: boolean;
}
```

**Defaults:** All types enabled (true)

**Persistence:** Server-side via `/api/settings` with localStorage fallback

**Behavior:** Disabled notifications are filtered from toast display but still logged in history

---

## 🔧 Technical Details

### **Architecture**
- **Scheduler:** Singleton instance initialized on server startup
- **Storage:** `data/scheduled-events.json` with lastUpdated timestamp
- **Event Loop:** Checks every 60 seconds for due events
- **SSE Clients:** Registered/unregistered dynamically with unique IDs
- **Logging:** All scheduling, firing, and filtering events logged

### **Security & Safety**
- Validation on all API inputs (400 for invalid, 500 for failures)
- Graceful error handling for storage failures
- SSE auto-reconnection on disconnect
- Fail-open preference filtering (default to show if undefined)

### **Performance**
- Minimal overhead: 60-second check interval
- JSON file storage (sufficient for MVP, upgradeable to DB)
- No external dependencies beyond existing integrations
- SSE keeps connections alive with minimal bandwidth

---

## 📦 New Files

**Backend:**
- `apps/server/src/notificationScheduler.ts` (262 lines)
- `packages/shared/src/notifications.ts` (71 lines)
- `apps/server/data/scheduled-events.json` (auto-created)

**Frontend:**
- `apps/web/context/NotificationContext.tsx` (123 lines)
- `apps/web/components/NotificationToast.tsx` (131 lines)
- `apps/web/components/NotificationHistory.tsx` (207 lines)
- `apps/web/components/NotificationPreferences.tsx` (70 lines)
- `apps/web/components/CameraSettings.tsx` (100 lines)

**Documentation:**
- `DEV_WORKFLOW.md` Section 5 (updated)

---

## 🔄 Modified Files

**Backend:**
- `apps/server/src/index.ts`: Added notification endpoints + camera/printer triggers
- `packages/shared/src/settings.ts`: Added `NotificationPreferences` type
- `packages/shared/src/index.ts`: Export notifications module

**Frontend:**
- `apps/web/app/layout.tsx`: Integrated NotificationProvider and NotificationToast
- `apps/web/app/camera/page.tsx`: Added CameraSettings component
- `apps/web/app/security/page.tsx`: Enhanced logging for camera events
- `apps/web/tsconfig.json`: Updated paths for context/components

**Testing:**
- `scripts/smoke.ts`: Added 2 notification endpoint tests (15 total checks)

---

## 🧪 Testing

**Smoke Tests:** 15/15 passing
- 5 page routes (Home, Settings, Chat, Menu, Holomat)
- 8 integration endpoints (System, 3D Print, Web Search, TTS, Spotify, Gmail, Calendar)
- 2 notification endpoints (Schedule, Stream)

**Quality Gates:**
- ✅ TypeScript: 0 errors
- ✅ Build: 19 routes compiled
- ✅ Shared Package: Types built and exported

---

## 📖 Usage Examples

### **Schedule a Notification**
```bash
curl -X POST https://localhost:3000/api/notifications/schedule \
  -H "Content-Type: application/json" \
  -d '{
    "type": "system_update",
    "payload": { "message": "Update available: v6.1.0" },
    "triggerAt": "2025-12-06T18:00:00Z"
  }'
```

### **Subscribe to Notifications (Browser)**
```javascript
const eventSource = new EventSource('/api/notifications/stream');

eventSource.onmessage = (event) => {
  const notification = JSON.parse(event.data);
  console.log('Notification:', notification);
};
```

### **Sync Calendar Reminders**
```bash
curl -X POST https://localhost:3000/integrations/google-calendar/sync-reminders
```

### **Update Preferences**
```javascript
import { updateSettings } from '@shared/settings';

updateSettings({
  notificationPreferences: {
    calendar_reminder: true,
    printer_alert: true,
    camera_alert: false, // Disable camera toasts
    system_update: true,
    integration_error: true,
    custom: true
  }
});
```

---

## 🚀 Deployment Notes

### **For System Administrators**

1. **First Start:**
   - Scheduler initializes automatically on server startup
   - Creates `data/scheduled-events.json` if not exists
   - Loads any existing scheduled events from disk

2. **Monitoring:**
   - Watch logs for `[NotificationScheduler]` prefix
   - Monitor SSE client count: `connectedClients` in stats
   - Check `scheduled-events.json` file size periodically

3. **Cleanup:**
   - Fired events remain in storage (for history)
   - To clear history: delete `data/scheduled-events.json` (recreates on next schedule)
   - Consider periodic archival for long-running installations

4. **Troubleshooting:**
   - **SSE not connecting:** Check HTTPS/localhost configuration
   - **Notifications not firing:** Verify server time is correct (ISO 8601 timestamps)
   - **Storage errors:** Ensure `data/` directory has write permissions

### **For Developers**

1. **Environment Variables:** None required (all configuration via UI)
2. **Database:** No DB required (uses JSON file storage)
3. **Dependencies:** No new npm packages added
4. **Breaking Changes:** None (fully backward compatible)

---

## 🔮 Future Enhancements

**Planned for v6.1+:**
- Advanced motion detection (OpenCV integration, ROI selection)
- Notification history archival/soft-delete
- Sound effects for critical alerts
- Database migration (SQLite/Postgres) for scalability
- Reminder snooze functionality
- Smart home device integrations (temperature, humidity, door sensors)

---

## 📊 Metrics

- **Lines of Code:** ~1,200 new lines
- **Components:** 5 new React components
- **API Endpoints:** 3 new endpoints
- **Notification Types:** 6 supported types
- **Integration Points:** 4 (Calendar, Printer, Camera, System)

---

## 🙏 Credits

Developed by the AKIOR V5 OS team.

Branch: `feature/v6-notification-system`  
Commits: `9a9030a` → `48ccd34` (9 commits)

---

## 📞 Support

For issues or questions:
- Review `DEV_WORKFLOW.md` Section 5
- Check server logs: `[NotificationScheduler]` prefix
- Verify smoke tests: `npm run ci:smoke`

---

**Status:** ✅ Production Ready  
**Tested:** ✅ All quality gates passing  
**Documented:** ✅ Complete documentation in DEV_WORKFLOW.md  
**Ready for:** Merge to `main` branch
