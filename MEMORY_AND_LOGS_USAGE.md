# Memory & Logs Usage Guide

## Overview

J.A.R.V.I.S. now includes a comprehensive local memory and logging system that allows you to:
- Browse your conversation history with J.A.R.V.I.S.
- Review all actions performed by the system
- Access system logs for debugging and monitoring

## Accessing Memory & Logs

1. **Open Settings:** Click the settings icon in J.A.R.V.I.S. interface
2. **Navigate to Memory & Logs:** Scroll down to the "Memory & Logs" section
3. **Choose a Tab:** Select from Conversations, Actions, or System Logs

## Conversation History

### Features
- **Master-Detail View:** List of conversations on the left, full conversation on the right
- **Search:** Find conversations by content using the search bar
- **Filter by Source:** Filter conversations by origin (Chat, Voice, Real-time)
- **View Messages:** See the complete message history for any conversation
- **Tags:** View conversation tags for quick categorization
- **Delete:** Remove unwanted conversations (with confirmation)

### How to Use

**Browse Conversations:**
1. Click on any conversation in the list to view its full content
2. Messages are displayed with role indicators (User/Assistant)
3. Scroll through the message history

**Search for Specific Conversations:**
1. Type keywords in the search bar at the top
2. Results update automatically as you type
3. Search includes conversation content and metadata

**Filter by Source:**
1. Use the "Filter by Source" dropdown
2. Select Chat (💬), Voice (🎙️), or Real-time (⚡)
3. Only conversations from that source will be shown

**Delete Conversations:**
1. Select a conversation from the list
2. Click the "Delete" button in the detail panel
3. Confirm the deletion in the dialog

## Action Timeline

### Features
- **Chronological Timeline:** Actions displayed in order with date grouping
- **Visual Timeline:** Connector line showing event progression
- **Action Types:** 14 different action types with custom icons
- **Source Badges:** Color-coded badges showing origin (User/System/Integration)
- **Metadata Viewer:** JSON metadata for each action
- **Filter by Type:** Show only specific action types
- **Filter by Source:** Filter by User, System, or Integration actions

### Action Types

**User Actions:**
- 💬 **Message Sent:** User sent a message to J.A.R.V.I.S.
- 🎙️ **Voice Command:** User gave a voice command
- ⚙️ **Settings Changed:** User modified settings
- 🔌 **Integration Toggled:** User enabled/disabled an integration

**System Events:**
- 🔔 **Notification Scheduled:** System scheduled a notification
- ✅ **Notification Delivered:** Notification was delivered
- ❌ **Notification Failed:** Notification delivery failed

**Function Executions:**
- 🎨 **3D Model Generated:** 3D model generation completed
- 🖼️ **Image Generated:** Image generation completed
- 📧 **Email Sent:** Email sent via Gmail integration
- 📅 **Calendar Event:** Calendar event created

**Security Events:**
- 📹 **Camera Connected:** Security camera connected
- 📹 **Camera Disconnected:** Security camera disconnected
- 🚨 **Motion Detected:** Motion detected by camera

### How to Use

**View Action Details:**
1. Click on any action in the timeline
2. The detail panel shows full metadata in JSON format
3. Review timestamps, source, and additional context

**Filter by Action Type:**
1. Use the "Filter by Type" dropdown
2. Select specific action types to display
3. Timeline updates to show only matching actions

**Filter by Source:**
1. Use the "Filter by Source" dropdown
2. Select User, System, or Integration
3. Only actions from that source will be displayed

**Navigate Timeline:**
1. Actions are grouped by date (e.g., "Today", "Yesterday", "2024-12-05")
2. Scroll through the timeline chronologically
3. Use pagination at the bottom for older actions

## System Logs

### Features
- **Color-Coded Levels:** Different colors for Info, Warn, Error, Debug
- **Category Filter:** Filter by App, Error, Security, or Actions logs
- **Search:** Find specific log entries by content
- **Detail View:** Expand logs to see full context and JSON data
- **Export/Download:** Placeholder for future log export functionality

### Log Levels

- **🔵 Info:** General information and status updates
- **🟡 Warn:** Warnings that don't prevent operation
- **🔴 Error:** Errors that need attention
- **⚪ Debug:** Detailed debugging information

### Log Categories

