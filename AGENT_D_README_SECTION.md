# README Update for AKIOR V6.1.0 - Agent D Voice Features

**Insert this section into README.md after implementing Agent D features**

---

## 📝 Voice-Activated Notes, Reminders & Alarms (v6.1.0)

**Complete voice-controlled productivity suite with natural language processing**

### 🌤️ Voice-Activated Weather Updates

- **Access:** Say "Hey AKIOR, what's the weather?"
- **Features:**
  - Query current weather conditions by voice
  - Location-based queries ("How hot is it in Miami?")
  - Detailed information: temperature (C/F), conditions, humidity, wind speed
  - Integrates with existing OpenWeather API
  - Optional voice feedback for weather reports

**Example commands:**
- "What's the weather like today?"
- "Tell me the temperature in London"
- "What's the weather?"

---

### 📝 Quick Note-Taking

**Instant voice notes with full CRUD operations**

- **Access:** Voice commands or `/notes` (future UI)
- **Features:**
  - Create notes instantly via voice
  - List all saved notes
  - Edit or delete notes by voice
  - Optional tags for organization
  - Persistent storage with timestamps
  - Max 5000 characters per note

**Example commands:**
- "Take a note: Buy groceries tomorrow"
- "AKIOR, remember to call dentist at 2 PM"
- "Show my notes"
- "Delete my last note"
- "Read my notes"

**Data Model:**
```typescript
{
  id: "uuid",
  content: "Note content",
  tags: ["shopping", "urgent"],
  createdAt: "2025-12-06T16:00:00Z",
  updatedAt: "2025-12-06T17:30:00Z"
}
```

---

### ⏰ Contextual Reminders

**Smart reminders with natural language time parsing**

- **Access:** Voice commands
- **Features:**
  - Natural language time expressions
  - Relative times: "in 30 minutes", "in 2 hours"
  - Absolute times: "at 6 PM", "tomorrow at 9 AM"
  - Integration with existing notification system
  - Real-time notification delivery via SSE
  - Persistent across server restarts
  - Max 500 characters per reminder

**Example commands:**
- "Remind me to take out the trash at 6 PM"
- "Set a reminder for tomorrow at 9 AM to call Mom"
- "Remind me in 30 minutes to check the oven"
- "Show my reminders"
- "Cancel the trash reminder"

**Supported Time Formats:**
- Relative: "in X minutes/hours/days"
- Absolute: "at 3 PM", "at 15:30"
- Date-based: "tomorrow at 9 AM", "December 10 at 2 PM"
- Special: "noon", "midnight"

---

### 🚨 Smart Alarm System

**Intelligent alarms with multiple trigger types**

- **Access:** Voice commands or `/alarms` (future UI)
- **Features:**
  - **Time-based alarms**: Traditional wake-up alarms
  - **Motion-based alarms**: Camera motion detection triggers
  - **Event-based alarms**: System events (future enhancement)
  - Enable/disable without deleting
  - Recurring patterns (daily, weekdays, custom)
  - Location-based filtering for motion alarms
  - Integration with existing camera system

**Example commands:**
- "Set an alarm for 7 AM"
- "Wake me up at 6:30 tomorrow"
- "Alert me if there's motion in the backyard"
- "Set a daily alarm for 7 AM on weekdays"
- "Show my alarms"
- "Turn off the motion alarm"
- "Delete the 7 AM alarm"

**Alarm Types:**

1. **Time-Based Alarms**
   - Single or recurring
   - Custom recurrence patterns
   - Example: "Set alarm for 7 AM every weekday"

2. **Motion-Based Alarms**
   - Camera integration
   - Location filtering (e.g., "backyard", "front door")
   - Example: "Alert me if there's motion in the garage"

3. **Event-Based Alarms** (Future)
   - Low battery warnings
   - Temperature thresholds
   - Printer job completion

---

### 🔊 Voice Feedback System

**Configurable text-to-speech responses**

- **Access:** Settings → Voice Feedback
- **Supported Providers:**
  1. **OpenAI Realtime API**: Real-time voice (existing integration)
  2. **ElevenLabs**: High-quality TTS (existing integration)
  3. **Azure TTS**: Enterprise-grade TTS (existing integration)
  4. **None**: Text-only responses

**Voice Confirmations:**
- "I've taken a note: Buy groceries tomorrow"
- "Reminder set for 6 PM: Take out the trash"
- "Alarm set for 7 AM tomorrow"
- "The weather in Miami is currently 75°F and sunny"

**Configuration:**
- User-selectable TTS provider in Settings
- Fallback handling between providers
- Optional - features work without voice feedback
- No additional API keys required (uses existing integrations)

---

## API Endpoints (v6.1.0)

### Weather
- `POST /api/integrations/weather/query` - Get weather for location

### Notes
- `POST /api/notes` - Create note
- `GET /api/notes` - List all notes
- `PUT /api/notes/:id` - Update note
- `DELETE /api/notes/:id` - Delete note

### Reminders
- `POST /api/reminders` - Create reminder
- `GET /api/reminders` - List reminders
- `DELETE /api/reminders/:id` - Cancel reminder

