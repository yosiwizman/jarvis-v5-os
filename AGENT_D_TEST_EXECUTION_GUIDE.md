# Agent D Test Execution Guide

This guide provides step-by-step instructions for executing all Agent D tests.

## Prerequisites

### 1. Start the Server

Open a terminal and run:

```bash
cd C:\Users\yosiw\Desktop\Jarvis-main\apps\server
npm run dev
```

Keep this terminal open. The server should start on `https://localhost:1234`.

### 2. Verify Server is Running

In a new terminal:

```powershell
Test-NetConnection -ComputerName localhost -Port 1234 -InformationLevel Quiet
```

Should return `True`.

---

## Automated Test Execution

### Option 1: Run Full Test Suite (Recommended)

```powershell
cd C:\Users\yosiw\Desktop\Jarvis-main
.\test-agent-d.ps1
```

This will run 28 automated tests covering:
- Notes API (8 tests)
- Reminders API (7 tests)
- Alarms API (11 tests)
- Weather API (2 tests)

### Option 2: Manual curl Tests

If the PowerShell script doesn't work, use these curl commands:

---

## Manual Test Cases

### NOTES API

#### Test 1: List Notes (Empty)
```powershell
Invoke-RestMethod -Uri "https://localhost:1234/api/notes" -Method GET -SkipCertificateCheck
```

**Expected**: `{ "ok": true, "notes": [] }`

#### Test 2: Create Note
```powershell
$body = @{
    content = "Test note: Buy milk and eggs"
    tags = @("shopping")
} | ConvertTo-Json

Invoke-RestMethod -Uri "https://localhost:1234/api/notes" -Method POST -Body $body -ContentType "application/json" -SkipCertificateCheck
```

**Expected**: Returns created note with ID

#### Test 3: List Notes (With Data)
```powershell
Invoke-RestMethod -Uri "https://localhost:1234/api/notes" -Method GET -SkipCertificateCheck
```

**Expected**: Array with 1+ notes

#### Test 4: Update Note
```powershell
$noteId = "YOUR_NOTE_ID_HERE"
$body = @{
    content = "Updated: Buy milk, eggs, and bread"
} | ConvertTo-Json

Invoke-RestMethod -Uri "https://localhost:1234/api/notes/$noteId" -Method PUT -Body $body -ContentType "application/json" -SkipCertificateCheck
```

**Expected**: Updated note returned

#### Test 5: Delete Note
```powershell
$noteId = "YOUR_NOTE_ID_HERE"
Invoke-RestMethod -Uri "https://localhost:1234/api/notes/$noteId" -Method DELETE -SkipCertificateCheck
```

**Expected**: `{ "ok": true }`

---

### REMINDERS API

#### Test 6: Create Reminder
```powershell
$futureTime = (Get-Date).AddHours(2).ToString("o")
$body = @{
    message = "Test reminder: Call Mom"
    triggerAt = $futureTime
} | ConvertTo-Json

Invoke-RestMethod -Uri "https://localhost:1234/api/reminders" -Method POST -Body $body -ContentType "application/json" -SkipCertificateCheck
```

**Expected**: Reminder created with notification scheduled

#### Test 7: List Reminders
```powershell
Invoke-RestMethod -Uri "https://localhost:1234/api/reminders" -Method GET -SkipCertificateCheck
```

**Expected**: Array with active reminders

#### Test 8: Cancel Reminder
```powershell
$reminderId = "YOUR_REMINDER_ID_HERE"
Invoke-RestMethod -Uri "https://localhost:1234/api/reminders/$reminderId" -Method DELETE -SkipCertificateCheck
```

**Expected**: `{ "ok": true }`

---

### ALARMS API

#### Test 9: Create Time Alarm
```powershell
$body = @{
    name = "Morning alarm"
    type = "time"
    triggerTime = "07:00"
    recurring = $false
} | ConvertTo-Json

Invoke-RestMethod -Uri "https://localhost:1234/api/alarms" -Method POST -Body $body -ContentType "application/json" -SkipCertificateCheck
```

**Expected**: Alarm created, enabled by default

#### Test 10: Create Motion Alarm
```powershell
$body = @{
    name = "Backyard security"
    type = "motion"
    location = "backyard"
} | ConvertTo-Json

Invoke-RestMethod -Uri "https://localhost:1234/api/alarms" -Method POST -Body $body -ContentType "application/json" -SkipCertificateCheck
```

**Expected**: Motion alarm created

#### Test 11: List Alarms
```powershell
Invoke-RestMethod -Uri "https://localhost:1234/api/alarms" -Method GET -SkipCertificateCheck
```

**Expected**: Array with alarms

#### Test 12: Toggle Alarm
```powershell
$alarmId = "YOUR_ALARM_ID_HERE"
Invoke-RestMethod -Uri "https://localhost:1234/api/alarms/$alarmId/toggle" -Method PUT -SkipCertificateCheck
```

**Expected**: Alarm enabled state flipped

