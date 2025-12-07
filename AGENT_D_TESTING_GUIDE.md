# Agent D Testing Guide

This guide provides comprehensive test cases for all Agent D voice-activated features.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Weather Testing](#weather-testing)
3. [Notes Testing](#notes-testing)
4. [Reminders Testing](#reminders-testing)
5. [Alarms Testing](#alarms-testing)
6. [Voice Feedback Testing](#voice-feedback-testing)
7. [Integration Testing](#integration-testing)
8. [Edge Cases](#edge-cases)

---

## Prerequisites

### Environment Setup

Ensure the following are configured:

```bash
# Required environment variables
OPENWEATHER_API_KEY=your_key_here

# Optional (for voice feedback)
ELEVENLABS_API_KEY=your_key_here
AZURE_TTS_KEY=your_key_here
AZURE_TTS_REGION=eastus
```

### Server Running

```bash
cd apps/server
npm run dev
```

### Data Files Initialized

The following files should exist in `apps/server/data/`:
- `notes.json`
- `reminders.json`
- `alarms.json`

---

## Weather Testing

### Test Case 1: Basic Weather Query

**Voice Command**: "What's the weather?"

**Expected Behavior**:
1. Function `get_weather` called with default location
2. OpenWeather API request sent
3. Response includes temperature, conditions, feels-like temp, and city name
4. Voice confirmation: "It's currently [temp]°F in [city] with [conditions]..."

**API Test**:
```bash
curl -X POST https://localhost:1234/api/integrations/weather/query \
  -H "Content-Type: application/json" \
  -d '{"location": "New York,US"}'
```

**Expected Response**:
```json
{
  "ok": true,
  "weather": {
    "temperature": 72,
    "conditions": "clear sky",
    "feelsLike": 70,
    "humidity": 60,
    "windSpeed": 5.5,
    "city": "New York"
  }
}
```

### Test Case 2: Specific Location

**Voice Command**: "How hot is it in Miami?"

**Expected Behavior**:
1. Function called with location = "Miami"
2. Returns Miami weather data

**API Test**:
```bash
curl -X POST https://localhost:1234/api/integrations/weather/query \
  -H "Content-Type: application/json" \
  -d '{"location": "Miami,US"}'
```

### Test Case 3: Missing API Key

**Setup**: Remove `OPENWEATHER_API_KEY` from environment

**Expected Behavior**:
- Error response: "Weather information is not available - API key not configured"

---

## Notes Testing

### Test Case 4: Create Note

**Voice Command**: "Take a note: Buy milk and eggs"

**Expected Behavior**:
1. Function `create_note` called
2. Note saved with content "Buy milk and eggs"
3. Note ID assigned
4. Voice confirmation: "Note saved: Buy milk and eggs"

**API Test**:
```bash
curl -X POST https://localhost:1234/api/notes \
  -H "Content-Type: application/json" \
  -d '{"content": "Buy milk and eggs", "tags": ["shopping"]}'
```

**Expected Response**:
```json
{
  "ok": true,
  "note": {
    "id": "abc123",
    "content": "Buy milk and eggs",
    "tags": ["shopping"],
    "createdAt": "2025-12-06T20:00:00.000Z"
  }
}
```

### Test Case 5: List Notes

**Voice Command**: "Show my notes"

**Expected Behavior**:
1. Function `list_notes` called
2. Returns all saved notes
3. Voice response lists first 5 notes with numbers

**API Test**:
```bash
curl https://localhost:1234/api/notes
```

### Test Case 6: Delete Specific Note

**Voice Command**: "Delete note abc123"

**Expected Behavior**:
1. Function `delete_note` called with noteId = "abc123"
2. Note removed from storage
3. Voice confirmation: "Note deleted"

**API Test**:
```bash
curl -X DELETE https://localhost:1234/api/notes/abc123
```

### Test Case 7: Delete Last Note

**Voice Command**: "Delete my last note"

**Expected Behavior**:
1. Function called with noteId = "last"
2. Most recently created note deleted
3. Voice confirmation with note content

### Test Case 8: Empty Notes List

**Setup**: Delete all notes

**Voice Command**: "Show my notes"

**Expected Behavior**:
- Voice response: "You have no saved notes"

### Test Case 9: Note Content Validation

**API Test** (exceeds 5000 char limit):
```bash
curl -X POST https://localhost:1234/api/notes \
  -H "Content-Type: application/json" \
  -d "{\"content\": \"$(python -c 'print(\"a\" * 5001)')\"}"
```

**Expected Response**:
```json
{
  "ok": false,
  "error": "note_too_long"
}
```

---

## Reminders Testing

### Test Case 10: Set Reminder (Absolute Time)

**Voice Command**: "Remind me to call Mom at 3 PM"

**Expected Behavior**:
1. Function `set_reminder` called
2. Time parsed to ISO timestamp (today at 3 PM or tomorrow if past)
3. Reminder saved with notification scheduled
4. Voice confirmation: "Reminder set for [formatted time]"

**API Test**:
```bash
curl -X POST https://localhost:1234/api/reminders \
  -H "Content-Type: application/json" \
  -d '{"message": "Call Mom", "triggerAt": "2025-12-06T15:00:00-05:00"}'
```

**Expected Response**:
```json
{
  "ok": true,
  "reminder": {
    "id": "rem123",
    "message": "Call Mom",
    "triggerAt": "2025-12-06T15:00:00-05:00",
    "fired": false,
    "notificationId": "notif456",
    "createdAt": "2025-12-06T20:00:00.000Z"
  }
}
```

### Test Case 11: Set Reminder (Relative Time)

**Voice Command**: "Remind me to check the oven in 30 minutes"

**Expected Behavior**:
1. Time parser calculates current time + 30 minutes
2. Reminder scheduled correctly

**Time Parser Test**:
```typescript
import { parseTime } from '@/lib/time-parser';

const result = parseTime("in 30 minutes");
console.log(result); // ISO timestamp 30 minutes from now
```

### Test Case 12: List Reminders

**Voice Command**: "Show my reminders"

**Expected Behavior**:
1. Function `list_reminders` called
2. Returns only active (non-fired) reminders
3. Voice response includes formatted trigger times

**API Test**:
```bash
curl https://localhost:1234/api/reminders
```

### Test Case 13: Cancel Reminder

**Voice Command**: "Cancel reminder rem123"

**Expected Behavior**:
1. Function `cancel_reminder` called
2. Reminder deleted from storage
3. Scheduled notification cancelled
4. Voice confirmation: "Reminder cancelled"

**API Test**:
```bash
curl -X DELETE https://localhost:1234/api/reminders/rem123
```

### Test Case 14: Empty Reminders List

**Setup**: Delete all reminders

**Voice Command**: "Show my reminders"

**Expected Behavior**:
- Voice response: "You have no active reminders"

### Test Case 15: Time Parsing - Special Keywords

**Test Cases**:
```typescript
parseTime("tomorrow at 9 AM");  // Next day, 9:00
parseTime("at noon");           // Today/tomorrow 12:00
parseTime("at midnight");       // Today/tomorrow 00:00
parseTime("in 2 hours");        // Current time + 2 hours
```

### Test Case 16: Reminder Validation

**API Test** (missing triggerAt):
```bash
curl -X POST https://localhost:1234/api/reminders \
  -H "Content-Type: application/json" \
  -d '{"message": "Test reminder"}'
```

**Expected Response**:
```json
{
  "ok": false,
  "error": "trigger_time_required"
}
```

---

## Alarms Testing

### Test Case 17: Set Time Alarm

**Voice Command**: "Set an alarm for 7 AM"

**Expected Behavior**:
1. Function `set_alarm` called
2. Alarm saved with type="time", triggerTime="07:00"
3. Alarm enabled by default
4. Voice confirmation: "Alarm set for 7:00 AM"

**API Test**:
```bash
curl -X POST https://localhost:1234/api/alarms \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Morning alarm",
    "type": "time",
    "triggerTime": "07:00",
    "recurring": false
  }'
```

**Expected Response**:
```json
{
  "ok": true,
  "alarm": {
    "id": "alarm123",
    "name": "Morning alarm",
    "type": "time",
    "enabled": true,
    "triggerTime": "07:00",
    "recurring": false,
    "createdAt": "2025-12-06T20:00:00.000Z"
  }
}
```

### Test Case 18: Set Recurring Alarm

**Voice Command**: "Set a recurring alarm for 6:30 AM on weekdays"

**Expected Behavior**:
1. Alarm created with recurring=true
2. RecurrencePattern could be "weekdays" or similar

**API Test**:
```bash
curl -X POST https://localhost:1234/api/alarms \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Weekday alarm",
    "type": "time",
    "triggerTime": "06:30",
    "recurring": true,
    "recurrencePattern": "weekdays"
  }'
```

### Test Case 19: Set Motion Alarm

**Voice Command**: "Alert me if there's motion in the backyard"

**Expected Behavior**:
1. Function `set_alarm` called
2. Alarm saved with type="motion", location="backyard"
3. Enabled by default
4. Voice confirmation includes location

**API Test**:
```bash
curl -X POST https://localhost:1234/api/alarms \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Backyard motion",
    "type": "motion",
    "location": "backyard"
  }'
```

### Test Case 20: List Alarms

**Voice Command**: "Show my alarms"

**Expected Behavior**:
1. Function `list_alarms` called
2. Returns all alarms (enabled and disabled)
3. Voice response includes alarm names and status

**API Test**:
```bash
curl https://localhost:1234/api/alarms
```

### Test Case 21: Toggle Alarm

**Voice Command**: "Turn off alarm alarm123"

**Expected Behavior**:
1. Function `toggle_alarm` called
2. Alarm enabled state flipped
3. Voice confirmation: "Alarm turned off"

**API Test**:
```bash
curl -X PUT https://localhost:1234/api/alarms/alarm123/toggle
```

**Expected Response**:
```json
{
  "ok": true,
  "alarm": {
    "id": "alarm123",
    "enabled": false,
    ...
  }
}
```

### Test Case 22: Delete Alarm

**Voice Command**: "Delete alarm alarm123"

**Expected Behavior**:
1. Function `delete_alarm` called
2. Alarm removed from storage
3. Voice confirmation: "Alarm deleted"

**API Test**:
```bash
curl -X DELETE https://localhost:1234/api/alarms/alarm123
```

### Test Case 23: Motion Alarm Integration

**Setup**:
1. Create motion alarm for "Front Door"
2. Connect camera with friendlyName="Front Door"
3. Send camera frames that trigger motion detection

**Expected Behavior**:
1. Camera motion detected
2. `checkMotionAlarms()` called
3. Matching alarm found by location
4. Alarm notification scheduled with type="alarm"
5. Notification fired: "Motion alarm triggered: [alarm name]..."

**Simulated Test**:
```bash
# Create motion alarm
curl -X POST https://localhost:1234/api/alarms \
  -d '{"name": "Front door security", "type": "motion", "location": "Front Door"}'

# Connect to camera socket (requires socket.io client)
# Send frames with increasing size to trigger motion detection
```

### Test Case 24: Alarm Validation

**API Test** (time alarm without triggerTime):
```bash
curl -X POST https://localhost:1234/api/alarms \
  -H "Content-Type: application/json" \
  -d '{"name": "Bad alarm", "type": "time"}'
```

**Expected Response**:
```json
{
  "ok": false,
  "error": "trigger_time_required_for_time_alarms"
}
```

**API Test** (motion alarm without location):
```bash
curl -X POST https://localhost:1234/api/alarms \
  -H "Content-Type: application/json" \
  -d '{"name": "Bad motion alarm", "type": "motion"}'
```

**Expected Response**:
```json
{
  "ok": false,
  "error": "location_or_camera_id_required_for_motion_alarms"
}
```

---

## Voice Feedback Testing

### Test Case 25: Voice Feedback Configuration

**Setup**: Configure voice feedback provider in settings

**Test**:
```typescript
import { isVoiceFeedbackEnabled, speakResponse } from '@/lib/voice-feedback';

// Check if enabled
console.log(isVoiceFeedbackEnabled()); // true/false

// Speak a test message
await speakResponse({ text: "Testing voice feedback", priority: "normal" });
```

### Test Case 26: ElevenLabs Integration

**Setup**: Set `voiceFeedbackProvider` to "elevenlabs" in settings

**Voice Command**: "What's the weather?"

**Expected Behavior**:
1. Weather data retrieved
2. Voice feedback system called with response text
3. Request sent to `/api/integrations/elevenlabs/tts`
4. Audio played through browser

### Test Case 27: Azure TTS Integration

**Setup**: Set `voiceFeedbackProvider` to "azure" in settings

**Voice Command**: "Take a note: Test note"

**Expected Behavior**:
1. Note saved
2. Voice feedback system called
3. Request sent to `/api/integrations/azure-tts/synthesize`
4. Audio played through browser

### Test Case 28: Provider Not Configured

**Setup**: Set `voiceFeedbackProvider` to "elevenlabs" but no API key

**Expected Behavior**:
- Voice feedback fails gracefully
- Error logged but doesn't break command flow
- User still sees text confirmation

### Test Case 29: Voice Feedback Disabled

**Setup**: Set `voiceFeedbackProvider` to "none"

**Voice Command**: Any Agent D command

**Expected Behavior**:
- Commands work normally
- No TTS requests made
- Text responses still shown

---

## Integration Testing

### Test Case 30: Reminder Notification Delivery

**Setup**:
1. Set reminder for 1 minute in future
2. Wait for notification to fire

**Expected Behavior**:
1. Notification scheduler fires event at scheduled time
2. Action logged with type="notification_delivered"
3. Reminder marked as fired (fired=true)
4. UI shows notification

### Test Case 31: Camera Connection + Motion Alarm

**Setup**:
1. Create motion alarm for "Living Room"
2. Connect camera with friendlyName="Living Room"

**Expected Behavior**:
1. Camera connection notification fired
2. Camera registered in directory
3. When motion detected, alarm notification also fires

### Test Case 32: Multiple Alarms Same Location

**Setup**:
1. Create 2 motion alarms for "Backyard"
2. Trigger motion on backyard camera

**Expected Behavior**:
- Both alarms fire separate notifications
- Log shows both alarm IDs triggered

### Test Case 33: Cross-Feature Test

**Voice Commands** (in sequence):
1. "What's the weather?"
2. "Take a note: Weather is nice today"
3. "Remind me to go outside in 10 minutes"
4. "Set an alarm for 6 PM"
5. "Show my notes"
6. "Show my reminders"
7. "Show my alarms"

**Expected Behavior**:
- All commands succeed
- Each feature operates independently
- No cross-contamination of data

---

## Edge Cases

### Test Case 34: Time Parser Edge Cases

```typescript
// Past time today → should schedule for tomorrow
parseTime("at 8 AM"); // If current time is 10 AM

// Invalid time format
parseTime("at invalid"); // Should handle gracefully

// Relative time with zero duration
parseTime("in 0 minutes");

// Very far future
parseTime("in 100 years");
```

### Test Case 35: Large Data Sets

**Setup**: Create 100 notes, 50 reminders, 25 alarms

**Test**:
```bash
for i in {1..100}; do
  curl -X POST https://localhost:1234/api/notes \
    -d "{\"content\": \"Note $i\"}"
done
```

**Expected Behavior**:
- All operations remain performant
- List commands show first 5 items
- Storage files remain valid JSON

### Test Case 36: Concurrent Operations

**Test**: Fire 10 reminder creation requests simultaneously

**Expected Behavior**:
- All reminders saved with unique IDs
- No race conditions
- No file corruption

### Test Case 37: Special Characters

**Voice Command**: "Take a note: Buy \"milk\" & eggs (2 gallons)"

**Expected Behavior**:
- Special characters preserved in storage
- No JSON parsing errors
- Content retrieved correctly

### Test Case 38: Empty/Invalid Inputs

**API Tests**:
```bash
# Empty note content
curl -X POST https://localhost:1234/api/notes -d '{"content": ""}'

# Empty reminder message
curl -X POST https://localhost:1234/api/reminders -d '{"message": "", "triggerAt": "..."}'

# Empty alarm name
curl -X POST https://localhost:1234/api/alarms -d '{"name": "", "type": "time"}'
```

**Expected Responses**: All return appropriate validation errors

### Test Case 39: Server Restart

**Setup**:
1. Create notes, reminders, alarms
2. Restart server

**Expected Behavior**:
- All data persists from JSON files
- Reminders still scheduled at correct times
- No data loss

### Test Case 40: File Permissions

**Setup**: Make `notes.json` read-only

**Test**: Try to create a note

**Expected Behavior**:
- Error response returned
- Error logged with details
- Server doesn't crash

---

## Test Results Template

```markdown
## Test Results - [Date]

### Environment
- Server Version: [version]
- Node Version: [version]
- OS: [OS]

### Results Summary
- Total Tests: 40
- Passed: X
- Failed: Y
- Skipped: Z

### Failed Tests
1. Test Case X: [Reason]
2. Test Case Y: [Reason]

### Notes
[Any additional observations]
```

---

## Automated Testing

### Unit Tests (Future)

```typescript
// Example test structure
describe('Time Parser', () => {
  it('should parse relative times', () => {
    const result = parseTime("in 30 minutes");
    expect(new Date(result).getTime()).toBeCloseTo(Date.now() + 30*60*1000, -3);
  });
  
  it('should parse absolute times', () => {
    const result = parseTime("at 3 PM");
    expect(result).toMatch(/T15:00:00/);
  });
});

describe('Notes Store', () => {
  it('should create and retrieve notes', async () => {
    const note = await createNote("Test note");
    const retrieved = await getNote(note.id);
    expect(retrieved.content).toBe("Test note");
  });
  
  it('should enforce content length limit', async () => {
    const longContent = "a".repeat(5001);
    await expect(createNote(longContent)).rejects.toThrow();
  });
});
```

### Integration Tests (Future)

```typescript
describe('End-to-End Voice Commands', () => {
  it('should handle weather query', async () => {
    const result = await executeFunctionCall({
      function_call_id: 'test1',
      name: 'get_weather',
      arguments: '{"location": "Miami"}'
    });
    
    expect(result.success).toBe(true);
    expect(result.message).toContain('Miami');
  });
});
```

---

## Manual Testing Checklist

- [ ] All 40 test cases executed
- [ ] Voice commands tested with OpenAI Realtime API
- [ ] API endpoints tested with curl
- [ ] Edge cases verified
- [ ] Error handling validated
- [ ] Data persistence confirmed
- [ ] Integration points working
- [ ] Performance acceptable
- [ ] Voice feedback tested (if configured)
- [ ] Documentation updated

---

## Reporting Issues

When reporting issues, include:

1. Test case number
2. Steps to reproduce
3. Expected behavior
4. Actual behavior
5. Error logs (from server console)
6. Environment details
7. Screenshots/recordings (if applicable)

Example:
```
Test Case 10 Failed

Steps:
1. Voice command: "Remind me to call Mom at 3 PM"
2. Time was 4 PM when command issued

Expected: Reminder scheduled for 3 PM tomorrow
Actual: Reminder scheduled for 3 PM today (past time)

Logs:
[2025-12-06T16:05:00] Error parsing time: at 3 PM
```

---

## Contact

For questions or issues with testing, refer to `AGENT_D_IMPLEMENTATION_GUIDE.md` or create a GitHub issue.
