# Agent D API Testing Script - Simplified Version
# Tests core features: notes, reminders, and alarms

$baseUrl = "https://localhost:1234"

Write-Host "`n╔═══════════════════════════════════════════════════════════╗" -ForegroundColor Magenta
Write-Host "║           Agent D API Testing Suite                       ║" -ForegroundColor Magenta
Write-Host "╚═══════════════════════════════════════════════════════════╝`n" -ForegroundColor Magenta

# Test 1: Notes - List (Empty)
Write-Host "`n========== TEST 1: List Notes (Empty) ==========" -ForegroundColor Cyan
try {
    $result = Invoke-RestMethod -Uri "$baseUrl/api/notes" -Method GET -SkipCertificateCheck
    Write-Host "✓ SUCCESS" -ForegroundColor Green
    $result | ConvertTo-Json
} catch {
    Write-Host "✗ FAILED: $($_.Exception.Message)" -ForegroundColor Red
}

# Test 2: Notes - Create
Write-Host "`n========== TEST 2: Create Note ==========" -ForegroundColor Cyan
$noteBody = @{
    content = "Test note: Buy milk and eggs"
    tags = @("shopping")
} | ConvertTo-Json

try {
    $createdNote = Invoke-RestMethod -Uri "$baseUrl/api/notes" -Method POST -Body $noteBody -ContentType "application/json" -SkipCertificateCheck
    Write-Host "✓ SUCCESS" -ForegroundColor Green
    $createdNote | ConvertTo-Json
    $global:noteId = $createdNote.note.id
    Write-Host "Note ID: $global:noteId" -ForegroundColor Yellow
} catch {
    Write-Host "✗ FAILED: $($_.Exception.Message)" -ForegroundColor Red
}

# Test 3: Notes - List (With Data)
Write-Host "`n========== TEST 3: List Notes (With Data) ==========" -ForegroundColor Cyan
try {
    $result = Invoke-RestMethod -Uri "$baseUrl/api/notes" -Method GET -SkipCertificateCheck
    Write-Host "✓ SUCCESS - Found $($result.notes.Count) note(s)" -ForegroundColor Green
    $result | ConvertTo-Json
} catch {
    Write-Host "✗ FAILED: $($_.Exception.Message)" -ForegroundColor Red
}

# Test 4: Notes - Update
if ($global:noteId) {
    Write-Host "`n========== TEST 4: Update Note ==========" -ForegroundColor Cyan
    $updateBody = @{
        content = "Updated: Buy milk, eggs, and bread"
    } | ConvertTo-Json
    
    try {
        $result = Invoke-RestMethod -Uri "$baseUrl/api/notes/$global:noteId" -Method PUT -Body $updateBody -ContentType "application/json" -SkipCertificateCheck
        Write-Host "✓ SUCCESS" -ForegroundColor Green
        $result | ConvertTo-Json
    } catch {
        Write-Host "✗ FAILED: $($_.Exception.Message)" -ForegroundColor Red
    }
}

# Test 5: Notes - Delete
if ($global:noteId) {
    Write-Host "`n========== TEST 5: Delete Note ==========" -ForegroundColor Cyan
    try {
        $result = Invoke-RestMethod -Uri "$baseUrl/api/notes/$global:noteId" -Method DELETE -SkipCertificateCheck
        Write-Host "✓ SUCCESS" -ForegroundColor Green
        $result | ConvertTo-Json
    } catch {
        Write-Host "✗ FAILED: $($_.Exception.Message)" -ForegroundColor Red
    }
}

# Test 6: Reminders - List (Empty)
Write-Host "`n========== TEST 6: List Reminders (Empty) ==========" -ForegroundColor Cyan
try {
    $result = Invoke-RestMethod -Uri "$baseUrl/api/reminders" -Method GET -SkipCertificateCheck
    Write-Host "✓ SUCCESS" -ForegroundColor Green
    $result | ConvertTo-Json
} catch {
    Write-Host "✗ FAILED: $($_.Exception.Message)" -ForegroundColor Red
}

# Test 7: Reminders - Create
Write-Host "`n========== TEST 7: Create Reminder ==========" -ForegroundColor Cyan
$futureTime = (Get-Date).AddHours(2).ToString("o")
$reminderBody = @{
    message = "Test reminder: Call Mom"
    triggerAt = $futureTime
} | ConvertTo-Json

try {
    $createdReminder = Invoke-RestMethod -Uri "$baseUrl/api/reminders" -Method POST -Body $reminderBody -ContentType "application/json" -SkipCertificateCheck
    Write-Host "✓ SUCCESS" -ForegroundColor Green
    $createdReminder | ConvertTo-Json
    $global:reminderId = $createdReminder.reminder.id
    Write-Host "Reminder ID: $global:reminderId" -ForegroundColor Yellow
} catch {
    Write-Host "✗ FAILED: $($_.Exception.Message)" -ForegroundColor Red
}

