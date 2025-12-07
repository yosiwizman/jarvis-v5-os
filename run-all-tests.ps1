# Jarvis Backend - Comprehensive Test Orchestrator
# Runs all automated tests and generates health report

param(
    [string]$ServerUrl = "https://localhost:1234",
    [switch]$SkipCertCheck = $true
)

$ErrorActionPreference = "Continue"

# Configure SSL bypass for PowerShell 5.1
if ($SkipCertCheck) {
    [System.Net.ServicePointManager]::ServerCertificateValidationCallback = {$true}
}

Write-Host "`n============================================" -ForegroundColor Cyan
Write-Host "  JARVIS BACKEND - AUTOMATED TEST SUITE" -ForegroundColor Cyan
Write-Host "============================================`n" -ForegroundColor Cyan

$script:TestResults = @()
$script:ApiResults = @()
$script:TotalPassed = 0
$script:TotalFailed = 0

# Test 1: Server Health Check
Write-Host "[1/8] Checking if server is running..." -ForegroundColor Yellow
try {
    $response = Invoke-RestMethod -Uri "$ServerUrl/config" -Method Get -TimeoutSec 5
    Write-Host "   SUCCESS - Server is responding" -ForegroundColor Green
    $script:TotalPassed++
    $serverRunning = $true
} catch {
    Write-Host "   FAILED - Server is not responding" -ForegroundColor Red
    Write-Host "   Error: $($_.Exception.Message)" -ForegroundColor Yellow
    Write-Host "`n   Please start the server in a separate terminal:" -ForegroundColor Yellow
    Write-Host "   > cd C:\Users\yosiw\Desktop\Jarvis-main" -ForegroundColor White
    Write-Host "   > npm start`n" -ForegroundColor White
    $script:TotalFailed++
    $serverRunning = $false
}

if (-not $serverRunning) {
    Write-Host "`nCannot proceed without server. Exiting.`n" -ForegroundColor Red
    exit 1
}

# Test 2: Core API Endpoints
Write-Host "`n[2/8] Testing core API endpoints..." -ForegroundColor Yellow

$endpoints = @(
    @{Path="/config"; Method="GET"; Name="Config"},
    @{Path="/settings"; Method="GET"; Name="Settings"},
    @{Path="/api/conversations"; Method="GET"; Name="List Conversations"},
    @{Path="/api/conversations/stats"; Method="GET"; Name="Conversation Stats"},
    @{Path="/api/actions"; Method="GET"; Name="List Actions"},
    @{Path="/api/actions/stats"; Method="GET"; Name="Action Stats"},
    @{Path="/api/notifications/history"; Method="GET"; Name="Notification History"},
    @{Path="/api/lockdown/status"; Method="GET"; Name="Lockdown Status"},
    @{Path="/api/3dprint/config"; Method="GET"; Name="3D Print Config"},
    @{Path="/system/metrics"; Method="GET"; Name="System Metrics"}
)

foreach ($endpoint in $endpoints) {
    try {
        $response = Invoke-RestMethod -Uri "$ServerUrl$($endpoint.Path)" -Method $endpoint.Method -TimeoutSec 5
        Write-Host "   $($endpoint.Name): SUCCESS (200)" -ForegroundColor Green
        $script:ApiResults += [PSCustomObject]@{
            Endpoint = $endpoint.Path
            Status = "SUCCESS"
            Code = 200
        }
        $script:TotalPassed++
    } catch {
        $statusCode = $_.Exception.Response.StatusCode.value__
        if ($statusCode -eq 404) {
            Write-Host "   $($endpoint.Name): NOT FOUND (404)" -ForegroundColor Yellow
        } else {
            Write-Host "   $($endpoint.Name): FAILED ($statusCode)" -ForegroundColor Red
        }
        $script:ApiResults += [PSCustomObject]@{
            Endpoint = $endpoint.Path
            Status = "FAILED"
            Code = $statusCode
        }
        $script:TotalFailed++
    }
}

