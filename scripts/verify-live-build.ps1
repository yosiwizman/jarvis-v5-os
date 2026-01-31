<#
.SYNOPSIS
    Verifies that the live deployment matches the expected git SHA.

.DESCRIPTION
    This script checks:
    1. /api/health/build returns 200 and valid JSON
    2. The git_sha matches the current repo HEAD
    3. The /settings page loads without crash errors

.PARAMETER BaseUrl
    Base URL to check (default: https://akior.local)

.PARAMETER ExpectedSha
    Expected git SHA (default: current HEAD)

.EXAMPLE
    .\verify-live-build.ps1
    
.EXAMPLE
    .\verify-live-build.ps1 -BaseUrl "http://localhost:3000" -ExpectedSha "abc1234"
#>

param(
    [string]$BaseUrl = "https://akior.local",
    [string]$ExpectedSha = ""
)

$ErrorActionPreference = "Stop"

# Colors
function Write-Pass { param($msg) Write-Host "[PASS] $msg" -ForegroundColor Green }
function Write-Fail { param($msg) Write-Host "[FAIL] $msg" -ForegroundColor Red }
function Write-Info { param($msg) Write-Host "[INFO] $msg" -ForegroundColor Cyan }

$AllPassed = $true

Write-Host "`n========================================" -ForegroundColor Magenta
Write-Host "  AKIOR Live Build Verification" -ForegroundColor Magenta
Write-Host "========================================`n" -ForegroundColor Magenta

# Get expected SHA from git if not provided
if ([string]::IsNullOrEmpty($ExpectedSha)) {
    try {
        $ExpectedSha = git rev-parse --short HEAD 2>$null
        Write-Info "Expected SHA (from git HEAD): $ExpectedSha"
    } catch {
        Write-Info "Could not determine expected SHA from git"
        $ExpectedSha = "unknown"
    }
} else {
    Write-Info "Expected SHA (provided): $ExpectedSha"
}

Write-Info "Base URL: $BaseUrl"
Write-Host ""

# Ignore SSL errors for self-signed certs
[System.Net.ServicePointManager]::ServerCertificateValidationCallback = { $true }

# Test 1: /api/health/build returns 200
Write-Host "Test 1: /api/health/build returns 200" -ForegroundColor White
try {
    $buildResponse = Invoke-RestMethod -Uri "$BaseUrl/api/health/build" -TimeoutSec 10 -SkipCertificateCheck
    
    if ($buildResponse.ok -eq $true) {
        Write-Pass "/api/health/build returns ok=true"
    } else {
        Write-Fail "/api/health/build returned ok=false"
        $AllPassed = $false
    }
    
    # Display build info
    Write-Host "       git_sha:    $($buildResponse.git_sha)"
    Write-Host "       build_time: $($buildResponse.build_time)"
    Write-Host "       service:    $($buildResponse.service)"
    Write-Host "       time:       $($buildResponse.time)"
    
    # Store for later comparison
    $LiveSha = $buildResponse.git_sha
} catch {
    Write-Fail "/api/health/build request failed: $_"
    $AllPassed = $false
    $LiveSha = "error"
}

Write-Host ""

# Test 2: SHA matches expected
Write-Host "Test 2: SHA matches expected" -ForegroundColor White
if ($LiveSha -eq $ExpectedSha) {
    Write-Pass "SHA matches! Live: $LiveSha, Expected: $ExpectedSha"
} elseif ($ExpectedSha -eq "unknown") {
    Write-Host "[SKIP] Cannot compare - expected SHA unknown" -ForegroundColor Yellow
} else {
    Write-Fail "SHA mismatch! Live: $LiveSha, Expected: $ExpectedSha"
    Write-Host "       This indicates deployment drift - the running build is stale."
    Write-Host "       Run: deploy\local\redeploy.ps1"
    $AllPassed = $false
}

Write-Host ""

# Test 3: /api/health returns ok
Write-Host "Test 3: /api/health returns ok" -ForegroundColor White
try {
    $healthResponse = Invoke-RestMethod -Uri "$BaseUrl/api/health" -TimeoutSec 10 -SkipCertificateCheck
    
    if ($healthResponse.ok -eq $true) {
        Write-Pass "/api/health returns ok=true"
        Write-Host "       uptime: $($healthResponse.uptime) seconds"
    } else {
        Write-Fail "/api/health returned ok=false"
        $AllPassed = $false
    }
} catch {
    Write-Fail "/api/health request failed: $_"
    $AllPassed = $false
}

Write-Host ""

# Test 4: /settings page loads without crash
Write-Host "Test 4: /settings page loads" -ForegroundColor White
try {
    $settingsResponse = Invoke-WebRequest -Uri "$BaseUrl/settings" -TimeoutSec 15 -SkipCertificateCheck
    
    if ($settingsResponse.StatusCode -eq 200) {
        # Check for crash indicators in HTML
        $content = $settingsResponse.Content
        
        if ($content -match "Cannot read properties of undefined") {
            Write-Fail "Settings page contains crash error: 'Cannot read properties of undefined'"
            $AllPassed = $false
        } elseif ($content -match "Application Error") {
            Write-Fail "Settings page contains 'Application Error'"
            $AllPassed = $false
        } elseif ($content -match "Settings data incomplete") {
            Write-Host "[WARN] Settings page shows corruption warning banner" -ForegroundColor Yellow
            Write-Pass "Settings page loaded (with warning)"
        } else {
            Write-Pass "Settings page loads without crash indicators"
        }
    } else {
        Write-Fail "Settings page returned status $($settingsResponse.StatusCode)"
        $AllPassed = $false
    }
} catch {
    Write-Fail "Settings page request failed: $_"
    $AllPassed = $false
}

# Summary
Write-Host "`n========================================" -ForegroundColor Magenta
if ($AllPassed) {
    Write-Host "  All Tests Passed!" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Magenta
    Write-Host "`n  Live SHA: $LiveSha"
    Write-Host "  The deployment is healthy and matches expected build."
    exit 0
} else {
    Write-Host "  Some Tests Failed!" -ForegroundColor Red
    Write-Host "========================================" -ForegroundColor Magenta
    Write-Host "`n  Live SHA: $LiveSha"
    Write-Host "  Expected: $ExpectedSha"
    Write-Host "`n  To fix deployment drift, run:"
    Write-Host "    .\deploy\local\redeploy.ps1"
    exit 1
}
