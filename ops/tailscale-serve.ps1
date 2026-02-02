<#
.SYNOPSIS
    AKIOR Tailscale Serve Manager
    
.DESCRIPTION
    Manages Tailscale Serve for AKIOR remote access.
    Enables/disables HTTPS proxy to the local AKIOR web port.
    
    SECURITY:
    - Does NOT open any inbound WAN ports
    - Only exposes via Tailscale overlay network
    - Requires Tailscale authentication
    
.PARAMETER Enable
    Enable Tailscale Serve to proxy AKIOR web interface.
    
.PARAMETER Disable
    Disable Tailscale Serve.
    
.PARAMETER Status
    Show current Tailscale Serve status.
    
.PARAMETER Port
    Local port to proxy (default: 3000 for AKIOR web).
    
.EXAMPLE
    .\ops\tailscale-serve.ps1 -Enable
    # Enable serve on default port 3000
    
.EXAMPLE
    .\ops\tailscale-serve.ps1 -Enable -Port 8080
    # Enable serve on custom port
    
.EXAMPLE
    .\ops\tailscale-serve.ps1 -Disable
    # Disable serve
    
.EXAMPLE
    .\ops\tailscale-serve.ps1 -Status
    # Show current status
#>

param(
    [switch]$Enable = $false,
    [switch]$Disable = $false,
    [switch]$Status = $false,
    [int]$Port = 3000
)

$ErrorActionPreference = "Stop"

function Write-Status($msg) { Write-Host "[$((Get-Date).ToString('HH:mm:ss'))] $msg" -ForegroundColor Cyan }
function Write-Success($msg) { Write-Host "[OK] $msg" -ForegroundColor Green }
function Write-Fail($msg) { Write-Host "[FAIL] $msg" -ForegroundColor Red }
function Write-Warn($msg) { Write-Host "[WARN] $msg" -ForegroundColor Yellow }

# Check Tailscale is installed and connected
function Test-TailscaleReady {
    try {
        $version = & tailscale version 2>&1
        if ($LASTEXITCODE -ne 0) {
            Write-Fail "Tailscale is not installed"
            Write-Host "Install from https://tailscale.com/download"
            return $false
        }
    } catch {
        Write-Fail "Tailscale is not installed"
        return $false
    }
    
    try {
        $statusJson = & tailscale status --json 2>&1
        if ($LASTEXITCODE -ne 0) {
            Write-Fail "Could not get Tailscale status"
            return $false
        }
        
        $status = $statusJson | ConvertFrom-Json
        if ($status.BackendState -ne "Running") {
            Write-Warn "Tailscale is not connected (state: $($status.BackendState))"
            Write-Host "Run 'tailscale up' to connect first"
            return $false
        }
        
        return $true
    } catch {
        Write-Fail "Failed to check Tailscale status: $_"
        return $false
    }
}

function Get-TailscaleDnsName {
    try {
        $statusJson = & tailscale status --json 2>&1
        $status = $statusJson | ConvertFrom-Json
        if ($status.Self.DNSName) {
            return $status.Self.DNSName -replace '\.$', ''
        }
    } catch {}
    return $null
}

function Show-ServeStatus {
    Write-Host ""
    Write-Host "==========================================" -ForegroundColor Cyan
    Write-Host "  Tailscale Serve Status                  " -ForegroundColor Cyan
    Write-Host "==========================================" -ForegroundColor Cyan
    Write-Host ""
    
    if (-not (Test-TailscaleReady)) {
        return
    }
    
    try {
        $serveOutput = & tailscale serve status 2>&1
        if ($LASTEXITCODE -eq 0) {
            if ($serveOutput -match 'https://' -or $serveOutput -match 'http://') {
                Write-Success "Tailscale Serve is ENABLED"
                Write-Host ""
                Write-Host "Current configuration:"
                Write-Host $serveOutput
                
                $dnsName = Get-TailscaleDnsName
                if ($dnsName) {
                    Write-Host ""
                    Write-Host "Remote access URL:" -ForegroundColor Green
                    Write-Host "  https://$dnsName/"
                }
            } else {
                Write-Host "Tailscale Serve is DISABLED" -ForegroundColor Yellow
                Write-Host ""
                Write-Host "To enable for AKIOR:"
                Write-Host "  .\ops\tailscale-serve.ps1 -Enable"
            }
        } else {
            Write-Host "Tailscale Serve is DISABLED" -ForegroundColor Yellow
        }
    } catch {
        Write-Fail "Failed to check serve status: $_"
    }
    
    Write-Host ""
}

function Enable-Serve {
    Write-Host ""
    Write-Host "==========================================" -ForegroundColor Cyan
    Write-Host "  Enabling Tailscale Serve                " -ForegroundColor Cyan
    Write-Host "==========================================" -ForegroundColor Cyan
    Write-Host ""
    
    if (-not (Test-TailscaleReady)) {
        exit 1
    }
    
    Write-Status "Enabling Tailscale Serve on port $Port..."
    
    try {
        # Enable HTTPS serve proxying to local port
        # --bg runs in background, https:443 serves on HTTPS, / proxies root path
        $localUrl = "http://127.0.0.1:$Port"
        $output = & tailscale serve --bg https:443 / $localUrl 2>&1
        
        if ($LASTEXITCODE -eq 0) {
            Write-Success "Tailscale Serve enabled!"
            
            $dnsName = Get-TailscaleDnsName
            if ($dnsName) {
                Write-Host ""
                Write-Host "Your AKIOR remote access URL:" -ForegroundColor Green
                Write-Host "  https://$dnsName/"
                Write-Host ""
                Write-Host "Access this URL from any device on your Tailscale network."
            }
        } else {
            Write-Fail "Failed to enable Tailscale Serve"
            Write-Host $output
            exit 1
        }
    } catch {
        Write-Fail "Failed to enable Tailscale Serve: $_"
        exit 1
    }
    
    Write-Host ""
}

function Disable-Serve {
    Write-Host ""
    Write-Host "==========================================" -ForegroundColor Cyan
    Write-Host "  Disabling Tailscale Serve               " -ForegroundColor Cyan
    Write-Host "==========================================" -ForegroundColor Cyan
    Write-Host ""
    
    Write-Status "Disabling Tailscale Serve..."
    
    try {
        $output = & tailscale serve --bg off 2>&1
        
        # Note: 'off' may fail if nothing is being served - that's ok
        Write-Success "Tailscale Serve disabled"
        Write-Host ""
        Write-Host "Remote access to AKIOR has been turned off."
    } catch {
        Write-Warn "Could not disable Tailscale Serve (may already be off)"
    }
    
    Write-Host ""
}

# Main execution
if ($Enable) {
    Enable-Serve
} elseif ($Disable) {
    Disable-Serve
} elseif ($Status) {
    Show-ServeStatus
} else {
    # Default: show status
    Show-ServeStatus
    Write-Host "Usage:"
    Write-Host "  .\ops\tailscale-serve.ps1 -Enable      # Enable remote access"
    Write-Host "  .\ops\tailscale-serve.ps1 -Disable     # Disable remote access"
    Write-Host "  .\ops\tailscale-serve.ps1 -Status      # Show current status"
    Write-Host "  .\ops\tailscale-serve.ps1 -Enable -Port 8080  # Custom port"
    Write-Host ""
}
