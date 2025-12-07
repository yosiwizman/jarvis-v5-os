# Gmail & Google Calendar Integration - Quick Start

This document provides a quick overview of the Gmail and Google Calendar integration features in J.A.R.V.I.S.

---

## ✨ Features

### Gmail Integration
- ✅ **Inbox Management** - View, read, and manage emails via UI
- ✅ **Email Composition** - Send emails through the Email app
- ✅ **Voice Commands** - Compose and send emails using voice ("Send email to...")
- ✅ **Background Notifications** - Real-time notifications for new incoming emails
- ✅ **Email Filtering** - Configure sender whitelists and subject keyword filters

### Google Calendar Integration
- ✅ **Event Display** - View calendar events in the Calendar app
- ✅ **Event Indicators** - Visual dots on calendar days with events
- ✅ **Upcoming Events** - See your next 5 upcoming events at a glance
- ✅ **Event Details** - Click events to see full descriptions, locations, and times
- ✅ **Calendar Reminders** - Automatic reminders 15 minutes before events
- ✅ **Event Sync** - Periodic synchronization with Google Calendar

---

## 🚀 Quick Setup

### 1. Prerequisites
- Google account with Gmail and Calendar
- J.A.R.V.I.S. server installed and running

### 2. Configuration Steps

1. **Create Google Cloud Project** (15 minutes)
   - Enable Gmail API and Google Calendar API
   - Configure OAuth consent screen
   - Generate OAuth2 credentials

2. **Obtain Refresh Token** (5 minutes)
   - Use Google OAuth2 Playground
   - Authorize required scopes
   - Save refresh token

3. **Configure J.A.R.V.I.S.** (5 minutes)
   - Update `data/settings.json` with credentials
   - Restart server
   - Test integration

**📖 Detailed Instructions:** See [OAUTH_SETUP_GUIDE.md](./OAUTH_SETUP_GUIDE.md)

---

## 📱 Using the Integrations

### Email App

**Accessing:**
1. Open J.A.R.V.I.S. HoloMat interface
2. Click the **📧 Email** app icon
3. Your inbox loads automatically

**Features:**
- **View Emails**: Click any email to read full content
- **Compose**: Click "Compose" button to write new email
- **Reply**: Click "Reply" when viewing an email to pre-fill recipient
- **Pagination**: Load more emails with "Load More" button
- **Refresh**: Manual refresh button to check for new messages

### Calendar App

**Accessing:**
1. Open J.A.R.V.I.S. HoloMat interface
2. Click the **📅 Calendar** app icon
3. Calendar loads with your Google Calendar events

**Features:**
- **Event Dots**: Cyan dots indicate days with scheduled events
- **Upcoming Events**: View next 5 upcoming events below calendar
- **Day View**: Click any day to see all events for that day
- **Event Details**: Click event cards to expand descriptions
- **Refresh**: Reload events manually with refresh button

### Voice Commands

Once configured, use these voice commands with J.A.R.V.I.S.:

**Email Commands:**
- "Check my email"
- "Send email to john@example.com about meeting tomorrow"
- "Compose email to support@company.com with subject Bug Report"

**Calendar Commands:**
- "What's on my calendar today?"
- "Show my upcoming events"
- "Do I have any meetings tomorrow?"

---

## 🔔 Email Notifications

### How It Works

The Email Notification System runs in the background and:
1. Checks your Gmail inbox every 5 minutes (configurable)
2. Detects new unread messages
3. Sends real-time notifications via SSE (Server-Sent Events)
4. Displays notification badges in the J.A.R.V.I.S. UI

### Configuration

Edit `data/settings.json` to customize:

```json
{
  "email_notifications": {
    "enabled": true,
    "checkIntervalMinutes": 5,
    "notifyUnreadOnly": true,
    "maxMessagesPerCheck": 10,
    "filters": {
      "senderWhitelist": ["important@company.com", "boss@work.com"],
      "subjectKeywords": ["urgent", "important", "action required"]
    }
  }
}
```

**Options:**
- `enabled` - Enable/disable background checking
- `checkIntervalMinutes` - How often to check (default: 5 minutes)
- `notifyUnreadOnly` - Only notify for unread messages
- `maxMessagesPerCheck` - Max messages to fetch per check
- `senderWhitelist` - Only notify for specific senders (empty = all)
- `subjectKeywords` - Only notify if subject contains keywords (empty = all)

### API Endpoints

**Get Status:**
```bash
GET /api/email-notifications/status
```

**Trigger Manual Check:**
```bash
POST /api/email-notifications/trigger
```

**Update Configuration:**
```bash
POST /api/email-notifications/config
Content-Type: application/json

{
  "enabled": true,
  "checkIntervalMinutes": 10
}
```

---

## 📅 Calendar Reminders

### How It Works

1. J.A.R.V.I.S. syncs with Google Calendar periodically
2. Schedules reminder notifications 15 minutes before each event
3. Notifications appear in real-time via SSE stream
4. Users receive alerts before meetings/events start

### Syncing Reminders

**Manual Sync via API:**
```bash
POST /api/integrations/google-calendar/sync-reminders
```

**Response:**
```json
{
  "ok": true,
  "eventsFound": 12,
  "scheduledCount": 5,
  "message": "Scheduled 5 reminder(s) for upcoming events"
}
```

**Automatic Syncing:**
You can set up a cron job or periodic task to call this endpoint regularly.

