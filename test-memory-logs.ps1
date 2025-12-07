# Memory & Logs Backend API Testing Script
# Tests the conversation storage and action tracking APIs

param(
    [string]$ServerUrl = "https://localhost:3000",
    [switch]$SkipCertCheck = $true
)

Write-Host "`n🧪 Memory & Logs Backend API Testing" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

# Ignore SSL certificate errors for localhost testing
if ($SkipCertCheck) {
    [System.Net.ServicePointManager]::ServerCertificateValidationCallback = {$true}
    if ($PSVersionTable.PSVersion.Major -ge 6) {
        $PSDefaultParameterValues['Invoke-RestMethod:SkipCertificateCheck'] = $true
        $PSDefaultParameterValues['Invoke-WebRequest:SkipCertificateCheck'] = $true
    }
}

$script:PassedTests = 0
$script:FailedTests = 0
$script:TestResults = @()

function Test-Result {
    param(
        [string]$TestName,
        [bool]$Passed,
        [string]$Message = "",
        [object]$Data = $null
    )
    
    if ($Passed) {
        Write-Host "✅ PASS: $TestName" -ForegroundColor Green
        $script:PassedTests++
    } else {
        Write-Host "❌ FAIL: $TestName" -ForegroundColor Red
        if ($Message) {
            Write-Host "   Error: $Message" -ForegroundColor Yellow
        }
        $script:FailedTests++
    }
    
    $script:TestResults += [PSCustomObject]@{
        Test = $TestName
        Status = if ($Passed) { "PASS" } else { "FAIL" }
        Message = $Message
        Data = $Data
    }
}

# Test 1: Server Health Check
Write-Host "`n📡 Test 1: Server Health Check" -ForegroundColor Cyan
try {
    $response = Invoke-RestMethod -Uri "$ServerUrl/config" -Method Get -TimeoutSec 5
    Test-Result "Server is responding" $true "Config endpoint accessible"
} catch {
    Test-Result "Server is responding" $false $_.Exception.Message
    Write-Host "`n⚠️  Server is not running or not accessible at $ServerUrl" -ForegroundColor Yellow
    Write-Host "Please start the server with: npm run dev:server`n" -ForegroundColor Yellow
    exit 1
}

# Test 2: Save a Conversation
Write-Host "`n📝 Test 2: Conversation Storage API" -ForegroundColor Cyan

$testConversation = @{
    source = "chat"
    messages = @(
        @{ role = "user"; content = "Hello, this is a test message" }
        @{ role = "assistant"; content = "Hello! I'm J.A.R.V.I.S. How can I help you?" }
        @{ role = "user"; content = "What's the weather like?" }
        @{ role = "assistant"; content = "I'd need your location to check the weather." }
    )
    metadata = @{
        title = "Test Conversation - Automated"
        model = "gpt-5"
        messageCount = 4
    }
    tags = @("test", "automated")
}

$savedConversationId = $null

try {
    $body = $testConversation | ConvertTo-Json -Depth 10
    $response = Invoke-RestMethod -Uri "$ServerUrl/api/conversations/save" -Method Post -Body $body -ContentType "application/json"
    
    if ($response.id) {
        $savedConversationId = $response.id
        Test-Result "Save conversation" $true "Conversation ID: $savedConversationId"
    } else {
        Test-Result "Save conversation" $false "No conversation ID returned"
    }
} catch {
    Test-Result "Save conversation" $false $_.Exception.Message
}

# Test 3: List Conversations
Write-Host "`n📋 Test 3: List Conversations" -ForegroundColor Cyan

try {
    $response = Invoke-RestMethod -Uri "$ServerUrl/api/conversations?limit=10" -Method Get
    
    if ($response.conversations) {
        $count = $response.conversations.Count
        Test-Result "List conversations" $true "Found $count conversation(s)"
        
        # Verify our test conversation is in the list
        if ($savedConversationId) {
            $found = $response.conversations | Where-Object { $_.id -eq $savedConversationId }
            Test-Result "Find saved conversation in list" ($null -ne $found) 
        }
    } else {
        Test-Result "List conversations" $false "No conversations array in response"
    }
} catch {
    Test-Result "List conversations" $false $_.Exception.Message
}

