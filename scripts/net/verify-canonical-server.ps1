<#
.SYNOPSIS
    Verifies the canonical AKIOR server is deployed correctly and healthy.

.DESCRIPTION
    Performs comprehensive checks on the canonical server to detect deployment drift
    and contract violations. Run this BEFORE updating DNS to point to a new server.

.PARAMETER Server
    Canonical server IP address. Default: 192.168.1.64

.PARAMETER Port
    HTTP port to test. Default: 80 (Caddy HTTP fallback)

.PARAMETER UseHttps
    Use HTTPS instead of HTTP. Default: false (HTTP for initial verification)

.EXAMPLE
    .\verify-canonical-server.ps1

.EXAMPLE
    .\verify-canonical-server.ps1 -Server 192.168.1.100 -UseHttps

.NOTES
    Exit codes:
      0 - All checks passed, safe to update DNS
      1 - One or more checks failed, do NOT update DNS
#>

param(
    [string]$Server = "192.168.1.64",
    [int]$Port = 80,
    [switch]$UseHttps
)

# Configuration
$Protocol = if ($UseHttps) { "https" } else { "http" }
$BaseUrl = "${Protocol}://${Server}:${Port}"

# Counters
$Passed = 0
$Failed = 0
$Warnings = 0

# Output helpers
function Write-TestResult {
    param([string]$Status, [string]$Message, [string]$Detail)
    
    switch ($Status) {
        "PASS" { Write-Host $Message -ForegroundColor Green -NoNewline; if ($Detail) { Write-Host " $Detail" } else { Write-Host "" } }
        "FAIL" { Write-Host $Message -ForegroundColor Red -NoNewline; Write-Host ""; if ($Detail) { Write-Host "         $Detail" -ForegroundColor DarkGray } }
        "WARN" { Write-Host $Message -ForegroundColor Yellow -NoNewline; Write-Host ""; if ($Detail) { Write-Host "         $Detail" -ForegroundColor DarkGray } }
    }
}

Write-Host ""
Write-Host "=======================================" -ForegroundColor Cyan
Write-Host "  Canonical Server Verification" -ForegroundColor Cyan
Write-Host "=======================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Target: $BaseUrl"
Write-Host ""

# Skip certificate validation for self-signed certs
if ($UseHttps) {
    [System.Net.ServicePointManager]::ServerCertificateValidationCallback = { $true }
    Add-Type @"
using System.Net;
using System.Security.Cryptography.X509Certificates;
public class TrustAllCertsPolicy : ICertificatePolicy {
    public bool CheckValidationResult(ServicePoint sp, X509Certificate cert, WebRequest req, int problem) { return true; }
}
"@
    [System.Net.ServicePointManager]::CertificatePolicy = New-Object TrustAllCertsPolicy
}

# -----------------------------------------------------------------------------
# Test 1: Build Endpoint
# -----------------------------------------------------------------------------
Write-Host "[TEST 1] Build endpoint (/api/health/build) ... " -NoNewline

try {
    $buildResponse = Invoke-RestMethod -Uri "$BaseUrl/api/health/build" -TimeoutSec 10 -ErrorAction Stop
    
    if ($buildResponse.ok -eq $true -and $buildResponse.git_sha) {
        $sha = $buildResponse.git_sha
        Write-TestResult -Status "PASS" -Message "[PASS]" -Detail "SHA: $sha"
        $Passed++
        $ServerSha = $sha
    } else {
        Write-TestResult -Status "FAIL" -Message "[FAIL]" -Detail "Response missing ok or git_sha"
        $Failed++
    }
} catch {
    Write-TestResult -Status "FAIL" -Message "[FAIL]" -Detail "Cannot reach build endpoint: $_"
    $Failed++
}

# -----------------------------------------------------------------------------
# Test 2: Settings Contract
# -----------------------------------------------------------------------------
Write-Host "[TEST 2] Settings contract (/api/settings) ... " -NoNewline

try {
    $settingsResponse = Invoke-RestMethod -Uri "$BaseUrl/api/settings" -TimeoutSec 10 -ErrorAction Stop
    
    # Verify integrations.weather exists (the known crash point)
    if ($settingsResponse.integrations -and $settingsResponse.integrations.weather) {
        $weatherEnabled = $settingsResponse.integrations.weather.enabled
        Write-TestResult -Status "PASS" -Message "[PASS]" -Detail "(integrations.weather present, enabled=$weatherEnabled)"
        $Passed++
    } else {
        Write-TestResult -Status "FAIL" -Message "[FAIL]" -Detail "integrations.weather is missing! Settings contract violated."
        $Failed++
    }
} catch {
    Write-TestResult -Status "FAIL" -Message "[FAIL]" -Detail "Cannot reach settings endpoint: $_"
    $Failed++
}