---

## 🧪 Testing

### Test Gmail Connection

**UI Method:**
1. Open Email app
2. If configured correctly, inbox loads
3. Try sending a test email

**API Method:**
```bash
curl -X POST http://localhost:3001/api/integrations/gmail/test
```

**Expected Response:**
```json
{
  "ok": true,
  "messageCount": 5,
  "messages": [...]
}
```

### Test Google Calendar Connection

**UI Method:**
1. Open Calendar app
2. Events should display with cyan dots
3. Click days and events to interact

**API Method:**
```bash
curl -X POST http://localhost:3001/api/integrations/google-calendar/test
```

**Expected Response:**
```json
{
  "ok": true,
  "upcomingEvents": [...]
}
```

---

## 🛠️ Architecture

### Backend Components

**Gmail Client** (`apps/server/src/clients/gmailClient.ts`):
- OAuth2 token refresh flow
- Inbox fetching with pagination
- Full message retrieval
- Email sending via Gmail API

**Google Calendar Client** (`apps/server/src/clients/googleCalendarClient.ts`):
- OAuth2 token refresh flow
- Event fetching with configurable limits
- Event metadata (title, time, location, description)

**Email Notification System** (`apps/server/src/integrations/email-notifications.ts`):
- Background email checking service
- Periodic polling (configurable interval)
- New message detection (tracks last checked message ID)
- Configurable filters (sender, subject)
- Notification broadcasting via SSE

**Notification Scheduler** (`apps/server/src/notificationScheduler.ts`):
- Event scheduling system
- Persistent storage (JSON file)
- SSE broadcasting to connected clients
- Event loop (checks every minute for due events)

### Frontend Components

**EmailApp** (`apps/web/src/components/holomat/EmailApp.tsx`):
- Three views: Inbox, Detail, Compose
- Material-like glassmorphism UI
- Purple/cyan theme matching HoloMat
- API integration for inbox and sending

**CalendarApp** (`apps/web/src/components/holomat/CalendarApp.tsx`):
- Calendar grid with event indicators
- Upcoming events section
- Day view and event detail expansion
- Event fetching and display

**Voice Integration** (`apps/web/src/lib/jarvis-functions.ts` & `jarvis-function-executor.ts`):
- OpenAI Function Calling for voice commands
- `compose_email` function
- `check_email` function
- Email validation and API integration

---

## 🔧 Troubleshooting

### Common Issues

**"gmail_not_configured" Error:**
- Check `data/settings.json` exists and has correct Gmail config
- Verify `integrations.gmail.enabled` is `true`
- Restart server after config changes

**"token_exchange_failed" Error:**
- Refresh token may be invalid or revoked
- Regenerate refresh token using OAuth2 Playground
- Ensure Client ID and Secret are correct

**Email Notifications Not Working:**
- Check server logs for initialization messages
- Verify `email_notifications.enabled` is `true` in settings
- Try manual trigger: `POST /api/email-notifications/trigger`
- Check if Gmail credentials are configured

**Calendar Events Not Showing:**
- Ensure Google Calendar API is enabled in Google Cloud
- Check `integrations.google_calendar` config in settings
- Try test endpoint: `POST /api/integrations/google-calendar/test`

**Voice Commands Not Working:**
- Verify OpenAI Realtime API is configured
- Check that voice session is active
- Ensure email/calendar functions are registered

### Debug Logging

Enable verbose logging by checking server console output:

```bash
# Server logs show:
[EmailNotificationChecker] Initializing...
[EmailNotificationChecker] Background checker started (every 5 min)
[Gmail] Fetching access token via refresh token flow
[Gmail] Access token obtained successfully
```

---

## 📊 System Status

### Check Notification System Status

```bash
curl http://localhost:3001/api/email-notifications/status
```

**Response:**
```json
{
  "ok": true,
  "initialized": true,
  "state": {
    "lastCheckedAt": "2024-12-06T16:45:00Z",
    "lastMessageId": "abc123xyz",
    "checkCount": 142,
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

### Check Notification History

```bash
curl http://localhost:3001/api/notifications/history?type=email_notification&limit=10
```

---

## 📚 Additional Resources

- [Complete OAuth Setup Guide](./OAUTH_SETUP_GUIDE.md)
- [Gmail API Documentation](https://developers.google.com/gmail/api)
- [Google Calendar API Documentation](https://developers.google.com/calendar/api)
- [OAuth2 Playground](https://developers.google.com/oauthplayground/)

---

## 🆘 Support

If you encounter issues:

1. Check [Troubleshooting](#troubleshooting) section above
2. Review server logs for error messages
3. Verify OAuth credentials are correct
4. Try regenerating refresh tokens
5. Check API endpoint responses with `curl`

---

## 🎉 Success Checklist

Before considering setup complete:

- ✅ Google Cloud project created
- ✅ Gmail API enabled
- ✅ Google Calendar API enabled
- ✅ OAuth2 credentials generated
- ✅ Refresh token obtained
- ✅ `settings.json` configured
- ✅ Server restarted
- ✅ Email app working (inbox loads, can send emails)
- ✅ Calendar app working (events display with dots)
- ✅ Voice commands tested (optional)
- ✅ Email notifications working (optional)
- ✅ Calendar reminders scheduled (optional)

**Once all items are checked, your integration is complete!** 🚀

---

*Last Updated: December 2024*
*Version: 1.0.0*