# Test 3: Conversation API CRUD Operations
Write-Host "`n[3/8] Testing Conversation API (CRUD)..." -ForegroundColor Yellow

try {
    # Create
    $testConversation = @{
        source = "chat"
        messages = @(
            @{ role = "user"; content = "Test message" }
            @{ role = "assistant"; content = "Test response" }
        )
        metadata = @{ title = "Automated Test" }
        tags = @("test")
    } | ConvertTo-Json -Depth 10

    $created = Invoke-RestMethod -Uri "$ServerUrl/api/conversations/save" -Method Post -Body $testConversation -ContentType "application/json"
    $conversationId = $created.id
    Write-Host "   Create Conversation: SUCCESS (ID: $conversationId)" -ForegroundColor Green
    $script:TotalPassed++

    # Read
    $retrieved = Invoke-RestMethod -Uri "$ServerUrl/api/conversations/$conversationId" -Method Get
    Write-Host "   Read Conversation: SUCCESS" -ForegroundColor Green
    $script:TotalPassed++

    # Delete
    $deleted = Invoke-RestMethod -Uri "$ServerUrl/api/conversations/$conversationId" -Method Delete
    Write-Host "   Delete Conversation: SUCCESS" -ForegroundColor Green
    $script:TotalPassed++

} catch {
    Write-Host "   Conversation API Test: FAILED" -ForegroundColor Red
    Write-Host "   Error: $($_.Exception.Message)" -ForegroundColor Yellow
    $script:TotalFailed += 3
}

# Test 4: Action Tracking API
Write-Host "`n[4/8] Testing Action Tracking API..." -ForegroundColor Yellow

try {
    $testAction = @{
        type = "test_action"
        source = "automated_test"
        metadata = @{ test = $true }
    } | ConvertTo-Json -Depth 10

    $actionResult = Invoke-RestMethod -Uri "$ServerUrl/api/actions/record" -Method Post -Body $testAction -ContentType "application/json"
    Write-Host "   Record Action: SUCCESS (ID: $($actionResult.id))" -ForegroundColor Green
    $script:TotalPassed++
} catch {
    Write-Host "   Action API Test: FAILED" -ForegroundColor Red
    Write-Host "   Error: $($_.Exception.Message)" -ForegroundColor Yellow
    $script:TotalFailed++
}

# Test 5: Check Data Directories
Write-Host "`n[5/8] Verifying data storage..." -ForegroundColor Yellow

$dataDir = "C:\Users\yosiw\Desktop\Jarvis-main\data"
$conversationsDir = Join-Path $dataDir "conversations"
$actionsDir = Join-Path $dataDir "actions"
$logsDir = Join-Path $dataDir "logs"

$dirs = @(
    @{Path=$conversationsDir; Name="Conversations"},
    @{Path=$actionsDir; Name="Actions"},
    @{Path=$logsDir; Name="Logs"}
)

foreach ($dir in $dirs) {
    if (Test-Path $dir.Path) {
        $fileCount = (Get-ChildItem -Path $dir.Path -File).Count
        Write-Host "   $($dir.Name) Directory: EXISTS ($fileCount files)" -ForegroundColor Green
        $script:TotalPassed++
    } else {
        Write-Host "   $($dir.Name) Directory: MISSING" -ForegroundColor Red
        $script:TotalFailed++
    }
}

# Test 6: Check Server Logs for Errors
Write-Host "`n[6/8] Analyzing server logs..." -ForegroundColor Yellow

$logFiles = @(
    @{Path=Join-Path $logsDir "error.log"; Name="Error Log"},
    @{Path=Join-Path $logsDir "app.log"; Name="Application Log"}
)

$criticalErrors = @()

