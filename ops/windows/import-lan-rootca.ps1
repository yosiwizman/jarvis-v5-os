#Requires -RunAsAdministrator
<#
.SYNOPSIS
    Import AKIOR LAN Root CA certificate to Windows Trusted Root store.

.DESCRIPTION
    This script imports the locally-generated mkcert Root CA certificate
    into Windows Trusted Root Certification Authorities store, enabling
    HTTPS access to AKIOR on the LAN without browser warnings.

    After importing, camera/mic features will work in the browser.

.PARAMETER CertPath
    Path to the rootCA.pem file. Defaults to deploy/certs/rootCA.pem relative
    to the repository root, or the current directory if not found.

.EXAMPLE
    # Run from repository root (as Administrator):
    .\ops\windows\import-lan-rootca.ps1

.EXAMPLE
    # Specify custom certificate path:
    .\ops\windows\import-lan-rootca.ps1 -CertPath "C:\path\to\rootCA.pem"

.NOTES
    REQUIRES: Run PowerShell as Administrator
    Author: AKIOR Team
#>

param(
    [Parameter(Mandatory=$false)]
    [string]$CertPath
)

# Colors for output
function Write-Success { param($msg) Write-Host "✓ $msg" -ForegroundColor Green }
function Write-Fail { param($msg) Write-Host "✗ $msg" -ForegroundColor Red }
function Write-Warn { param($msg) Write-Host "! $msg" -ForegroundColor Yellow }
function Write-Info { param($msg) Write-Host "  $msg" -ForegroundColor Cyan }

Write-Host ""
Write-Host "=== AKIOR LAN Root CA Import ===" -ForegroundColor Cyan
Write-Host ""

# Check if running as Administrator
$currentPrincipal = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
if (-not $currentPrincipal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    Write-Fail "This script must be run as Administrator"
    Write-Info "Right-click PowerShell and select 'Run as Administrator'"
    exit 1
}

Write-Success "Running as Administrator"

# Find certificate file
$certLocations = @()

if ($CertPath) {
    $certLocations += $CertPath
}

# Try common locations relative to script location
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot = Split-Path -Parent (Split-Path -Parent $scriptDir)

$certLocations += Join-Path $repoRoot "deploy\certs\rootCA.pem"
$certLocations += Join-Path $PWD "deploy\certs\rootCA.pem"
$certLocations += Join-Path $PWD "rootCA.pem"
$certLocations += ".\rootCA.pem"

$foundCert = $null
foreach ($loc in $certLocations) {
    if (Test-Path $loc) {
        $foundCert = (Resolve-Path $loc).Path
        break
    }
}

if (-not $foundCert) {
    Write-Fail "Could not find rootCA.pem certificate"
    Write-Info "Searched locations:"
    foreach ($loc in $certLocations) {
        Write-Info "  - $loc"
    }
    Write-Host ""
    Write-Info "Copy rootCA.pem from the AKIOR server and run:"
    Write-Info "  .\import-lan-rootca.ps1 -CertPath 'C:\path\to\rootCA.pem'"
    exit 1
}

Write-Success "Found certificate: $foundCert"

# Verify it's a valid certificate
Write-Host ""
Write-Host "Verifying certificate..." -ForegroundColor Cyan

try {
    $certContent = Get-Content $foundCert -Raw
    if ($certContent -notmatch "-----BEGIN CERTIFICATE-----") {
        Write-Fail "File does not appear to be a valid PEM certificate"
        exit 1
    }
    Write-Success "Certificate format valid (PEM)"
} catch {
    Write-Fail "Could not read certificate file: $_"
    exit 1
}

# Import certificate to Trusted Root store
Write-Host ""
Write-Host "Importing certificate to Trusted Root store..." -ForegroundColor Cyan

try {
    # Use certutil for import (handles PEM format)
    $output = & certutil -addstore -f "Root" $foundCert 2>&1
    
    if ($LASTEXITCODE -eq 0) {
        Write-Success "Certificate imported to Trusted Root Certification Authorities"
    } else {
        Write-Fail "certutil failed with exit code $LASTEXITCODE"
        Write-Info $output
        exit 1
    }
} catch {
    Write-Fail "Failed to import certificate: $_"
    exit 1
}

# Flush DNS cache
Write-Host ""
Write-Host "Flushing DNS cache..." -ForegroundColor Cyan

try {
    $null = & ipconfig /flushdns 2>&1
    Write-Success "DNS cache flushed"
} catch {
    Write-Warn "Could not flush DNS cache (non-critical)"
}

# Summary and test URLs
Write-Host ""
Write-Host "=== SUCCESS ===" -ForegroundColor Green
Write-Host ""
Write-Host "The AKIOR LAN Root CA has been imported." -ForegroundColor Green
Write-Host "Browsers will now trust HTTPS connections to AKIOR." -ForegroundColor Green
Write-Host ""
Write-Host "Test URLs (open in browser):" -ForegroundColor Cyan
Write-Host "  https://jarvis.local/" -ForegroundColor White
Write-Host "  https://jarvis.local/camera" -ForegroundColor White
Write-Host "  https://jarvis.local/display" -ForegroundColor White
Write-Host "  https://aifactory-lan/" -ForegroundColor White
Write-Host ""
Write-Host "If browser still shows warnings:" -ForegroundColor Yellow
Write-Host "  1. Close and reopen the browser completely" -ForegroundColor Yellow
Write-Host "  2. Clear browser cache (Ctrl+Shift+Delete)" -ForegroundColor Yellow
Write-Host "  3. Verify hosts file has: <server-ip> jarvis.local aifactory-lan" -ForegroundColor Yellow
Write-Host ""
