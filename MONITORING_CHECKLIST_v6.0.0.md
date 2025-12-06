# v6.0 Post-Merge Monitoring Checklist

## 🚀 Deployment Steps

### 1. Pre-Deployment Verification
- [ ] Current branch: `feature/v6-notification-system`
- [ ] Git status clean (no uncommitted changes)
- [ ] Build passes: `npm run build` (19 routes expected)
- [ ] TypeScript clean: `npm run typecheck` (0 errors expected)
- [ ] Smoke tests pass: `npm run ci:smoke` (15/15 expected)

### 2. Merge to Main
```bash
git checkout main
git pull origin main
git merge feature/v6-notification-system
git push origin main
```

### 3. Tag Release
```bash
git tag -a v6.0.0 -m "Notification & Event Loop System v6.0"
git push origin v6.0.0
```

---

## 📊 Monitoring Plan

### **Critical Metrics (First 24 Hours)**

#### **Server Logs**
Monitor for `[NotificationScheduler]` prefix:

- [ ] **Startup:** `NotificationScheduler initialized with N events`
- [ ] **Event Loop:** `Checking N scheduled events for firing...` (every 60s)
- [ ] **Scheduling:** `Scheduled notification: [eventId] at [timestamp]`
- [ ] **Firing:** `Fired notification: [eventId] - [type]`
- [ ] **Errors:** Look for any error messages containing `NotificationScheduler`

**Expected Log Pattern:**
```
[NotificationScheduler] Initialized scheduler with 0 loaded events from storage
[NotificationScheduler] Checking 0 scheduled events for firing...
[NotificationScheduler] Checking 0 scheduled events for firing...
[NotificationScheduler] Scheduled notification: abc-123 at 2025-12-06T10:00:00Z
[NotificationScheduler] Checking 1 scheduled events for firing...
[NotificationScheduler] Fired notification: abc-123 - calendar_reminder
```

#### **File System**
- [ ] **Storage File:** Verify `apps/server/data/scheduled-events.json` exists
- [ ] **File Size:** Monitor file growth (should be reasonable, typically <1MB)
- [ ] **Permissions:** Ensure write access to `data/` directory
- [ ] **Backup:** Consider backing up scheduled-events.json periodically

#### **Network/SSE**
- [ ] **SSE Connections:** Check browser DevTools Network tab for `/api/notifications/stream`
- [ ] **Connection Status:** Should show `(pending)` with EventStream type
- [ ] **Data Flow:** Verify notifications appear in EventSource messages
- [ ] **Reconnection:** Test browser refresh (should auto-reconnect)

#### **API Endpoints**
Test each endpoint manually:

**Schedule Notification:**
```bash
curl -X POST https://localhost:3000/api/notifications/schedule \
  -H "Content-Type: application/json" \
  -d '{
    "type": "custom",
    "payload": {"message": "Test notification"},
    "triggerAt": "'$(date -u -d '+5 minutes' +%Y-%m-%dT%H:%M:%SZ)'"
  }'
```
Expected: `{"ok":true,"eventId":"..."}`

**History API:**
```bash
curl https://localhost:3000/api/notifications/history?limit=5
```
Expected: `{"ok":true,"notifications":[...],"total":N,"limit":5,"offset":0}`

**SSE Stream:**
Open in browser: `https://localhost:3000/api/notifications/stream`
Expected: EventSource connection with periodic notifications

**Calendar Sync:**
```bash
curl -X POST https://localhost:3000/integrations/google-calendar/sync-reminders
```
Expected: `{"ok":true,"eventsFound":N,"scheduled":N}`

---

## 🧪 End-to-End Testing

### **Test Scenario 1: Calendar Reminder Flow**
1. [ ] Navigate to Settings → Integrations → Google Calendar
2. [ ] Click "Sync Calendar Reminders"
3. [ ] Verify API call succeeds (check Network tab)
4. [ ] Wait 15 minutes before next calendar event
5. [ ] Verify toast notification appears
6. [ ] Check notification history for calendar_reminder entry

### **Test Scenario 2: Printer Job Alert**
1. [ ] Navigate to 3D Print page
2. [ ] Submit a model generation job
3. [ ] Wait for job completion
4. [ ] Verify toast notification appears with job details
5. [ ] Check notification history for printer_alert entry
6. [ ] Test with failed job (invalid prompt) to verify error alert

### **Test Scenario 3: Camera Motion Detection**
1. [ ] Navigate to Camera page
2. [ ] Ensure at least one camera connected
3. [ ] Wave hand in front of camera
4. [ ] Verify motion detection alert appears
5. [ ] Verify 30-second cooldown (no repeat alert)
6. [ ] Check notification history for camera_alert entry

