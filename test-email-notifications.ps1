# Email Notification System - Automated Backend Test Script
# Tests all backend API endpoints and verifies system functionality

$ErrorActionPreference = "Continue"
$baseUrl = "http://localhost:3001"
$apiBaseUrl = "http://localhost:3001/api"

Write-Host "`n============================================" -ForegroundColor Cyan
Write-Host "  EMAIL NOTIFICATION SYSTEM - BACKEND TEST" -ForegroundColor Cyan
Write-Host "============================================`n" -ForegroundColor Cyan

$passed = 0
$failed = 0
$testResults = @()

function Test-Endpoint {
    param(
        [string]$Name,
        [string]$Url,
        [string]$Method = "GET",
        [string]$Body = $null,
        [string]$ExpectedStatus = "200"
    )
    
    Write-Host "Testing: $Name" -ForegroundColor Yellow
    Write-Host "  URL: $Url" -ForegroundColor Gray
    Write-Host "  Method: $Method" -ForegroundColor Gray
    
    try {
        $headers = @{
            "Content-Type" = "application/json"
        }
        
        $params = @{
            Uri = $Url
            Method = $Method
            Headers = $headers
            TimeoutSec = 30
        }
        
        if ($Body) {
            $params.Body = $Body
            Write-Host "  Body: $Body" -ForegroundColor Gray
        }
        
        $response = Invoke-WebRequest @params -UseBasicParsing
        $statusCode = $response.StatusCode
        $content = $response.Content | ConvertFrom-Json
        
        if ($statusCode -eq $ExpectedStatus) {
            Write-Host "  ✅ PASSED - Status: $statusCode" -ForegroundColor Green
            Write-Host "  Response: $($response.Content.Substring(0, [Math]::Min(200, $response.Content.Length)))..." -ForegroundColor DarkGray
            $script:passed++
            return @{
                Test = $Name
                Status = "PASSED"
                StatusCode = $statusCode
                Response = $content
            }
        } else {
            Write-Host "  ❌ FAILED - Expected: $ExpectedStatus, Got: $statusCode" -ForegroundColor Red
            $script:failed++
            return @{
                Test = $Name
                Status = "FAILED"
                StatusCode = $statusCode
                Error = "Unexpected status code"
            }
        }
    }
    catch {
        Write-Host "  ❌ FAILED - Error: $($_.Exception.Message)" -ForegroundColor Red
        $script:failed++
        return @{
            Test = $Name
            Status = "FAILED"
            Error = $_.Exception.Message
        }
    }
    
    Write-Host ""
}

# Wait for server to be ready
Write-Host "🔍 Checking if server is running..." -ForegroundColor Cyan
try {
    $response = Invoke-WebRequest -Uri "$baseUrl/config" -TimeoutSec 5 -UseBasicParsing
    Write-Host "✅ Server is running on port 3001`n" -ForegroundColor Green
}
catch {
    Write-Host "❌ Server is not running on port 3001!" -ForegroundColor Red
    Write-Host "Please start the server with: npm run dev`n" -ForegroundColor Yellow
    exit 1
}

Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  TEST 1: Email Notification Status" -ForegroundColor Cyan
Write-Host "============================================`n" -ForegroundColor Cyan

$result = Test-Endpoint `
    -Name "Get Email Notification Status" `
    -Url "$apiBaseUrl/email-notifications/status" `
    -Method "GET"

$testResults += $result

if ($result.Status -eq "PASSED" -and $result.Response) {
    Write-Host "📊 Status Details:" -ForegroundColor Cyan
    Write-Host "  Initialized: $($result.Response.initialized)" -ForegroundColor $(if ($result.Response.initialized) { "Green" } else { "Red" })
    
    if ($result.Response.initialized) {
        Write-Host "  Enabled: $($result.Response.config.enabled)" -ForegroundColor $(if ($result.Response.config.enabled) { "Green" } else { "Yellow" })
        Write-Host "  Check Interval: $($result.Response.config.checkIntervalMinutes) minutes" -ForegroundColor Gray
        Write-Host "  Total Checks: $($result.Response.state.checkCount)" -ForegroundColor Gray
        Write-Host "  Last Error: $($result.Response.state.lastError)" -ForegroundColor $(if ($result.Response.state.lastError) { "Red" } else { "Green" })
    } else {
        Write-Host "  ⚠️  Email notification system not initialized" -ForegroundColor Yellow
        Write-Host "  ⚠️  Gmail OAuth may not be configured" -ForegroundColor Yellow
    }
}

Write-Host ""

Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  TEST 2: Manual Email Check Trigger" -ForegroundColor Cyan
Write-Host "============================================`n" -ForegroundColor Cyan

