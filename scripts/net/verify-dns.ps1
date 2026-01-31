<#
.SYNOPSIS
    Verifies that akior.local DNS resolution and deployment are correct.

.DESCRIPTION
    This script performs three verification steps:
    1. DNS Resolution: Confirms akior.local resolves to the expected IP
    2. Build SHA: Confirms the server is running the expected build
    3. Settings Page: Confirms /settings loads without errors

.PARAMETER ExpectedIP
    The expected LAN IP address for akior.local.
    Can also be set via AKIOR_EXPECTED_IP environment variable.

.PARAMETER ExpectedSha
    The expected git SHA for the deployment.
    Can also be set via AKIOR_EXPECTED_SHA environment variable.
    If not provided, skips SHA comparison but still verifies endpoint responds.

.PARAMETER BaseUrl
    Base URL to test (default: https://akior.local)

.EXAMPLE
    .\verify-dns.ps1 -ExpectedIP "192.168.1.100"
    
.EXAMPLE
    $env:AKIOR_EXPECTED_IP = "192.168.1.100"
    $env:AKIOR_EXPECTED_SHA = "626dcdf"
    .\verify-dns.ps1
#>

param(
    [string]$ExpectedIP = $env:AKIOR_EXPECTED_IP,
    [string]$ExpectedSha = $env:AKIOR_EXPECTED_SHA,
    [string]$BaseUrl = "https://akior.local"
)

$ErrorActionPreference = "Stop"

# Colors
function Write-Pass { param($msg) Write-Host "[PASS] $msg" -ForegroundColor Green }
function Write-Fail { param($msg) Write-Host "[FAIL] $msg" -ForegroundColor Red }
function Write-Info { param($msg) Write-Host "[INFO] $msg" -ForegroundColor Cyan }
function Write-Warn { param($msg) Write-Host "[WARN] $msg" -ForegroundColor Yellow }

$AllPassed = $true
$Results = @()

Write-Host "`n========================================" -ForegroundColor Magenta
Write-Host "  AKIOR LAN DNS Verification" -ForegroundColor Magenta
Write-Host "========================================`n" -ForegroundColor Magenta

# Ignore SSL errors for self-signed certs (Windows PowerShell 5.x compatibility)
if (-not ("TrustAllCertsPolicy" -as [type])) {
    Add-Type @"
using System.Net;
using System.Security.Cryptography.X509Certificates;
public class TrustAllCertsPolicy : ICertificatePolicy {
    public bool CheckValidationResult(
        ServicePoint srvPoint, X509Certificate certificate,
        WebRequest request, int certificateProblem) {
        return true;
    }
}
"@
}
[System.Net.ServicePointManager]::CertificatePolicy = New-Object TrustAllCertsPolicy

# Build params for Invoke-RestMethod (PS 6+ has -SkipCertificateCheck)
$webParams = @{ TimeoutSec = 15 }
if ($PSVersionTable.PSVersion.Major -ge 6) {
    $webParams.SkipCertificateCheck = $true
}

# ==============================================
# TEST 1: DNS Resolution
# ==============================================
Write-Host "Test 1: DNS Resolution" -ForegroundColor White
Write-Host "---------------------------------------"

$hostname = "akior.local"
$resolvedIP = $null

try {
    $dnsResult = [System.Net.Dns]::GetHostAddresses($hostname) | Where-Object { $_.AddressFamily -eq 'InterNetwork' } | Select-Object -First 1
    $resolvedIP = $dnsResult.IPAddressToString
    Write-Info "akior.local resolves to: $resolvedIP"
} catch {
    Write-Fail "DNS resolution failed: $_"
    $AllPassed = $false
    $Results += @{ Test = "DNS Resolution"; Status = "FAIL"; Details = "Could not resolve akior.local" }
}

if ($resolvedIP) {
    if ([string]::IsNullOrEmpty($ExpectedIP)) {
        Write-Warn "No expected IP provided (-ExpectedIP or AKIOR_EXPECTED_IP env var)"
        Write-Info "Resolved IP: $resolvedIP"
        $Results += @{ Test = "DNS Resolution"; Status = "WARN"; Details = "Resolved to $resolvedIP (no expected IP to compare)" }
    } elseif ($resolvedIP -eq $ExpectedIP) {
        Write-Pass "DNS resolves to expected IP: $resolvedIP"
        $Results += @{ Test = "DNS Resolution"; Status = "PASS"; Details = "Resolved to $resolvedIP" }
    } else {
        Write-Fail "DNS mismatch! Expected: $ExpectedIP, Got: $resolvedIP"
        Write-Host "       This means akior.local points to the WRONG host." -ForegroundColor Yellow
        Write-Host "       Fix: Update router DNS or hosts file. See docs/ops/dns-setup.md" -ForegroundColor Yellow
        $AllPassed = $false
        $Results += @{ Test = "DNS Resolution"; Status = "FAIL"; Details = "Expected $ExpectedIP, got $resolvedIP" }
    }
}

Write-Host ""

# ==============================================
# TEST 2: /api/health/build Endpoint
# ==============================================
Write-Host "Test 2: Build Endpoint (/api/health/build)" -ForegroundColor White
Write-Host "---------------------------------------"

$buildEndpoint = "$BaseUrl/api/health/build"
$serverSha = $null

try {
    $buildResponse = Invoke-RestMethod -Uri $buildEndpoint -Method GET @webParams
    
    if ($buildResponse.ok -eq $true) {
        $serverSha = $buildResponse.git_sha
        Write-Pass "/api/health/build returns ok=true"
        Write-Info "Server SHA: $serverSha"
        Write-Info "Build Time: $($buildResponse.build_time)"
        
        if ([string]::IsNullOrEmpty($ExpectedSha)) {
            Write-Warn "No expected SHA provided (-ExpectedSha or AKIOR_EXPECTED_SHA env var)"
            $Results += @{ Test = "Build Endpoint"; Status = "WARN"; Details = "Server SHA: $serverSha (no expected SHA to compare)" }
        } elseif ($serverSha -eq $ExpectedSha) {
            Write-Pass "SHA matches expected: $serverSha"
            $Results += @{ Test = "Build Endpoint"; Status = "PASS"; Details = "SHA: $serverSha" }
        } else {
            Write-Fail "SHA mismatch! Expected: $ExpectedSha, Got: $serverSha"
            Write-Host "       The server is running a DIFFERENT build than expected." -ForegroundColor Yellow
            Write-Host "       Fix: Redeploy using deploy/local/redeploy.ps1" -ForegroundColor Yellow
            $AllPassed = $false
            $Results += @{ Test = "Build Endpoint"; Status = "FAIL"; Details = "Expected $ExpectedSha, got $serverSha" }
        }
    } else {
        Write-Fail "/api/health/build returned ok=false"
        $AllPassed = $false
        $Results += @{ Test = "Build Endpoint"; Status = "FAIL"; Details = "Endpoint returned ok=false" }
    }
} catch {
    Write-Fail "Build endpoint request failed: $_"
    Write-Host "       This could mean:" -ForegroundColor Yellow
    Write-Host "       - akior.local points to wrong/unreachable host" -ForegroundColor Yellow
    Write-Host "       - Server is down or not responding" -ForegroundColor Yellow
    Write-Host "       - SSL/TLS certificate issue" -ForegroundColor Yellow
    $AllPassed = $false
    $Results += @{ Test = "Build Endpoint"; Status = "FAIL"; Details = "Request failed: $_" }
}

Write-Host ""

# ==============================================
# TEST 3: /settings Page Loads
# ==============================================
Write-Host "Test 3: Settings Page (/settings)" -ForegroundColor White
Write-Host "---------------------------------------"

$settingsUrl = "$BaseUrl/settings"

try {
    $settingsParams = @{ TimeoutSec = 20; UseBasicParsing = $true }
    if ($PSVersionTable.PSVersion.Major -ge 6) {
        $settingsParams.SkipCertificateCheck = $true
    }
    
    $settingsResponse = Invoke-WebRequest -Uri $settingsUrl @settingsParams
    
    if ($settingsResponse.StatusCode -eq 200) {
        $content = $settingsResponse.Content
        
        # Check for crash indicators
        if ($content -match "Cannot read properties of undefined") {
            Write-Fail "Settings page crashed with 'Cannot read properties of undefined'"
            $AllPassed = $false
            $Results += @{ Test = "Settings Page"; Status = "FAIL"; Details = "Page crashed with undefined error" }
        } elseif ($content -match "Application error") {
            Write-Fail "Settings page shows 'Application error'"
            $AllPassed = $false
            $Results += @{ Test = "Settings Page"; Status = "FAIL"; Details = "Application error displayed" }
        } else {
            Write-Pass "Settings page loads successfully (HTTP 200)"
            $Results += @{ Test = "Settings Page"; Status = "PASS"; Details = "Page loaded without errors" }
            
            # Check if page contains build info (indicates correct deployment)
            if ($content -match "server-build-sha" -or $content -match "Build:") {
                Write-Info "Page contains build info display"
            }
        }
    } else {
        Write-Fail "Settings page returned status $($settingsResponse.StatusCode)"
        $AllPassed = $false
        $Results += @{ Test = "Settings Page"; Status = "FAIL"; Details = "HTTP $($settingsResponse.StatusCode)" }
    }
} catch {
    Write-Fail "Settings page request failed: $_"
    $AllPassed = $false
    $Results += @{ Test = "Settings Page"; Status = "FAIL"; Details = "Request failed" }
}

Write-Host ""

# ==============================================
# TEST 4: Compare Resolved IP Connectivity
# ==============================================
Write-Host "Test 4: Network Connectivity" -ForegroundColor White
Write-Host "---------------------------------------"

if ($resolvedIP) {
    try {
        $pingResult = Test-Connection -ComputerName $resolvedIP -Count 1 -ErrorAction SilentlyContinue
        if ($pingResult) {
            $latency = $pingResult.ResponseTime
            Write-Pass "Host $resolvedIP is reachable (${latency}ms)"
            $Results += @{ Test = "Network Connectivity"; Status = "PASS"; Details = "Ping ${latency}ms" }
        } else {
            Write-Fail "Host $resolvedIP is not reachable"
            $AllPassed = $false
            $Results += @{ Test = "Network Connectivity"; Status = "FAIL"; Details = "Ping failed" }
        }
    } catch {
        Write-Warn "Could not ping $resolvedIP: $_"
        $Results += @{ Test = "Network Connectivity"; Status = "WARN"; Details = "Ping error" }
    }
} else {
    Write-Warn "Skipping connectivity test (no resolved IP)"
    $Results += @{ Test = "Network Connectivity"; Status = "SKIP"; Details = "No resolved IP" }
}

# ==============================================
# Summary
# ==============================================
Write-Host "`n========================================" -ForegroundColor Magenta
if ($AllPassed) {
    Write-Host "  All Tests Passed!" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Magenta
    Write-Host "`n  akior.local is correctly configured."
    Write-Host "  Resolved IP: $resolvedIP"
    if ($serverSha) { Write-Host "  Server SHA:  $serverSha" }
    exit 0
} else {
    Write-Host "  Some Tests Failed!" -ForegroundColor Red
    Write-Host "========================================" -ForegroundColor Magenta
    Write-Host "`nFailed tests:"
    foreach ($r in $Results | Where-Object { $_.Status -eq "FAIL" }) {
        Write-Host "  - $($r.Test): $($r.Details)" -ForegroundColor Red
    }
    Write-Host "`nNext steps:"
    Write-Host "  1. Check docs/ops/dns-setup.md for DNS configuration"
    Write-Host "  2. Check docs/runbooks/deploy-drift.md for deployment issues"
    Write-Host "  3. Run deploy/local/redeploy.ps1 if SHA mismatch"
    exit 1
}
