# Agent D API Testing Script
# Tests all core features: weather, notes, reminders, and alarms

$baseUrl = "https://localhost:1234"
$ErrorActionPreference = "Continue"

# Helper function to make API calls
function Invoke-ApiTest {
    param(
        [string]$Method,
        [string]$Endpoint,
        [string]$Body = $null,
        [string]$TestName
    )
    
    Write-Host "`n========================================" -ForegroundColor Cyan
    Write-Host "TEST: $TestName" -ForegroundColor Cyan
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "Method: $Method | Endpoint: $Endpoint" -ForegroundColor Gray
    
    try {
        $params = @{
            Uri = "$baseUrl$Endpoint"
            Method = $Method
            ContentType = "application/json"
            SkipCertificateCheck = $true
            TimeoutSec = 10
        }
        
        if ($Body) {
            $params.Body = $Body
            Write-Host "Body: $Body" -ForegroundColor Gray
        }
        
        $response = Invoke-RestMethod @params
        Write-Host "✓ SUCCESS" -ForegroundColor Green
        Write-Host "Response:" -ForegroundColor Yellow
        $response | ConvertTo-Json -Depth 5
        return $response
    }
    catch {
        Write-Host "✗ FAILED" -ForegroundColor Red
        Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
        if ($_.ErrorDetails.Message) {
            Write-Host "Details: $($_.ErrorDetails.Message)" -ForegroundColor Red
        }
        return $null
    }
}

Write-Host @"
╔═══════════════════════════════════════════════════════════╗
║           Agent D API Testing Suite                       ║
║           Testing All Core Features                       ║
╚═══════════════════════════════════════════════════════════╝
"@ -ForegroundColor Magenta

# Check if server is running
Write-Host "`nChecking if server is running on port 1234..." -ForegroundColor Yellow
$serverRunning = Test-NetConnection -ComputerName localhost -Port 1234 -InformationLevel Quiet -WarningAction SilentlyContinue

if (-not $serverRunning) {
    Write-Host "✗ Server is not running on port 1234" -ForegroundColor Red
    Write-Host "Please start the server with: npm run dev" -ForegroundColor Yellow
    exit 1
}

Write-Host "✓ Server is running" -ForegroundColor Green

# ============================================================================
# TEST SECTION 1: NOTES API
# ============================================================================

Write-Host "`n`n╔═══════════════════════════════════════════════════════════╗" -ForegroundColor Magenta
Write-Host "║                  NOTES API TESTS                          ║" -ForegroundColor Magenta
Write-Host "╚═══════════════════════════════════════════════════════════╝" -ForegroundColor Magenta

# Test 1: List notes (should be empty initially)
$notes = Invoke-ApiTest -Method "GET" -Endpoint "/api/notes" -TestName "List Notes (Empty)"

# Test 2: Create a note
$noteBody = @{
    content = "Test note: Buy milk and eggs"
    tags = @("shopping", "groceries")
} | ConvertTo-Json

$createdNote = Invoke-ApiTest -Method "POST" -Endpoint "/api/notes" -Body $noteBody -TestName "Create Note"
$noteId = $createdNote.note.id

# Test 3: Create another note
$note2Body = @{
    content = "Test note 2: Meeting at 3 PM"
    tags = @("work")
} | ConvertTo-Json

$createdNote2 = Invoke-ApiTest -Method "POST" -Endpoint "/api/notes" -Body $note2Body -TestName "Create Second Note"

# Test 4: List notes (should have 2 notes)
Invoke-ApiTest -Method "GET" -Endpoint "/api/notes" -TestName "List Notes (With Data)"

# Test 5: Get specific note
if ($noteId) {
    Invoke-ApiTest -Method "GET" -Endpoint "/api/notes/$noteId" -TestName "Get Specific Note"
}

# Test 6: Update note
if ($noteId) {
    $updateBody = @{
        content = "Updated: Buy milk, eggs, and bread"
        tags = @("shopping")
    } | ConvertTo-Json
    
    Invoke-ApiTest -Method "PUT" -Endpoint "/api/notes/$noteId" -Body $updateBody -TestName "Update Note"
}

# Test 7: Delete note
if ($noteId) {
    Invoke-ApiTest -Method "DELETE" -Endpoint "/api/notes/$noteId" -TestName "Delete Note"
}