#### Test 13: Delete Alarm
```powershell
$alarmId = "YOUR_ALARM_ID_HERE"
Invoke-RestMethod -Uri "https://localhost:1234/api/alarms/$alarmId" -Method DELETE -SkipCertificateCheck
```

**Expected**: `{ "ok": true }`

---

### WEATHER API

#### Test 14: Query Weather
```powershell
$body = @{
    location = "New York,US"
} | ConvertTo-Json

Invoke-RestMethod -Uri "https://localhost:1234/api/integrations/weather/query" -Method POST -Body $body -ContentType "application/json" -SkipCertificateCheck
```

**Expected**: Weather data (requires `OPENWEATHER_API_KEY` environment variable)

---

## Validation Tests

### Test Empty Content (Should Fail)
```powershell
$body = @{ content = "" } | ConvertTo-Json
Invoke-RestMethod -Uri "https://localhost:1234/api/notes" -Method POST -Body $body -ContentType "application/json" -SkipCertificateCheck
```

**Expected**: Error - `content_required` or `note_too_short`

### Test Missing Required Field (Should Fail)
```powershell
$body = @{ message = "Test" } | ConvertTo-Json
Invoke-RestMethod -Uri "https://localhost:1234/api/reminders" -Method POST -Body $body -ContentType "application/json" -SkipCertificateCheck
```

**Expected**: Error - `trigger_time_required`

### Test Invalid Alarm Type (Should Fail)
```powershell
$body = @{
    name = "Invalid alarm"
    type = "time"
} | ConvertTo-Json
Invoke-RestMethod -Uri "https://localhost:1234/api/alarms" -Method POST -Body $body -ContentType "application/json" -SkipCertificateCheck
```

**Expected**: Error - `trigger_time_required_for_time_alarms`

---

## Voice Feedback Testing

### Test Voice Feedback Configuration

1. **Check current settings:**
```powershell
Get-Content C:\Users\yosiw\Desktop\Jarvis-main\apps\server\data\settings.json | ConvertFrom-Json | Select-Object -ExpandProperty voiceFeedbackProvider
```

2. **Test voice feedback module:**

In the browser console (while using the web app):
```javascript
import { isVoiceFeedbackEnabled, speakResponse } from '@/lib/voice-feedback';

// Check if enabled
console.log(isVoiceFeedbackEnabled());

// Test speaking
await speakResponse({ text: "Testing voice feedback", priority: "normal" });
```

3. **Test with different providers:**

Modify settings.json:
```json
{
  "voiceFeedbackProvider": "elevenlabs"
}
```

Or:
```json
{
  "voiceFeedbackProvider": "azure"
}
```

Or disable:
```json
{
  "voiceFeedbackProvider": "none"
}
```

---

## Camera Motion Integration Testing

### Test Motion Alarm Matching

1. **Create a motion alarm:**
```powershell
$body = @{
    name = "Front door security"
    type = "motion"
    location = "Front Door"
} | ConvertTo-Json

Invoke-RestMethod -Uri "https://localhost:1234/api/alarms" -Method POST -Body $body -ContentType "application/json" -SkipCertificateCheck
```

2. **Simulate camera connection:**

This requires a Socket.IO client. You can use the web app's camera system or a Socket.IO client library.

Expected flow:
- Camera announces with `friendlyName: "Front Door"`
- Camera sends frames
- Motion detected (frames have >5% size difference)
- `checkMotionAlarms()` called
- Alarm matches by location ("Front Door")
- Notification fired

3. **Check server logs:**

Look for:
```
[INFO] Motion detected, notification scheduled
[INFO] Motion alarm triggered
```

---

## Data Persistence Testing

### Test 1: Create Data
```powershell
# Create a note
$body = @{ content = "Persistence test" } | ConvertTo-Json
Invoke-RestMethod -Uri "https://localhost:1234/api/notes" -Method POST -Body $body -ContentType "application/json" -SkipCertificateCheck
```

### Test 2: Verify File Updated
```powershell
Get-Content C:\Users\yosiw\Desktop\Jarvis-main\apps\server\data\notes.json | ConvertFrom-Json | Select-Object -ExpandProperty notes
```

Should show the created note.

### Test 3: Restart Server
Stop and restart the server (Ctrl+C, then `npm run dev`)

### Test 4: Verify Data Persisted
```powershell
Invoke-RestMethod -Uri "https://localhost:1234/api/notes" -Method GET -SkipCertificateCheck
```

Should still show the note.

---

## Integration Test: End-to-End Flow

### Scenario: User creates reminder via voice, receives notification

1. **Create reminder (simulating voice command):**
```powershell
$futureTime = (Get-Date).AddMinutes(1).ToString("o")
$body = @{
    message = "Integration test reminder"
    triggerAt = $futureTime
} | ConvertTo-Json

$result = Invoke-RestMethod -Uri "https://localhost:1234/api/reminders" -Method POST -Body $body -ContentType "application/json" -SkipCertificateCheck
$reminderId = $result.reminder.id
$notificationId = $result.reminder.notificationId

Write-Host "Reminder created: $reminderId"
Write-Host "Notification scheduled: $notificationId"
Write-Host "Will fire at: $futureTime"
```

