# Phase 7: Testing & Validation - Complete Guide

This document outlines the testing and validation procedures for the Email Notification System and Calendar Reminders integration in J.A.R.V.I.S.

---

## 🎯 Testing Objectives

1. ✅ Verify email notification system initialization
2. ✅ Test background email checking functionality
3. ✅ Validate notification delivery via SSE
4. ✅ Confirm frontend UI displays notifications correctly
5. ✅ Test manual trigger endpoints
6. ✅ Validate configuration updates
7. ✅ Test calendar reminder notifications
8. ✅ Verify error handling and recovery
9. ✅ Performance testing

---

## 🚀 Quick Start - Testing Dashboard

### Access the Testing Interface

Navigate to: **`http://localhost:3000/test-email-notifications`**

This dashboard provides:
- Real-time system status monitoring
- Manual email check triggering
- Simulated notification testing
- Configuration management
- Live notification feed
- API endpoint documentation

### Dashboard Features

**System Status Panel:**
- Initialization status (✅ Initialized / ❌ Not Initialized)
- Service status (🟢 Enabled / 🟡 Disabled)
- Last checked timestamp
- Total checks performed
- Error tracking
- Configuration display

**Control Panel:**
- 🔄 **Trigger Manual Check** - Fetch emails immediately
- 🧪 **Simulate Email Notification** - Test UI with fake notification
- 🔴/🟢 **Enable/Disable** - Toggle background checking

**Live Notifications Panel:**
- Shows all email notifications received
- Displays: subject, from, snippet, timestamp
- Message ID and thread ID tracking

---

## 📋 Test Plan

### Test 1: System Initialization

**Objective:** Verify email notification system initializes correctly on server startup

**Steps:**
1. Ensure Gmail credentials are configured in `data/settings.json`
2. Restart J.A.R.V.I.S. server: `pnpm run dev`
3. Check server logs for:
   ```
   [EmailNotificationChecker] Initializing...
   [EmailNotificationChecker] Background checker started (every 5 min)
   Email notification system initialized
   ```
4. Navigate to test dashboard
5. Verify "System Status" shows "✅ Initialized"

**Expected Results:**
- ✅ Server logs show initialization messages
- ✅ Dashboard shows "Initialized" status
- ✅ Background checker is running

---

### Test 2: Manual Email Check

**Objective:** Test manual trigger endpoint and verify email fetching

**Steps:**
1. Open test dashboard
2. Click "Trigger Manual Check" button
3. Wait for response message
4. Check "Total Checks" counter increments
5. Verify "Last Checked" timestamp updates

**Expected Results:**
- ✅ Success message appears: "✅ Email check triggered successfully"
- ✅ "Total Checks" increments by 1
- ✅ "Last Checked" shows current timestamp
- ✅ If new emails exist, notifications appear

**Server Logs:**
```
[EmailNotificationChecker] Manual check triggered
[EmailNotificationChecker] Checking for new emails (check #X)
[Gmail] Fetching up to 10 messages (labels: INBOX, UNREAD)
[EmailNotificationChecker] Fetched Y message(s)
[EmailNotificationChecker] Check completed successfully
```

---

### Test 3: Simulated Notification

**Objective:** Test notification UI without requiring real emails

**Steps:**
1. Open test dashboard
2. Click "Simulate Email Notification" button
3. Observe toast notification appears in top-right corner
4. Verify notification appears in "Live Email Notifications" panel

**Expected Results:**
- ✅ Purple toast notification appears with 📧 icon
- ✅ Toast shows: "From: test@example.com - Test Email Notification"
- ✅ Notification auto-dismisses after 10 seconds
- ✅ Notification appears in live panel with full details

---

### Test 4: Real Email Notification

**Objective:** End-to-end test with actual Gmail emails

**Steps:**
1. Send a test email to your configured Gmail account
2. Wait for background check (5 minutes) OR click "Trigger Manual Check"
3. Observe notification behavior