# Test 4: Get Specific Conversation
if ($savedConversationId) {
    Write-Host "`n🔍 Test 4: Get Conversation by ID" -ForegroundColor Cyan
    
    try {
        $response = Invoke-RestMethod -Uri "$ServerUrl/api/conversations/$savedConversationId" -Method Get
        
        if ($response.id -eq $savedConversationId) {
            Test-Result "Get conversation by ID" $true
            Test-Result "Verify messages intact" ($response.messages.Count -eq 4)
            Test-Result "Verify metadata intact" ($response.metadata.title -eq "Test Conversation - Automated")
        } else {
            Test-Result "Get conversation by ID" $false "ID mismatch"
        }
    } catch {
        Test-Result "Get conversation by ID" $false $_.Exception.Message
    }
}

# Test 5: Search Conversations
Write-Host "`n🔎 Test 5: Search Conversations" -ForegroundColor Cyan

try {
    $response = Invoke-RestMethod -Uri "$ServerUrl/api/conversations?search=test&limit=10" -Method Get
    
    if ($response.conversations) {
        $count = $response.conversations.Count
        Test-Result "Search conversations" $true "Found $count matching conversation(s)"
    } else {
        Test-Result "Search conversations" $false "No results"
    }
} catch {
    Test-Result "Search conversations" $false $_.Exception.Message
}

# Test 6: Get Conversation Stats
Write-Host "`n📊 Test 6: Conversation Statistics" -ForegroundColor Cyan

try {
    $response = Invoke-RestMethod -Uri "$ServerUrl/api/conversations/stats" -Method Get
    
    if ($response.total -ge 0) {
        Test-Result "Get conversation stats" $true "Total: $($response.total), By source: $($response.bySource | ConvertTo-Json -Compress)"
    } else {
        Test-Result "Get conversation stats" $false "Invalid stats format"
    }
} catch {
    Test-Result "Get conversation stats" $false $_.Exception.Message
}

# Test 7: Record Actions
Write-Host "`n⚡ Test 7: Action Tracking API" -ForegroundColor Cyan

$testActions = @(
    @{
        type = "message_sent"
        source = "user"
        metadata = @{
            messageId = "test-msg-001"
            contentLength = 42
            source = "automated-test"
        }
    },
    @{
        type = "image_generated"
        source = "user"
        metadata = @{
            prompt = "A sunset over mountains"
            model = "dall-e-3"
            size = "1024x1024"
        }
    },
    @{
        type = "3d_model_generated"
        source = "user"
        metadata = @{
            prompt = "A futuristic hammer"
            jobId = "test-job-123"
        }
    }
)

$savedActionIds = @()

foreach ($action in $testActions) {
    try {
        $body = $action | ConvertTo-Json -Depth 10
        $response = Invoke-RestMethod -Uri "$ServerUrl/api/actions/record" -Method Post -Body $body -ContentType "application/json"
        
        if ($response.id) {
            $savedActionIds += $response.id
            Test-Result "Record action: $($action.type)" $true "Action ID: $($response.id)"
        } else {
            Test-Result "Record action: $($action.type)" $false "No action ID returned"
        }
    } catch {
        Test-Result "Record action: $($action.type)" $false $_.Exception.Message
    }
}

# Test 8: List Actions
Write-Host "`n📜 Test 8: List Actions" -ForegroundColor Cyan

try {
    $response = Invoke-RestMethod -Uri "$ServerUrl/api/actions?limit=50" -Method Get
    
    if ($response.actions) {
        $count = $response.actions.Count
        Test-Result "List actions" $true "Found $count action(s)"
    } else {
        Test-Result "List actions" $false "No actions array in response"
    }
} catch {
    Test-Result "List actions" $false $_.Exception.Message
}

# Test 9: Filter Actions by Type
Write-Host "`n🔍 Test 9: Filter Actions by Type" -ForegroundColor Cyan

try {
    $response = Invoke-RestMethod -Uri "$ServerUrl/api/actions?type=image_generated&limit=10" -Method Get
    
    if ($response.actions) {
        $allMatch = $true
        foreach ($action in $response.actions) {
            if ($action.type -ne "image_generated") {
                $allMatch = $false
                break
            }
        }
        Test-Result "Filter actions by type" $allMatch "Found $($response.actions.Count) image_generated action(s)"
    } else {
        Test-Result "Filter actions by type" $false "No results"
    }
} catch {
    Test-Result "Filter actions by type" $false $_.Exception.Message
}