# Test 8: Validation test - empty content
$invalidNote = @{
    content = ""
} | ConvertTo-Json

Invoke-ApiTest -Method "POST" -Endpoint "/api/notes" -Body $invalidNote -TestName "Create Note with Empty Content (Should Fail)"

# ============================================================================
# TEST SECTION 2: REMINDERS API
# ============================================================================

Write-Host "`n`n╔═══════════════════════════════════════════════════════════╗" -ForegroundColor Magenta
Write-Host "║                REMINDERS API TESTS                        ║" -ForegroundColor Magenta
Write-Host "╚═══════════════════════════════════════════════════════════╝" -ForegroundColor Magenta

# Test 9: List reminders (empty)
Invoke-ApiTest -Method "GET" -Endpoint "/api/reminders" -TestName "List Reminders (Empty)"

# Test 10: Create reminder
$futureTime = (Get-Date).AddHours(2).ToString("o")
$reminderBody = @{
    message = "Test reminder: Call Mom"
    triggerAt = $futureTime
} | ConvertTo-Json

$createdReminder = Invoke-ApiTest -Method "POST" -Endpoint "/api/reminders" -Body $reminderBody -TestName "Create Reminder"
$reminderId = $createdReminder.reminder.id

# Test 11: Create another reminder
$futureTime2 = (Get-Date).AddHours(4).ToString("o")
$reminder2Body = @{
    message = "Test reminder 2: Check oven"
    triggerAt = $futureTime2
} | ConvertTo-Json

Invoke-ApiTest -Method "POST" -Endpoint "/api/reminders" -Body $reminder2Body -TestName "Create Second Reminder"

# Test 12: List reminders (with data)
Invoke-ApiTest -Method "GET" -Endpoint "/api/reminders" -TestName "List Reminders (With Data)"

# Test 13: Cancel reminder
if ($reminderId) {
    Invoke-ApiTest -Method "DELETE" -Endpoint "/api/reminders/$reminderId" -TestName "Cancel Reminder"
}

# Test 14: Validation - missing triggerAt
$invalidReminder = @{
    message = "Test reminder"
} | ConvertTo-Json

Invoke-ApiTest -Method "POST" -Endpoint "/api/reminders" -Body $invalidReminder -TestName "Create Reminder without TriggerAt (Should Fail)"

# Test 15: Validation - invalid timestamp
$invalidTimeReminder = @{
    message = "Test reminder"
    triggerAt = "invalid-timestamp"
} | ConvertTo-Json

Invoke-ApiTest -Method "POST" -Endpoint "/api/reminders" -Body $invalidTimeReminder -TestName "Create Reminder with Invalid Timestamp (Should Fail)"

# ============================================================================
# TEST SECTION 3: ALARMS API
# ============================================================================

Write-Host "`n`n╔═══════════════════════════════════════════════════════════╗" -ForegroundColor Magenta
Write-Host "║                  ALARMS API TESTS                         ║" -ForegroundColor Magenta
Write-Host "╚═══════════════════════════════════════════════════════════╝" -ForegroundColor Magenta

# Test 16: List alarms (empty)
Invoke-ApiTest -Method "GET" -Endpoint "/api/alarms" -TestName "List Alarms (Empty)"

# Test 17: Create time alarm
$timeAlarmBody = @{
    name = "Morning alarm"
    type = "time"
    triggerTime = "07:00"
    recurring = $false
} | ConvertTo-Json

$createdAlarm = Invoke-ApiTest -Method "POST" -Endpoint "/api/alarms" -Body $timeAlarmBody -TestName "Create Time Alarm"
$alarmId = $createdAlarm.alarm.id

# Test 18: Create recurring alarm
$recurringAlarmBody = @{
    name = "Weekday alarm"
    type = "time"
    triggerTime = "06:30"
    recurring = $true
    recurrencePattern = "weekdays"
} | ConvertTo-Json

Invoke-ApiTest -Method "POST" -Endpoint "/api/alarms" -Body $recurringAlarmBody -TestName "Create Recurring Alarm"

# Test 19: Create motion alarm
$motionAlarmBody = @{
    name = "Backyard security"
    type = "motion"
    location = "backyard"
} | ConvertTo-Json