**Expected Results:**
- ✅ Background checker detects new email within 5 minutes
- ✅ Toast notification appears with actual email details
- ✅ Notification shows correct from/subject/snippet
- ✅ Email marked as "seen" in tracking (won't re-notify)

---

### Test 5: SSE Stream Connection

**Objective:** Verify Server-Sent Events stream is connected and working

**Steps:**
1. Open test dashboard
2. Open browser DevTools → Network tab
3. Find `/api/notifications/stream` request
4. Verify status shows `(pending)` or `200`
5. Click "Simulate Email Notification"
6. Check Network tab → Messages to see SSE event

**Expected Results:**
- ✅ SSE connection established on page load
- ✅ Connection confirmation message received
- ✅ Notification events appear in real-time
- ✅ Connection auto-reconnects if dropped

**Server Logs:**
```
[NotificationContext] Connecting to SSE stream...
[NotificationContext] SSE connection established
[NotificationContext] SSE connection confirmed: {...}
```

---

### Test 6: Configuration Updates

**Objective:** Test runtime configuration changes

**Test 6a: Disable Notifications**
1. Click "Disable Notifications" button
2. Verify button changes to "Enable Notifications" (green)
3. Check status shows "🟡 Disabled"
4. Wait 5+ minutes and verify no background checks occur

**Test 6b: Re-enable Notifications**
1. Click "Enable Notifications" button
2. Verify button changes to "Disable" (red)
3. Check status shows "🟢 Enabled"
4. Verify background checking resumes

**Expected Results:**
- ✅ Configuration updates immediately
- ✅ Background checker stops/starts correctly
- ✅ Settings persist to `data/settings.json`

---

### Test 7: Filter Configuration

**Objective:** Test sender whitelist and subject keyword filtering

**Steps:**
1. Update `data/settings.json`:
   ```json
   {
     "email_notifications": {
       "enabled": true,
       "checkIntervalMinutes": 5,
       "notifyUnreadOnly": true,
       "maxMessagesPerCheck": 10,
       "filters": {
         "senderWhitelist": ["important@company.com"],
         "subjectKeywords": ["urgent", "action required"]
       }
     }
   }
   ```
2. Restart server
3. Send test emails:
   - Email 1: From `important@company.com`, Subject "Normal email"
   - Email 2: From `other@example.com`, Subject "Urgent: Action needed"
   - Email 3: From `spam@example.com`, Subject "Hello"
4. Trigger manual check

**Expected Results:**
- ✅ Email 1 triggers notification (sender in whitelist)
- ✅ Email 2 triggers notification (subject contains "urgent")
- ✅ Email 3 does NOT trigger notification (filtered out)

---

### Test 8: Unread-Only Mode

**Objective:** Verify unread-only filtering works

**Steps:**
1. Ensure `notifyUnreadOnly: true` in config
2. Mark all Gmail emails as read
3. Trigger manual check → No notifications
4. Send new unread email
5. Trigger manual check → Notification appears

**Expected Results:**
- ✅ Read emails do not trigger notifications
- ✅ Only unread emails trigger notifications
- ✅ Gmail API filters by `UNREAD` label

**Server Logs:**
```
[Gmail] Fetching up to 10 messages (labels: INBOX, UNREAD)
```

---

### Test 9: Calendar Reminder Notifications

**Objective:** Test calendar reminder integration

**Steps:**
1. Navigate to: `http://localhost:3000/holomat`
2. Open Calendar app
3. Verify events display from Google Calendar
4. Create a calendar event 20 minutes in the future
5. Manually sync reminders:
   ```bash
   curl -X POST http://localhost:3001/api/integrations/google-calendar/sync-reminders
   ```
6. Wait for reminder (15 minutes before event)

**Expected Results:**
- ✅ Calendar app displays events with cyan dots
- ✅ Sync endpoint schedules reminder for 15min before event
- ✅ Toast notification appears with calendar icon (📅)
- ✅ Notification shows event name and time

---

### Test 10: Multi-Tab Notification Sync

**Objective:** Verify notifications work across browser tabs

**Steps:**
1. Open test dashboard in Tab 1
2. Open test dashboard in Tab 2
3. In Tab 1, click "Simulate Email Notification"
4. Observe both tabs

**Expected Results:**
- ✅ Notification appears in both Tab 1 and Tab 2
- ✅ Both tabs show same notification in live panel
- ✅ SSE connection works independently per tab

---

### Test 11: Error Handling

**Objective:** Test graceful error handling

**Test 11a: Invalid Gmail Credentials**
1. Set invalid refresh token in `settings.json`
2. Restart server
3. Trigger manual check
4. Check "Last Error" field

**Expected Results:**
- ✅ System shows error: "token_exchange_failed"
- ✅ Checker continues to retry on next interval
- ✅ No crashes or unhandled exceptions

**Test 11b: Network Timeout**
1. Disconnect internet
2. Trigger manual check
3. Verify timeout handling

**Expected Results:**
- ✅ Error logged: "fetch_inbox_timeout"
- ✅ System recovers when network restored

---

### Test 12: Performance Testing

**Objective:** Verify system performance under load

**Test 12a: Check Interval Performance**
1. Monitor server CPU/memory usage
2. Let background checker run for 30 minutes (6 checks)
3. Verify no memory leaks

**Expected Results:**
- ✅ CPU usage spikes briefly during checks (~1-2 seconds)
- ✅ Memory usage stable (no leaks)
- ✅ Checks complete within 5 seconds

**Test 12b: Large Inbox**
1. Set `maxMessagesPerCheck: 50`
2. Trigger check on inbox with 100+ emails
3. Measure response time

**Expected Results:**
- ✅ Check completes within 30 seconds
- ✅ Only first 50 messages fetched
- ✅ No timeout errors

---

## 🧪 API Testing

### Test Email Notification Status

```bash
curl http://localhost:3001/api/email-notifications/status
```

**Expected Response:**
```json
{
  "ok": true,
  "initialized": true,
  "state": {
    "lastCheckedAt": "2024-12-06T17:00:00Z",
    "lastMessageId": "msg_abc123",
    "checkCount": 15,
    "lastError": null
  },
  "config": {
    "enabled": true,
    "checkIntervalMinutes": 5,
    "notifyUnreadOnly": true,
    "maxMessagesPerCheck": 10
  }
}
```

### Trigger Manual Check

```bash
curl -X POST http://localhost:3001/api/email-notifications/trigger
```

**Expected Response:**
```json
{
  "ok": true,
  "message": "Email check triggered"
}
```

### Update Configuration

```bash
curl -X POST http://localhost:3001/api/email-notifications/config \
  -H "Content-Type: application/json" \
  -d '{"enabled": false, "checkIntervalMinutes": 10}'
```

**Expected Response:**
```json
{
  "ok": true,
  "message": "Configuration updated"
}
```

### Test Gmail Inbox Endpoint

```bash
curl http://localhost:3001/api/integrations/gmail/inbox?maxResults=5
```

**Expected Response:**
```json
{
  "ok": true,
  "messages": [
    {
      "id": "msg_123",
      "threadId": "thread_456",
      "subject": "Test Email",
      "from": "sender@example.com",
      "date": "2024-12-06T17:00:00Z",
      "snippet": "Email preview text..."
    }
  ],
  "nextPageToken": null
}
```

---

## 📊 Success Criteria

### Phase 7 is considered complete when:

**Backend:**
- ✅ Email notification system initializes on server startup
- ✅ Background checking runs every 5 minutes (configurable)
- ✅ Manual trigger endpoint works
- ✅ Configuration updates apply immediately
- ✅ Notifications broadcast via SSE
- ✅ Error handling is graceful
- ✅ State persists to disk

**Frontend:**
- ✅ Toast notifications appear for new emails
- ✅ Email notifications show correct icon (📧) and styling (purple)
- ✅ Notifications auto-dismiss after 10 seconds
- ✅ Test dashboard displays system status accurately
- ✅ Live notification panel updates in real-time
- ✅ Multi-tab support works

**Integration:**
- ✅ Gmail API integration works end-to-end
- ✅ OAuth token refresh automatic
- ✅ Unread-only filtering functional
- ✅ Sender/subject filtering works
- ✅ Calendar reminders integrate correctly

**Performance:**
- ✅ Email checks complete within 5-10 seconds
- ✅ No memory leaks over extended runtime
- ✅ CPU usage minimal during idle periods
- ✅ SSE connections stable and auto-reconnect

**Documentation:**
- ✅ Testing guide complete (this document)
- ✅ OAuth setup guide available
- ✅ Quick start README available
- ✅ API endpoints documented

---

## 🐛 Known Issues / Limitations

1. **Gmail API Quotas:**
   - Gmail API has daily quota limits
   - Excessive checking may hit rate limits
   - Solution: Increase check interval if needed

2. **SSE Connection Drops:**
   - Browser may close SSE after prolonged inactivity
   - Solution: EventSource auto-reconnects

3. **Duplicate Notifications:**
   - If server restarts mid-check, may re-notify
   - Solution: State tracking prevents most duplicates

4. **Time Zone Handling:**
   - Calendar reminders use server timezone
   - Solution: Use ISO timestamps (already implemented)

---

## 🎉 Testing Checklist

Mark each test as complete:

- [ ] Test 1: System Initialization
- [ ] Test 2: Manual Email Check
- [ ] Test 3: Simulated Notification
- [ ] Test 4: Real Email Notification
- [ ] Test 5: SSE Stream Connection
- [ ] Test 6: Configuration Updates
- [ ] Test 7: Filter Configuration
- [ ] Test 8: Unread-Only Mode
- [ ] Test 9: Calendar Reminder Notifications
- [ ] Test 10: Multi-Tab Notification Sync
- [ ] Test 11: Error Handling
- [ ] Test 12: Performance Testing

**All tests passed?** ✅ Phase 7 Complete!

---

## 🚀 Next Steps (Post-Phase 7)

Once Phase 7 is complete, consider:

1. **Production Deployment:**
   - Set up environment variables for credentials
   - Configure production Gmail OAuth app
   - Set up monitoring and logging

2. **Feature Enhancements:**
   - Email notification badges on app icons
   - Notification history panel
   - "Mark as read" functionality
   - Email filters UI

3. **Performance Optimization:**
   - Implement webhook-based notifications (Gmail Push API)
   - Reduce check interval for power users
   - Cache email metadata

4. **User Experience:**
   - Notification sounds
   - Browser push notifications
   - Email quick actions (reply, archive)

---

*Last Updated: December 2024*
*Version: 1.0.0*