### **Test Scenario 4: User Preferences**
1. [ ] Navigate to Settings → Notifications
2. [ ] Toggle OFF "Printer Alerts"
3. [ ] Trigger a 3D print job completion
4. [ ] Verify NO toast appears (filtered)
5. [ ] Check notification history → Alert still logged
6. [ ] Toggle back ON and verify toast reappears

### **Test Scenario 5: Notification History**
1. [ ] Navigate to Notifications page
2. [ ] Verify past notifications listed with timestamps
3. [ ] Test filter dropdown (Calendar, Printer, Camera, etc.)
4. [ ] Verify pagination if >50 notifications exist
5. [ ] Check relative timestamps display correctly ("2h ago")

---

## ⚠️ Known Issues & Troubleshooting

### **Issue: SSE not connecting**
**Symptoms:** No EventSource connection in Network tab

**Resolution:**
1. Check HTTPS certificate is valid (mkcert)
2. Verify server running on correct port (3000)
3. Check browser console for CORS errors
4. Try hard refresh (Ctrl+Shift+R)

### **Issue: Notifications not firing**
**Symptoms:** Scheduled notification never appears

**Resolution:**
1. Verify server time is correct: `date` (must be UTC-aware)
2. Check `scheduled-events.json` file exists and is valid JSON
3. Verify event loop running (check logs every 60s)
4. Confirm triggerAt is in the future (ISO 8601 format)

### **Issue: Motion detection too sensitive**
**Symptoms:** Constant camera alerts

**Resolution:**
1. Increase threshold in `detectMotion()` (currently 5%)
2. Increase cooldown period (currently 30s)
3. Check camera lighting conditions (shadows can trigger false positives)

### **Issue: Storage file corruption**
**Symptoms:** Server fails to start with JSON parse error

**Resolution:**
1. Backup `scheduled-events.json`
2. Delete file (will recreate on next schedule)
3. Check disk space and permissions

### **Issue: High memory usage**
**Symptoms:** Server memory increasing over time

**Resolution:**
1. Check number of SSE clients: `connectedClients` count
2. Verify clients are properly closing connections
3. Consider archiving old notifications from storage file

---

## 🔍 Performance Benchmarks

### **Expected Metrics:**

| Metric | Baseline | Threshold |
|--------|----------|-----------|
| Event Loop Interval | 60s | ±2s |
| Schedule API Response | <50ms | <200ms |
| History API Response | <100ms | <500ms |
| SSE Connection Time | <500ms | <2s |
| Memory Usage (idle) | +5MB | +20MB |
| CPU Usage (event loop) | <1% | <5% |

### **Monitoring Commands:**

**Server Memory:**
```bash
ps aux | grep node | grep server
```

**File Size:**
```bash
ls -lh apps/server/data/scheduled-events.json
```

**SSE Connections (Linux):**
```bash
netstat -an | grep :3000 | grep ESTABLISHED | wc -l
```

---

## 📈 Success Criteria (First Week)

- [ ] No server crashes related to NotificationScheduler
- [ ] SSE connections stable across multiple browser sessions
- [ ] Calendar reminders firing correctly (±1 minute accuracy)
- [ ] Printer job alerts consistent (100% of completed jobs)
- [ ] Motion detection working with <10% false positive rate
- [ ] Notification history loading in <500ms
- [ ] User preferences persisting correctly
- [ ] Storage file size growing linearly (<1KB per notification)
- [ ] No TypeScript errors in production
- [ ] No console errors in browser DevTools

---

## 📞 Escalation Path

### **Critical Issues (P0)**
- Server unable to start
- All notifications failing to fire
- Data loss in scheduled-events.json

**Action:** Rollback to previous version immediately

### **High Priority (P1)**
- SSE connections dropping frequently
- Motion detection causing performance issues
- Storage file growing too large

**Action:** Investigate and patch within 24 hours

### **Medium Priority (P2)**
- Calendar sync failing intermittently
- UI bugs in notification components
- Preference toggles not saving

**Action:** Fix in next release cycle

---

## 🎉 Rollout Complete Checklist

After 1 week of stable operation:

- [ ] All end-to-end tests passing
- [ ] No critical or high-priority issues reported
- [ ] Performance metrics within expected ranges
- [ ] User feedback collected and triaged
- [ ] Documentation verified accurate
- [ ] Archive this monitoring checklist
- [ ] Plan v6.1 enhancements

---

**Monitoring Start Date:** _____________  
**Sign-off Engineer:** _____________  
**Status:** 🟢 Green | 🟡 Yellow | 🔴 Red