### Alarms
- `POST /api/alarms` - Create alarm
- `GET /api/alarms` - List alarms
- `PUT /api/alarms/:id/toggle` - Enable/disable alarm
- `DELETE /api/alarms/:id` - Delete alarm

---

## Data Storage (v6.1.0)

All data stored locally in `apps/server/data/`:
- `notes.json` - Quick notes
- `reminders.json` - Scheduled reminders
- `alarms.json` - Alarm configurations
- `scheduled-events.json` - Notification events (existing)

**Features:**
- Automatic persistence across server restarts
- Atomic write operations
- Concurrent access handling
- JSON format for easy inspection/backup

---

## Voice Functions (v6.1.0)

New voice functions available to AKIOR:

| Function | Description | Parameters |
|----------|-------------|------------|
| `get_weather` | Get current weather | `location?` (optional) |
| `create_note` | Create a quick note | `content`, `tags?` |
| `list_notes` | List all saved notes | None |
| `delete_note` | Delete a specific note | `note_id` or "last" |
| `set_reminder` | Set a reminder | `message`, `time_expression` |
| `list_reminders` | List all reminders | None |
| `cancel_reminder` | Cancel a reminder | `reminder_id` |
| `set_alarm` | Set an alarm | `name`, `type`, `trigger_time?`, `location?` |
| `list_alarms` | List all alarms | None |
| `toggle_alarm` | Enable/disable alarm | `alarm_id` |
| `delete_alarm` | Delete an alarm | `alarm_id` |

---

## Configuration (v6.1.0)

### Environment Variables

**Weather (required for weather features):**
```bash
OPENWEATHER_API_KEY=your_api_key_here
```

Get your free API key from: https://openweathermap.org/api

### Settings UI

**Voice Feedback Provider:**
- Settings → Voice Feedback → Select TTS provider
- Options: None, OpenAI Realtime API, ElevenLabs, Azure TTS
- Default: None (text-only)

**Weather Location:**
- Settings → Integrations → Weather → Set default location
- Format: "City,CountryCode" (e.g., "Miami,US", "London,GB")

---

## Security & Limits (v6.1.0)

**Input Validation:**
- Notes: Max 5000 characters, HTML sanitization
- Reminders: Max 500 characters
- Tags: Max 50 characters each, max 10 tags per note
- Zod schema validation on all inputs

**Rate Limits:**
- Notes: Max 100 per day
- Reminders: Max 50 per day
- Alarms: Max 20 total

**Data Protection:**
- All data stored locally in `apps/server/data/`
- No cloud sync (privacy-first)
- Atomic write operations prevent corruption
- API keys never exposed to client

---

## Troubleshooting (v6.1.0)

### Notes not saving
1. Check `apps/server/data/` directory exists
2. Verify file write permissions
3. Check server logs for errors

### Reminders not firing
1. Verify notification scheduler is running
2. Check server logs for scheduled events
3. Ensure SSE connection is active (check browser console)

### Time parsing errors
Supported formats:
- ✅ "in 30 minutes", "in 2 hours"
- ✅ "at 3 PM", "at 15:30"
- ✅ "tomorrow at 9 AM"
- ✅ "noon", "midnight"
- ❌ "next Tuesday" (future enhancement)
- ❌ "in a while" (too ambiguous)

### Camera motion alarms not triggering
1. Verify camera is connected and streaming
2. Check camera motion detection is enabled
3. Ensure alarm location matches camera location
4. Check server logs for motion events

---

## Development (v6.1.0)

**New Files:**
```
apps/server/
  data/
    notes.json
    reminders.json
    alarms.json
  src/
    storage/
      notesStore.ts
      remindersStore.ts
      alarmsStore.ts

apps/web/
  src/
    lib/
      time-parser.ts
      voice-feedback.ts
```

**Modified Files:**
```
apps/server/src/index.ts          # Added 11 new endpoints
apps/web/src/lib/akior-functions.ts         # Added 11 new functions
apps/web/src/lib/akior-function-executor.ts # Added 11 new handlers
packages/shared/src/settings.ts   # Added voiceFeedbackProvider
apps/web/app/settings/page.tsx    # Added voice feedback UI
```

**Testing:**
```bash
# TypeScript compilation
npm run typecheck

# Production build
npm run build

# Test all features
npm test  # (add tests as needed)
```

---

## Future Enhancements (v6.1.0+)

### Phase 2
- [ ] Recurring alarms with custom patterns
- [ ] Snooze functionality
- [ ] Location-based reminders (geofencing)
- [ ] Note attachments (voice memos, images)
- [ ] Weather forecasts (multi-day)
- [ ] Weather alerts (severe weather)

### Technical Improvements
- [ ] Database migration (JSON → SQLite/PostgreSQL)
- [ ] Full-text search for notes
- [ ] Note export (PDF, CSV, Markdown)
- [ ] Cloud sync for multi-device
- [ ] Advanced time parsing (relative dates, recurring patterns)

---

## Credits (v6.1.0)

**Voice Features powered by:**
- OpenAI Realtime API (voice processing)
- OpenWeather API (weather data)
- ElevenLabs & Azure TTS (optional voice feedback)
- Existing AKIOR notification system

**Architecture:**
- Fastify backend with Socket.IO
- Next.js frontend
- JSON file storage
- TypeScript throughout

---

## License

MIT