$result = Test-Endpoint `
    -Name "Trigger Manual Email Check" `
    -Url "$apiBaseUrl/email-notifications/trigger" `
    -Method "POST"

$testResults += $result

if ($result.Status -eq "PASSED") {
    Write-Host "⏳ Waiting 3 seconds for check to complete..." -ForegroundColor Cyan
    Start-Sleep -Seconds 3
    
    # Re-check status to see if check count incremented
    $statusAfter = Test-Endpoint `
        -Name "Verify Check Count Incremented" `
        -Url "$apiBaseUrl/email-notifications/status" `
        -Method "GET"
    
    $testResults += $statusAfter
}

Write-Host ""

Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  TEST 3: Configuration Update" -ForegroundColor Cyan
Write-Host "============================================`n" -ForegroundColor Cyan

$configBody = @{
    enabled = $true
    checkIntervalMinutes = 10
} | ConvertTo-Json

$result = Test-Endpoint `
    -Name "Update Email Notification Config" `
    -Url "$apiBaseUrl/email-notifications/config" `
    -Method "POST" `
    -Body $configBody

$testResults += $result

if ($result.Status -eq "PASSED") {
    Write-Host "⏳ Verifying config was updated..." -ForegroundColor Cyan
    $statusAfter = Test-Endpoint `
        -Name "Verify Config Applied" `
        -Url "$apiBaseUrl/email-notifications/status" `
        -Method "GET"
    
    if ($statusAfter.Response.config.checkIntervalMinutes -eq 10) {
        Write-Host "  ✅ Configuration successfully updated to 10 minutes" -ForegroundColor Green
    } else {
        Write-Host "  ⚠️  Configuration may not have been applied" -ForegroundColor Yellow
    }
    
    # Reset to 5 minutes
    $resetBody = @{ enabled = $true; checkIntervalMinutes = 5 } | ConvertTo-Json
    Test-Endpoint `
        -Name "Reset Config to 5 Minutes" `
        -Url "$apiBaseUrl/email-notifications/config" `
        -Method "POST" `
        -Body $resetBody | Out-Null
}

Write-Host ""

Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  TEST 4: Gmail Inbox Endpoint" -ForegroundColor Cyan
Write-Host "============================================`n" -ForegroundColor Cyan

$result = Test-Endpoint `
    -Name "Fetch Gmail Inbox (5 messages)" `
    -Url "$apiBaseUrl/integrations/gmail/inbox?maxResults=5" `
    -Method "GET"

$testResults += $result

if ($result.Status -eq "PASSED" -and $result.Response) {
    if ($result.Response.ok) {
        Write-Host "📧 Inbox Details:" -ForegroundColor Cyan
        Write-Host "  Messages Retrieved: $($result.Response.messages.Count)" -ForegroundColor Green
        Write-Host "  Has Next Page: $($result.Response.nextPageToken -ne $null)" -ForegroundColor Gray
        
        if ($result.Response.messages.Count -gt 0) {
            Write-Host "  Latest Email:" -ForegroundColor Cyan
            $latest = $result.Response.messages[0]
            Write-Host "    From: $($latest.from)" -ForegroundColor Gray
            Write-Host "    Subject: $($latest.subject)" -ForegroundColor Gray
        }
    } else {
        Write-Host "  ⚠️  Gmail not configured: $($result.Response.error)" -ForegroundColor Yellow
    }
}

Write-Host ""

Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  TEST 5: Google Calendar Events" -ForegroundColor Cyan
Write-Host "============================================`n" -ForegroundColor Cyan

$result = Test-Endpoint `
    -Name "Fetch Calendar Events (10 events)" `
    -Url "$apiBaseUrl/integrations/google-calendar/sync-events?limit=10" `
    -Method "GET"

$testResults += $result

if ($result.Status -eq "PASSED" -and $result.Response) {
    if ($result.Response.ok) {
        Write-Host "📅 Calendar Details:" -ForegroundColor Cyan
        Write-Host "  Events Retrieved: $($result.Response.events.Count)" -ForegroundColor Green
        
        if ($result.Response.events.Count -gt 0) {
            Write-Host "  Upcoming Event:" -ForegroundColor Cyan
            $next = $result.Response.events[0]
            Write-Host "    Title: $($next.summary)" -ForegroundColor Gray
            Write-Host "    Start: $($next.start)" -ForegroundColor Gray
            if ($next.location) {
                Write-Host "    Location: $($next.location)" -ForegroundColor Gray
            }
        }
    } else {
        Write-Host "  ⚠️  Calendar not configured: $($result.Response.error)" -ForegroundColor Yellow
    }
}

Write-Host ""

Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  TEST 6: Notification History" -ForegroundColor Cyan
Write-Host "============================================`n" -ForegroundColor Cyan

$result = Test-Endpoint `
    -Name "Get Notification History" `
    -Url "$apiBaseUrl/notifications/history?type=email_notification&limit=10" `
    -Method "GET"

$testResults += $result

if ($result.Status -eq "PASSED" -and $result.Response) {
    Write-Host "📬 Notification History:" -ForegroundColor Cyan
    Write-Host "  Total Notifications: $($result.Response.total)" -ForegroundColor Green
    Write-Host "  Returned: $($result.Response.notifications.Count)" -ForegroundColor Gray
}

Write-Host ""

Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  TEST 7: Schedule Test Notification" -ForegroundColor Cyan
Write-Host "============================================`n" -ForegroundColor Cyan

$notificationBody = @{
    type = "email_notification"
    payload = @{
        messageId = "test_$(Get-Date -Format 'yyyyMMddHHmmss')"
        threadId = "thread_test"
        subject = "Automated Test Notification"
        from = "test-script@jarvis.local"
        date = (Get-Date).ToString("o")
        snippet = "This is an automated test notification from the PowerShell test script."
    }
    triggerAt = (Get-Date).ToString("o")
} | ConvertTo-Json -Depth 10

$result = Test-Endpoint `
    -Name "Schedule Test Email Notification" `
    -Url "$apiBaseUrl/notifications/schedule" `
    -Method "POST" `
    -Body $notificationBody

$testResults += $result

if ($result.Status -eq "PASSED" -and $result.Response.eventId) {
    Write-Host "  📬 Notification scheduled with ID: $($result.Response.eventId)" -ForegroundColor Green
    Write-Host "  💡 Check the test dashboard to see if it appears!" -ForegroundColor Cyan
}

Write-Host ""

# Summary
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  TEST SUMMARY" -ForegroundColor Cyan
Write-Host "============================================`n" -ForegroundColor Cyan

Write-Host "Total Tests: $($passed + $failed)" -ForegroundColor White
Write-Host "Passed: $passed" -ForegroundColor Green
Write-Host "Failed: $failed" -ForegroundColor Red

if ($failed -eq 0) {
    Write-Host "`n🎉 ALL TESTS PASSED!" -ForegroundColor Green
    Write-Host "✅ Backend is functioning correctly" -ForegroundColor Green
    Write-Host "`n📝 Next Steps:" -ForegroundColor Cyan
    Write-Host "  1. Open http://localhost:3000/test-email-notifications" -ForegroundColor White
    Write-Host "  2. Follow the manual UI testing guide" -ForegroundColor White
    Write-Host "  3. Verify toast notifications appear" -ForegroundColor White
} else {
    Write-Host "`n⚠️  SOME TESTS FAILED" -ForegroundColor Yellow
    Write-Host "📋 Failed Tests:" -ForegroundColor Red
    foreach ($test in $testResults | Where-Object { $_.Status -eq "FAILED" }) {
        Write-Host "  - $($test.Test): $($test.Error)" -ForegroundColor Red
    }
    Write-Host "`n💡 Check server logs for more details" -ForegroundColor Cyan
}

Write-Host "`n============================================`n" -ForegroundColor Cyan

# Export results to JSON
$resultsFile = "test-results-$(Get-Date -Format 'yyyyMMdd-HHmmss').json"
$testResults | ConvertTo-Json -Depth 10 | Out-File $resultsFile
Write-Host "📄 Test results saved to: $resultsFile" -ForegroundColor Cyan

exit $failed