# Test 10: Get Action Stats
Write-Host "`n📈 Test 10: Action Statistics" -ForegroundColor Cyan

try {
    $response = Invoke-RestMethod -Uri "$ServerUrl/api/actions/stats" -Method Get
    
    if ($response.total -ge 0) {
        Test-Result "Get action stats" $true "Total: $($response.total), By type: $($response.byType.Count) types"
    } else {
        Test-Result "Get action stats" $false "Invalid stats format"
    }
} catch {
    Test-Result "Get action stats" $false $_.Exception.Message
}

# Test 11: Verify File System Storage
Write-Host "`n💾 Test 11: File System Verification" -ForegroundColor Cyan

$dataDir = "C:\Users\yosiw\Desktop\Jarvis-main\data"
$conversationsDir = Join-Path $dataDir "conversations"
$actionsDir = Join-Path $dataDir "actions"
$logsDir = Join-Path $dataDir "logs"

Test-Result "Conversations directory exists" (Test-Path $conversationsDir)
Test-Result "Actions directory exists" (Test-Path $actionsDir)
Test-Result "Logs directory exists" (Test-Path $logsDir)

if (Test-Path $conversationsDir) {
    $conversationFiles = Get-ChildItem -Path $conversationsDir -Filter "*.json"
    Test-Result "Conversation files created" ($conversationFiles.Count -gt 0) "$($conversationFiles.Count) file(s)"
}

if (Test-Path $actionsDir) {
    $actionFiles = Get-ChildItem -Path $actionsDir -Filter "*.json"
    Test-Result "Action files created" ($actionFiles.Count -gt 0) "$($actionFiles.Count) file(s)"
}

if (Test-Path $logsDir) {
    $logFiles = Get-ChildItem -Path $logsDir -Filter "*.log"
    Test-Result "Log files created" ($logFiles.Count -gt 0) "$($logFiles.Count) file(s)"
    
    # Check if logs contain data
    if ($logFiles.Count -gt 0) {
        $appLog = Join-Path $logsDir "app.log"
        if (Test-Path $appLog) {
            $logSize = (Get-Item $appLog).Length
            Test-Result "Logs contain data" ($logSize -gt 0) "$logSize bytes"
        }
    }
}

# Test 12: Delete Conversation (Cleanup)
if ($savedConversationId) {
    Write-Host "`n🗑️  Test 12: Delete Conversation" -ForegroundColor Cyan
    
    try {
        $response = Invoke-RestMethod -Uri "$ServerUrl/api/conversations/$savedConversationId" -Method Delete
        Test-Result "Delete conversation" $true
        
        # Verify it's gone
        try {
            $getResponse = Invoke-RestMethod -Uri "$ServerUrl/api/conversations/$savedConversationId" -Method Get
            Test-Result "Verify conversation deleted" $false "Conversation still exists"
        } catch {
            # 404 is expected
            Test-Result "Verify conversation deleted" $true
        }
    } catch {
        Test-Result "Delete conversation" $false $_.Exception.Message
    }
}

# Summary
Write-Host "`n" -NoNewline
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "📊 Test Summary" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "✅ Passed: $script:PassedTests" -ForegroundColor Green
Write-Host "❌ Failed: $script:FailedTests" -ForegroundColor Red
Write-Host "📈 Total:  $($script:PassedTests + $script:FailedTests)" -ForegroundColor Cyan

$successRate = if (($script:PassedTests + $script:FailedTests) -gt 0) {
    [math]::Round(($script:PassedTests / ($script:PassedTests + $script:FailedTests)) * 100, 2)
} else {
    0
}

Write-Host "`n🎯 Success Rate: $successRate%" -ForegroundColor Cyan

if ($script:FailedTests -eq 0) {
    Write-Host "`n🎉 All tests passed! Memory & Logs system is working correctly." -ForegroundColor Green
    exit 0
} else {
    Write-Host "`n⚠️  Some tests failed. Review the errors above." -ForegroundColor Yellow
    Write-Host "💡 Tip: Check server logs at data/logs/app.log for more details" -ForegroundColor Yellow
    exit 1
}