2. **Wait 1 minute**

3. **Check if notification fired:**

Monitor server logs for:
```
[INFO] Notification delivered: { type: 'reminder', ... }
```

4. **Verify reminder marked as fired:**
```powershell
Invoke-RestMethod -Uri "https://localhost:1234/api/reminders" -Method GET -SkipCertificateCheck
```

The reminder should have `fired: true`.

---

## Edge Case Tests

### Test 1: Concurrent Note Creation
```powershell
1..10 | ForEach-Object -Parallel {
    $body = @{ content = "Concurrent note $_" } | ConvertTo-Json
    Invoke-RestMethod -Uri "https://localhost:1234/api/notes" -Method POST -Body $body -ContentType "application/json" -SkipCertificateCheck
} -ThrottleLimit 10
```

**Expected**: All 10 notes created successfully, no race conditions

### Test 2: Large Note Content
```powershell
$largeContent = "a" * 4999
$body = @{ content = $largeContent } | ConvertTo-Json

Invoke-RestMethod -Uri "https://localhost:1234/api/notes" -Method POST -Body $body -ContentType "application/json" -SkipCertificateCheck
```

**Expected**: Success (just under 5000 char limit)

### Test 3: Note Content Too Large
```powershell
$tooLarge = "a" * 5001
$body = @{ content = $tooLarge } | ConvertTo-Json

try {
    Invoke-RestMethod -Uri "https://localhost:1234/api/notes" -Method POST -Body $body -ContentType "application/json" -SkipCertificateCheck
} catch {
    Write-Host "Expected error: $($_.ErrorDetails.Message)"
}
```

**Expected**: Error - `note_too_long`

### Test 4: Special Characters in Note
```powershell
$body = @{ content = "Special chars: <>&\"'{}[]" } | ConvertTo-Json

Invoke-RestMethod -Uri "https://localhost:1234/api/notes" -Method POST -Body $body -ContentType "application/json" -SkipCertificateCheck
```

**Expected**: Success, characters properly escaped/sanitized

---

## Time Parser Testing

### Test in Browser Console

Navigate to the web app and open browser console:

```javascript
// Import the time parser
const { parseTime, formatTimestamp } = await import('/src/lib/time-parser.ts');

// Test relative times
console.log("In 30 minutes:", parseTime("in 30 minutes"));
console.log("In 2 hours:", parseTime("in 2 hours"));

// Test absolute times
console.log("At 3 PM:", parseTime("at 3 PM"));
console.log("At 15:30:", parseTime("at 15:30"));

// Test special keywords
console.log("At noon:", parseTime("at noon"));
console.log("At midnight:", parseTime("at midnight"));
console.log("Tomorrow at 9 AM:", parseTime("tomorrow at 9 AM"));

// Test formatting
const now = new Date().toISOString();
console.log("Formatted:", formatTimestamp(now));
```

---

## Test Results Checklist

After running tests, verify:

- [ ] **Notes API**: All CRUD operations work
- [ ] **Reminders API**: Create, list, cancel work
- [ ] **Alarms API**: All alarm types and operations work
- [ ] **Weather API**: Returns data (if API key configured)
- [ ] **Validation**: Invalid inputs properly rejected
- [ ] **Data Persistence**: Data survives server restart
- [ ] **Voice Feedback**: TTS providers work (if configured)
- [ ] **Camera Integration**: Motion alarms trigger correctly
- [ ] **Time Parser**: All time formats parse correctly
- [ ] **Edge Cases**: Concurrent operations and special characters handled

---

## Troubleshooting

### Server won't start
- Check if port 1234 is already in use
- Verify Node.js and npm are installed
- Run `npm install` in `apps/server` directory

### API returns 404
- Verify server is running on correct port
- Check endpoint URLs match exactly
- Ensure using HTTPS (not HTTP)

### Certificate errors
- Use `-SkipCertificateCheck` flag in PowerShell commands
- Verify certificates exist in `apps/server/certs/` or `infra/certs/`

### Weather API fails
- Set `OPENWEATHER_API_KEY` environment variable
- Restart server after setting environment variable

### Voice feedback not working
- Verify `voiceFeedbackProvider` in settings.json
- Check API keys for ElevenLabs/Azure are configured
- Check browser console for TTS errors

---

## Generating Test Report

After completing tests, document results:

```markdown
## Test Results - [Date]

### Environment
- Server Version: [version]
- Node Version: [version]
- OS: Windows

### Results Summary
- Total Tests: 28
- Passed: X
- Failed: Y
- Skipped: Z

### Failed Tests
1. Test X: [Reason]

### Notes
[Observations]
```

Save as `AGENT_D_TEST_RESULTS.md`.

---

## Next Steps After Testing

1. **If all tests pass**: Agent D is production-ready
2. **If tests fail**: Review error messages, fix issues, re-test
3. **Voice command testing**: Test via OpenAI Realtime API in web app
4. **User acceptance testing**: Get feedback from end users
5. **Performance testing**: Test with larger datasets if needed
