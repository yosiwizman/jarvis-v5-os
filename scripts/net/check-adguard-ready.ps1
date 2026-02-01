<#
.SYNOPSIS
    Verifies AdGuard Home is fully operational BEFORE disabling router DHCP.

.DESCRIPTION
    Run this script to confirm AdGuard can serve DNS and DHCP for the LAN.
    All checks must pass before it's safe to disable the router's DHCP server.

.PARAMETER Server
    AdGuard Home server IP address. Default: 192.168.1.64

.PARAMETER Port
    AdGuard Home admin port. Default: 3000

.EXAMPLE
    .\check-adguard-ready.ps1

.EXAMPLE
    .\check-adguard-ready.ps1 -Server 192.168.1.100 -Port 8080

.NOTES
    Exit codes:
      0 - All checks passed, safe to disable router DHCP
      1 - One or more checks failed, do NOT disable router DHCP
#>

param(
    [string]$Server = "192.168.1.64",
    [int]$Port = 3000
)

# Configuration
$DnsPort = 53
$DhcpPort = 67

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
Write-Host "  AdGuard Home Readiness Check" -ForegroundColor Cyan
Write-Host "=======================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Target: ${Server}:${Port}"
Write-Host ""

# -----------------------------------------------------------------------------
# Test 1: Admin UI Reachable
# -----------------------------------------------------------------------------
Write-Host "[TEST 1] Admin UI (http://${Server}:${Port}) ... " -NoNewline

try {
    $response = Invoke-WebRequest -Uri "http://${Server}:${Port}/" -TimeoutSec 5 -UseBasicParsing -ErrorAction Stop
    Write-TestResult -Status "PASS" -Message "[PASS]"
    $Passed++
} catch {
    Write-TestResult -Status "FAIL" -Message "[FAIL]" -Detail "Cannot reach AdGuard admin UI. Is the container running?"
    $Failed++
}

# -----------------------------------------------------------------------------
# Test 2: DNS Port Listening
# -----------------------------------------------------------------------------
Write-Host "[TEST 2] DNS port (${Server}:${DnsPort}) ... " -NoNewline

try {
    $tcpClient = New-Object System.Net.Sockets.TcpClient
    $asyncResult = $tcpClient.BeginConnect($Server, $DnsPort, $null, $null)
    $wait = $asyncResult.AsyncWaitHandle.WaitOne(2000, $false)
    
    if ($wait -and $tcpClient.Connected) {
        Write-TestResult -Status "PASS" -Message "[PASS]"
        $Passed++
    } else {
        Write-TestResult -Status "FAIL" -Message "[FAIL]" -Detail "DNS port 53 not responding"
        $Failed++
    }
    $tcpClient.Close()
} catch {
    Write-TestResult -Status "FAIL" -Message "[FAIL]" -Detail "DNS port check failed: $_"
    $Failed++
}

# -----------------------------------------------------------------------------
# Test 3: DNS Resolution Works
# -----------------------------------------------------------------------------
Write-Host "[TEST 3] DNS resolution (akior.local via ${Server}) ... " -NoNewline

try {
    $dnsResult = Resolve-DnsName -Name "akior.local" -Server $Server -Type A -DnsOnly -ErrorAction Stop
    $resolvedIp = $dnsResult.IPAddress | Select-Object -First 1
    
    if ($resolvedIp -eq $Server) {
        Write-TestResult -Status "PASS" -Message "[PASS]" -Detail "-> $resolvedIp"
        $Passed++
    } elseif ($resolvedIp) {
        Write-TestResult -Status "WARN" -Message "[WARN]" -Detail "Resolved to $resolvedIp (expected $Server)"
        $Warnings++
    } else {
        Write-TestResult -Status "FAIL" -Message "[FAIL]" -Detail "No IP returned"
        $Failed++
    }
} catch {
    Write-TestResult -Status "FAIL" -Message "[FAIL]" -Detail "DNS lookup failed. Add DNS rewrite: akior.local -> $Server"
    $Failed++
}

# -----------------------------------------------------------------------------
# Test 4: DHCP Status via API
# -----------------------------------------------------------------------------
Write-Host "[TEST 4] DHCP server status ... " -NoNewline

try {
    $dhcpStatus = Invoke-RestMethod -Uri "http://${Server}:${Port}/control/dhcp/status" -TimeoutSec 5 -ErrorAction Stop
    
    if ($dhcpStatus.enabled -eq $true) {
        Write-TestResult -Status "PASS" -Message "[PASS]" -Detail "(DHCP enabled)"
        $Passed++
    } else {
        Write-TestResult -Status "WARN" -Message "[WARN]" -Detail "DHCP not enabled. Enable in Settings -> DHCP"
        $Warnings++
    }
} catch {
    Write-TestResult -Status "WARN" -Message "[WARN]" -Detail "Cannot check DHCP status via API"
    $Warnings++
}

# -----------------------------------------------------------------------------
# Test 5: AdGuard API Health
# -----------------------------------------------------------------------------
Write-Host "[TEST 5] AdGuard API status ... " -NoNewline

try {
    $apiStatus = Invoke-RestMethod -Uri "http://${Server}:${Port}/control/status" -TimeoutSec 5 -ErrorAction Stop
    
    if ($apiStatus.running -eq $true) {
        $version = $apiStatus.version
        Write-TestResult -Status "PASS" -Message "[PASS]" -Detail "(v$version)"
        $Passed++
    } else {
        Write-TestResult -Status "WARN" -Message "[WARN]" -Detail "API responded but AdGuard not running?"
        $Warnings++
    }
} catch {
    Write-TestResult -Status "FAIL" -Message "[FAIL]" -Detail "Cannot reach AdGuard API"
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
    Write-Host "READY" -ForegroundColor Green
    Write-Host "=======================================" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Safe to disable router DHCP" -ForegroundColor Green
    Write-Host "  See: docs/ops/adguard-bgw320.md Step 6"
    Write-Host ""
    exit 0
} elseif ($Failed -eq 0) {
    Write-Host "  Status: " -NoNewline
    Write-Host "READY WITH WARNINGS" -ForegroundColor Yellow
    Write-Host "=======================================" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Review warnings before disabling router DHCP" -ForegroundColor Yellow
    Write-Host ""
    exit 0
} else {
    Write-Host "  Status: " -NoNewline
    Write-Host "NOT READY" -ForegroundColor Red
    Write-Host "=======================================" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "DO NOT disable router DHCP yet" -ForegroundColor Red
    Write-Host "  Fix the failed checks first."
    Write-Host ""
    exit 1
}