Invoke-ApiTest -Method "POST" -Endpoint "/api/alarms" -Body $motionAlarmBody -TestName "Create Motion Alarm"

# Test 20: Create motion alarm with cameraId
$motionAlarmBody2 = @{
    name = "Front door security"
    type = "motion"
    cameraId = "camera-123"
    location = "Front Door"
} | ConvertTo-Json

Invoke-ApiTest -Method "POST" -Endpoint "/api/alarms" -Body $motionAlarmBody2 -TestName "Create Motion Alarm with CameraId"

# Test 21: List alarms (with data)
Invoke-ApiTest -Method "GET" -Endpoint "/api/alarms" -TestName "List Alarms (With Data)"

# Test 22: Toggle alarm
if ($alarmId) {
    Invoke-ApiTest -Method "PUT" -Endpoint "/api/alarms/$alarmId/toggle" -TestName "Toggle Alarm (Disable)"
}

# Test 23: Toggle again
if ($alarmId) {
    Invoke-ApiTest -Method "PUT" -Endpoint "/api/alarms/$alarmId/toggle" -TestName "Toggle Alarm (Re-enable)"
}

# Test 24: Delete alarm
if ($alarmId) {
    Invoke-ApiTest -Method "DELETE" -Endpoint "/api/alarms/$alarmId" -TestName "Delete Alarm"
}

# Test 25: Validation - time alarm without triggerTime
$invalidTimeAlarm = @{
    name = "Invalid alarm"
    type = "time"
} | ConvertTo-Json

Invoke-ApiTest -Method "POST" -Endpoint "/api/alarms" -Body $invalidTimeAlarm -TestName "Create Time Alarm without TriggerTime (Should Fail)"

# Test 26: Validation - motion alarm without location
$invalidMotionAlarm = @{
    name = "Invalid motion alarm"
    type = "motion"
} | ConvertTo-Json

Invoke-ApiTest -Method "POST" -Endpoint "/api/alarms" -Body $invalidMotionAlarm -TestName "Create Motion Alarm without Location (Should Fail)"

# ============================================================================
# TEST SECTION 4: WEATHER API
# ============================================================================

Write-Host "`n`n╔═══════════════════════════════════════════════════════════╗" -ForegroundColor Magenta
Write-Host "║                 WEATHER API TESTS                         ║" -ForegroundColor Magenta
Write-Host "╚═══════════════════════════════════════════════════════════╝" -ForegroundColor Magenta

# Test 27: Query weather (will fail if no API key)
$weatherBody = @{
    location = "New York,US"
} | ConvertTo-Json

Invoke-ApiTest -Method "POST" -Endpoint "/api/integrations/weather/query" -Body $weatherBody -TestName "Query Weather (New York)"

# Test 28: Query weather for another city
$weatherBody2 = @{
    location = "Miami,US"
} | ConvertTo-Json

Invoke-ApiTest -Method "POST" -Endpoint "/api/integrations/weather/query" -Body $weatherBody2 -TestName "Query Weather (Miami)"

# ============================================================================
# SUMMARY
# ============================================================================

Write-Host "`n`n╔═══════════════════════════════════════════════════════════╗" -ForegroundColor Magenta
Write-Host "║                   TEST SUMMARY                            ║" -ForegroundColor Magenta
Write-Host "╚═══════════════════════════════════════════════════════════╝" -ForegroundColor Magenta

Write-Host "`nTesting completed!" -ForegroundColor Green
Write-Host "`nNotes:" -ForegroundColor Yellow
Write-Host "- If weather tests failed, set OPENWEATHER_API_KEY environment variable" -ForegroundColor Gray
Write-Host "- Check server logs for detailed error information" -ForegroundColor Gray
Write-Host "- Review data files in apps/server/data/ to verify persistence" -ForegroundColor Gray
Write-Host "`nData files locations:" -ForegroundColor Yellow
Write-Host "- Notes: apps/server/data/notes.json" -ForegroundColor Gray
Write-Host "- Reminders: apps/server/data/reminders.json" -ForegroundColor Gray
Write-Host "- Alarms: apps/server/data/alarms.json" -ForegroundColor Gray