- **App:** General application logs
- **Error:** Error-only logs
- **Security:** Security-related events
- **Actions:** User action logs

### How to Use

**Filter by Log Level:**
1. Use the "Level" dropdown
2. Select Info, Warn, Error, or Debug
3. Only logs at that level will be shown

**Filter by Category:**
1. Use the "Category" dropdown
2. Select App, Error, Security, or Actions
3. Only logs from that category will be displayed

**Search Logs:**
1. Type keywords in the search bar
2. Results update automatically
3. Search includes log messages and context

**View Log Details:**
1. Click on any log entry to expand it
2. View full context and JSON data
3. Copy specific values for debugging

> **Note:** The Log Viewer currently shows demo data. Live log retrieval will be implemented in a future update.

## API Integration

The Memory & Logs system is backed by a full REST API. See `API_DOCUMENTATION.md` for complete API reference.

### Quick Examples

**Save a Conversation:**
```bash
POST /api/conversations/save
{
  "source": "chat",
  "messages": [{"role": "user", "content": "Hello"}],
  "metadata": {"title": "Greeting"},
  "tags": ["casual"]
}
```

**Record an Action:**
```bash
POST /api/actions/record
{
  "type": "message_sent",
  "source": "user",
  "metadata": {"messageId": "abc123"}
}
```

**Get Conversations:**
```bash
GET /api/conversations?source=chat&limit=50
```

**Get Actions:**
```bash
GET /api/actions?type=notification_scheduled&limit=100
```

## Data Storage

All data is stored locally on your machine:

```
data/
├── conversations/         # Conversation storage
│   ├── index.json        # Conversation metadata
│   └── {uuid}.json       # Individual conversations
├── actions/              # Action tracking
│   ├── index.json        # Action index
│   └── {yyyy-mm-dd}.json # Daily action logs
└── logs/                 # System logs
    ├── app.log           # Application logs
    ├── error.log         # Error logs
    ├── security.log      # Security events
    └── actions.log       # Action logs
```

## Privacy & Security

- **Local Storage:** All data is stored locally on your machine
- **No Cloud Upload:** Conversations and actions are never uploaded to external servers
- **Manual Deletion:** You can delete conversations and actions at any time
- **Automatic Cleanup:** Old actions are automatically cleaned up (keeps most recent 10,000)
- **Log Rotation:** Logs are rotated daily and compressed to save space
- **30-Day Retention:** Logs older than 30 days are automatically deleted

## Performance

The Memory & Logs system is designed to be lightweight and efficient:
- **Indexed Storage:** Fast searching and filtering
- **Pagination:** Large datasets loaded in chunks
- **Lazy Loading:** Conversation details loaded only when viewed
- **Automatic Cleanup:** Prevents unlimited storage growth
- **Compressed Logs:** Saves disk space

## Future Features

Planned enhancements for the Memory & Logs system:
- **Context-Aware J.A.R.V.I.S.:** Automatic context injection from conversation history
- **Advanced Analytics:** Conversation and action analytics dashboard
- **Live Log Streaming:** Real-time log updates in the UI
- **Export Functionality:** Download conversations, actions, and logs
- **Smart Search:** Natural language search across all data
- **Memory Recall:** Ask J.A.R.V.I.S. about past interactions

## Troubleshooting

**Issue: Conversations not appearing**
- Check that conversations are being saved via the API
- Verify the `data/conversations/` directory exists
- Check server logs for errors

**Issue: Actions not showing up**
- Ensure actions are being recorded via `/api/actions/record`
- Check the `data/actions/` directory
- Review server logs for failures

**Issue: System Logs showing demo data**
- This is expected behavior until live log retrieval is implemented
- Logs are still being written to `data/logs/` on the backend
- You can manually view log files in the data directory

**Issue: Performance problems**
- Check the number of stored conversations and actions
- Run cleanup endpoint: `POST /api/actions/cleanup`
- Clear old logs manually if needed
- Contact support if issues persist

## Support

For questions, issues, or feature requests:
1. Check this usage guide
2. Review `API_DOCUMENTATION.md` for API details
3. Check `DEV_WORKFLOW.md` for technical documentation
4. Open an issue on the GitHub repository

---

**Version:** J.A.R.V.I.S. v5.x  
**Last Updated:** 2024-12-06