foreach ($logFile in $logFiles) {
    if (Test-Path $logFile.Path) {
        $content = Get-Content $logFile.Path -Tail 50 -ErrorAction SilentlyContinue
        if ($content) {
            $errorLines = $content | Where-Object { $_ -match "error|ERROR|exception|Exception|failed|FAILED" }
            if ($errorLines.Count -gt 0) {
                Write-Host "   $($logFile.Name): $($errorLines.Count) error(s) found" -ForegroundColor Yellow
                $criticalErrors += $errorLines | Select-Object -First 3
            } else {
                Write-Host "   $($logFile.Name): Clean" -ForegroundColor Green
            }
        }
    }
}

# Test 7: Run Memory & Logs Test Script (if test passes basic checks)
Write-Host "`n[7/8] Running test-memory-logs.ps1..." -ForegroundColor Yellow

if (Test-Path "test-memory-logs.ps1") {
    Write-Host "   Script found - execution skipped (encoding issues)" -ForegroundColor Yellow
    Write-Host "   Run manually: powershell -ExecutionPolicy Bypass -File test-memory-logs.ps1" -ForegroundColor Gray
} else {
    Write-Host "   Script not found" -ForegroundColor Red
}

# Test 8: System Integrations Status
Write-Host "`n[8/8] Checking integration status..." -ForegroundColor Yellow

try {
    $settings = Invoke-RestMethod -Uri "$ServerUrl/settings" -Method Get
    $integrations = $settings.integrations
    
    if ($integrations) {
        $enabledIntegrations = @()
        foreach ($key in $integrations.PSObject.Properties.Name) {
            if ($integrations.$key.enabled -eq $true) {
                $enabledIntegrations += $key
            }
        }
        
        if ($enabledIntegrations.Count -gt 0) {
            Write-Host "   Enabled Integrations: $($enabledIntegrations -join ', ')" -ForegroundColor Green
        } else {
            Write-Host "   No integrations enabled" -ForegroundColor Yellow
        }
    }
} catch {
    Write-Host "   Could not retrieve integration status" -ForegroundColor Yellow
}

# Generate Final Report
Write-Host "`n============================================" -ForegroundColor Cyan
Write-Host "  FINAL REPORT" -ForegroundColor Cyan
Write-Host "============================================`n" -ForegroundColor Cyan

Write-Host "Test Results:" -ForegroundColor White
Write-Host "  Passed: $script:TotalPassed" -ForegroundColor Green
Write-Host "  Failed: $script:TotalFailed" -ForegroundColor Red
Write-Host "  Total:  $($script:TotalPassed + $script:TotalFailed)" -ForegroundColor Cyan

$successRate = if (($script:TotalPassed + $script:TotalFailed) -gt 0) {
    [math]::Round(($script:TotalPassed / ($script:TotalPassed + $script:TotalFailed)) * 100, 2)
} else {
    0
}

Write-Host "  Success Rate: $successRate%" -ForegroundColor $(if ($successRate -ge 80) { "Green" } else { "Yellow" })

Write-Host "`nAPI Endpoint Status:" -ForegroundColor White
$successfulApis = ($script:ApiResults | Where-Object { $_.Status -eq "SUCCESS" }).Count
$failedApis = ($script:ApiResults | Where-Object { $_.Status -eq "FAILED" }).Count
Write-Host "  Successful: $successfulApis" -ForegroundColor Green
Write-Host "  Failed: $failedApis" -ForegroundColor Red

if ($criticalErrors.Count -gt 0) {
    Write-Host "`nCritical Log Errors (sample):" -ForegroundColor White
    $criticalErrors | ForEach-Object { Write-Host "  $_" -ForegroundColor Red }
}

Write-Host "`nSystem Status:" -ForegroundColor White
if ($script:TotalFailed -eq 0) {
    Write-Host "  SYSTEM READY FOR UI TESTING" -ForegroundColor Green -BackgroundColor DarkGreen
    exit 0
} else {
    Write-Host "  ISSUES NEED REVIEW" -ForegroundColor Yellow -BackgroundColor DarkYellow
    Write-Host "`n  Failed APIs/Tests require attention before UI testing" -ForegroundColor Yellow
    exit 1
}