# -----------------------------------------------------------------------------
# Test 3: Notifications Stream (SSE)
# -----------------------------------------------------------------------------
Write-Host "[TEST 3] Notifications stream (/api/notifications/stream) ... " -NoNewline

try {
    # For SSE, we just need to verify it responds with correct headers
    $request = [System.Net.HttpWebRequest]::Create("$BaseUrl/api/notifications/stream")
    $request.Method = "GET"
    $request.Timeout = 5000
    $request.ReadWriteTimeout = 5000
    
    $response = $request.GetResponse()
    $contentType = $response.ContentType
    $response.Close()
    
    if ($contentType -like "*text/event-stream*") {
        Write-TestResult -Status "PASS" -Message "[PASS]" -Detail "(Content-Type: text/event-stream)"
        $Passed++
    } else {
        Write-TestResult -Status "WARN" -Message "[WARN]" -Detail "Content-Type is '$contentType', expected text/event-stream"
        $Warnings++
    }
} catch {
    $errorMsg = $_.Exception.Message
    if ($errorMsg -like "*404*") {
        Write-TestResult -Status "FAIL" -Message "[FAIL]" -Detail "404 Not Found - route mismatch (check Caddy/server prefix)"
        $Failed++
    } else {
        Write-TestResult -Status "WARN" -Message "[WARN]" -Detail "SSE check inconclusive: $errorMsg"
        $Warnings++
    }
}

# -----------------------------------------------------------------------------
# Test 4: Settings Page (HTML)
# -----------------------------------------------------------------------------
Write-Host "[TEST 4] Settings page (/settings) ... " -NoNewline

try {
    $settingsPageResponse = Invoke-WebRequest -Uri "$BaseUrl/settings" -TimeoutSec 10 -UseBasicParsing -ErrorAction Stop
    
    if ($settingsPageResponse.StatusCode -eq 200) {
        $contentLength = $settingsPageResponse.Content.Length
        Write-TestResult -Status "PASS" -Message "[PASS]" -Detail "($contentLength bytes)"
        $Passed++
    } else {
        Write-TestResult -Status "FAIL" -Message "[FAIL]" -Detail "Status: $($settingsPageResponse.StatusCode)"
        $Failed++
    }
} catch {
    Write-TestResult -Status "FAIL" -Message "[FAIL]" -Detail "Cannot reach settings page: $_"
    $Failed++
}

# -----------------------------------------------------------------------------
# Test 5: Health Endpoint
# -----------------------------------------------------------------------------
Write-Host "[TEST 5] Health endpoint (/api/health) ... " -NoNewline

try {
    $healthResponse = Invoke-RestMethod -Uri "$BaseUrl/api/health" -TimeoutSec 10 -ErrorAction Stop
    
    if ($healthResponse.ok -eq $true) {
        $uptime = [math]::Round($healthResponse.uptime / 60, 1)
        Write-TestResult -Status "PASS" -Message "[PASS]" -Detail "(uptime: ${uptime} min)"
        $Passed++
    } else {
        Write-TestResult -Status "FAIL" -Message "[FAIL]" -Detail "Health check returned ok=false"
        $Failed++
    }
} catch {
    Write-TestResult -Status "FAIL" -Message "[FAIL]" -Detail "Cannot reach health endpoint: $_"
    $Failed++
}

# -----------------------------------------------------------------------------
# Summary
# -----------------------------------------------------------------------------
Write-Host ""
Write-Host "=======================================" -ForegroundColor Cyan
$Total = $Passed + $Failed + $Warnings
Write-Host "  Results: $Passed/$Total passed"

if ($Warnings -gt 0) {
    Write-Host "  Warnings: $Warnings" -ForegroundColor Yellow
}

if ($Failed -eq 0 -and $Warnings -eq 0) {
    Write-Host "  Status: " -NoNewline
    Write-Host "HEALTHY" -ForegroundColor Green
    Write-Host "=======================================" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Canonical server is healthy." -ForegroundColor Green
    Write-Host "  Safe to update DNS: akior.local -> $Server"
    Write-Host ""
    exit 0
} elseif ($Failed -eq 0) {
    Write-Host "  Status: " -NoNewline
    Write-Host "HEALTHY WITH WARNINGS" -ForegroundColor Yellow
    Write-Host "=======================================" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Review warnings before updating DNS." -ForegroundColor Yellow
    Write-Host ""
    exit 0
} else {
    Write-Host "  Status: " -NoNewline
    Write-Host "UNHEALTHY" -ForegroundColor Red
    Write-Host "=======================================" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "DO NOT update DNS until issues are fixed." -ForegroundColor Red
    Write-Host "  Fix the failed checks, then re-run this script."
    Write-Host ""
    exit 1
}