# Test 8: Reminders - List (With Data)
Write-Host "`n========== TEST 8: List Reminders (With Data) ==========" -ForegroundColor Cyan
try {
    $result = Invoke-RestMethod -Uri "$baseUrl/api/reminders" -Method GET -SkipCertificateCheck
    Write-Host "✓ SUCCESS - Found $($result.reminders.Count) reminder(s)" -ForegroundColor Green
    $result | ConvertTo-Json
} catch {
    Write-Host "✗ FAILED: $($_.Exception.Message)" -ForegroundColor Red
}

# Test 9: Reminders - Delete
if ($global:reminderId) {
    Write-Host "`n========== TEST 9: Cancel Reminder ==========" -ForegroundColor Cyan
    try {
        $result = Invoke-RestMethod -Uri "$baseUrl/api/reminders/$global:reminderId" -Method DELETE -SkipCertificateCheck
        Write-Host "✓ SUCCESS" -ForegroundColor Green
        $result | ConvertTo-Json
    } catch {
        Write-Host "✗ FAILED: $($_.Exception.Message)" -ForegroundColor Red
    }
}

# Test 10: Alarms - List (Empty)
Write-Host "`n========== TEST 10: List Alarms (Empty) ==========" -ForegroundColor Cyan
try {
    $result = Invoke-RestMethod -Uri "$baseUrl/api/alarms" -Method GET -SkipCertificateCheck
    Write-Host "✓ SUCCESS" -ForegroundColor Green
    $result | ConvertTo-Json
} catch {
    Write-Host "✗ FAILED: $($_.Exception.Message)" -ForegroundColor Red
}

# Test 11: Alarms - Create Time Alarm
Write-Host "`n========== TEST 11: Create Time Alarm ==========" -ForegroundColor Cyan
$alarmBody = @{
    name = "Morning alarm"
    type = "time"
    triggerTime = "07:00"
    recurring = $false
} | ConvertTo-Json

try {
    $createdAlarm = Invoke-RestMethod -Uri "$baseUrl/api/alarms" -Method POST -Body $alarmBody -ContentType "application/json" -SkipCertificateCheck
    Write-Host "✓ SUCCESS" -ForegroundColor Green
    $createdAlarm | ConvertTo-Json
    $global:alarmId = $createdAlarm.alarm.id
    Write-Host "Alarm ID: $global:alarmId" -ForegroundColor Yellow
} catch {
    Write-Host "✗ FAILED: $($_.Exception.Message)" -ForegroundColor Red
}

# Test 12: Alarms - Create Motion Alarm
Write-Host "`n========== TEST 12: Create Motion Alarm ==========" -ForegroundColor Cyan
$motionAlarmBody = @{
    name = "Backyard security"
    type = "motion"
    location = "backyard"
} | ConvertTo-Json

try {
    $result = Invoke-RestMethod -Uri "$baseUrl/api/alarms" -Method POST -Body $motionAlarmBody -ContentType "application/json" -SkipCertificateCheck
    Write-Host "✓ SUCCESS" -ForegroundColor Green
    $result | ConvertTo-Json
} catch {
    Write-Host "✗ FAILED: $($_.Exception.Message)" -ForegroundColor Red
}

# Test 13: Alarms - List (With Data)
Write-Host "`n========== TEST 13: List Alarms (With Data) ==========" -ForegroundColor Cyan
try {
    $result = Invoke-RestMethod -Uri "$baseUrl/api/alarms" -Method GET -SkipCertificateCheck
    Write-Host "✓ SUCCESS - Found $($result.alarms.Count) alarm(s)" -ForegroundColor Green
    $result | ConvertTo-Json
} catch {
    Write-Host "✗ FAILED: $($_.Exception.Message)" -ForegroundColor Red
}

# Test 14: Alarms - Toggle
if ($global:alarmId) {
    Write-Host "`n========== TEST 14: Toggle Alarm ==========" -ForegroundColor Cyan
    try {
        $result = Invoke-RestMethod -Uri "$baseUrl/api/alarms/$global:alarmId/toggle" -Method PUT -SkipCertificateCheck
        Write-Host "✓ SUCCESS - Alarm is now: $($result.alarm.enabled)" -ForegroundColor Green
        $result | ConvertTo-Json
    } catch {
        Write-Host "✗ FAILED: $($_.Exception.Message)" -ForegroundColor Red
    }
}

# Test 15: Alarms - Delete
if ($global:alarmId) {
    Write-Host "`n========== TEST 15: Delete Alarm ==========" -ForegroundColor Cyan
    try {
        $result = Invoke-RestMethod -Uri "$baseUrl/api/alarms/$global:alarmId" -Method DELETE -SkipCertificateCheck
        Write-Host "✓ SUCCESS" -ForegroundColor Green
        $result | ConvertTo-Json
    } catch {
        Write-Host "✗ FAILED: $($_.Exception.Message)" -ForegroundColor Red
    }
}

Write-Host "`n`n╔═══════════════════════════════════════════════════════════╗" -ForegroundColor Magenta
Write-Host "║                   TEST COMPLETE                           ║" -ForegroundColor Magenta
Write-Host "╚═══════════════════════════════════════════════════════════╝" -ForegroundColor Magenta

Write-Host "`nAll tests completed! Review the results above." -ForegroundColor Green
Write-Host "Data files are in: C:\Users\yosiw\Desktop\Jarvis-main\apps\server\data\" -ForegroundColor Yellow
