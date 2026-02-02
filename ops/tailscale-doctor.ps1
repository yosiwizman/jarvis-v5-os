<#
.SYNOPSIS
    AKIOR Tailscale Doctor
    
.DESCRIPTION
    Diagnoses Tailscale installation and connectivity status for AKIOR remote access.
    Detects installed version, connection status, IP addresses, and MagicDNS name.
    
.PARAMETER Json
    Output results as JSON (for programmatic use).
    
.EXAMPLE
    .\ops\tailscale-doctor.ps1
    # Display human-readable status
    
.EXAMPLE
    .\ops\tailscale-doctor.ps1 -Json
    # Output JSON for scripting
#>

param(
    [switch]$Json = $false
)

$ErrorActionPreference = "Continue"

function Write-Status($msg) { Write-Host "[$((Get-Date).ToString('HH:mm:ss'))] $msg" -ForegroundColor Cyan }
function Write-Success($msg) { Write-Host "[OK] $msg" -ForegroundColor Green }
function Write-Fail($msg) { Write-Host "[FAIL] $msg" -ForegroundColor Red }
function Write-Warn($msg) { Write-Host "[WARN] $msg" -ForegroundColor Yellow }

$result = @{
    installed = $false
    version = $null
    up = $false
    backendState = $null
    tailscaleIp = $null
    hostname = $null
    magicDnsName = $null
    serveEnabled = $false
    errors = @()
}

# Check if Tailscale is installed
Write-Status "Checking Tailscale installation..."

try {
    $versionOutput = & tailscale version 2>&1
    if ($LASTEXITCODE -eq 0) {
        $result.installed = $true
        # Extract version number (first line, e.g., "1.56.1")
        $result.version = ($versionOutput -split "`n")[0].Trim()
        if (-not $Json) { Write-Success "Tailscale installed: $($result.version)" }
    } else {
        $result.errors += "Tailscale not found in PATH"
        if (-not $Json) { Write-Fail "Tailscale is not installed or not in PATH" }
    }
} catch {
    $result.errors += "Failed to check Tailscale: $_"
    if (-not $Json) { Write-Fail "Failed to check Tailscale: $_" }
}

# Get detailed status (if installed)
if ($result.installed) {
    Write-Status "Checking Tailscale connection status..."
    
    try {
        $statusJson = & tailscale status --json 2>&1
        if ($LASTEXITCODE -eq 0) {
            $status = $statusJson | ConvertFrom-Json
            $result.backendState = $status.BackendState
            $result.up = $status.BackendState -eq "Running"
            
            if ($status.Self) {
                $result.tailscaleIp = $status.Self.TailscaleIPs[0]
                $result.hostname = $status.Self.HostName
                $result.magicDnsName = $status.Self.DNSName -replace '\.$', ''
            }
            
            if ($result.up) {
                if (-not $Json) {
                    Write-Success "Tailscale is connected"
                    Write-Host "  Tailscale IP: $($result.tailscaleIp)"
                    Write-Host "  Hostname: $($result.hostname)"
                    if ($result.magicDnsName) {
                        Write-Host "  MagicDNS: $($result.magicDnsName)"
                    }
                }
            } else {
                if (-not $Json) { Write-Warn "Tailscale is not connected (state: $($result.backendState))" }
            }
        } else {
            $result.errors += "Failed to get Tailscale status"
            if (-not $Json) { Write-Warn "Could not get Tailscale status (may not be logged in)" }
        }
    } catch {
        $result.errors += "Failed to parse Tailscale status: $_"
        if (-not $Json) { Write-Warn "Failed to parse Tailscale status: $_" }
    }
    
    # Check serve status
    Write-Status "Checking Tailscale Serve status..."
    
    try {
        $serveOutput = & tailscale serve status 2>&1
        if ($LASTEXITCODE -eq 0) {
            $result.serveEnabled = $serveOutput -match 'https://' -or $serveOutput -match 'http://'
            if ($result.serveEnabled) {
                if (-not $Json) { Write-Success "Tailscale Serve is enabled" }
            } else {
                if (-not $Json) { Write-Host "  Tailscale Serve is not enabled" -ForegroundColor Gray }
            }
        }
    } catch {
        if (-not $Json) { Write-Host "  Could not check Tailscale Serve status" -ForegroundColor Gray }
    }
}

# Output
if ($Json) {
    $result | ConvertTo-Json -Depth 5
} else {
    Write-Host ""
    Write-Host "==========================================" -ForegroundColor Cyan
    Write-Host "  Tailscale Summary                       " -ForegroundColor Cyan
    Write-Host "==========================================" -ForegroundColor Cyan
    Write-Host ""
    
    if ($result.installed -and $result.up) {
        Write-Success "Tailscale is ready for AKIOR remote access"
        if ($result.magicDnsName) {
            Write-Host ""
            Write-Host "Your remote URL would be:" -ForegroundColor Green
            Write-Host "  https://$($result.magicDnsName)/"
        }
    } elseif ($result.installed) {
        Write-Warn "Tailscale is installed but not connected"
        Write-Host ""
        Write-Host "To connect, run:"
        Write-Host "  tailscale up"
        Write-Host ""
        Write-Host "Or provide an auth key during AKIOR setup."
    } else {
        Write-Fail "Tailscale is not installed"
        Write-Host ""
        Write-Host "To install Tailscale:"
        Write-Host "  1. Download from https://tailscale.com/download"
        Write-Host "  2. Run the installer"
        Write-Host "  3. Run this script again"
    }
    
    Write-Host ""
}
