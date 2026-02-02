<#
.SYNOPSIS
    AKIOR LAN HTTPS Trust Tooling
    
.DESCRIPTION
    Extracts Caddy's internal CA certificate from the running jarvis-caddy container
    and installs it to the Windows LocalMachine Root store so browsers trust
    https://akior.home.arpa and https://akior.local without certificate warnings.
    
    This is required for mic/camera access on LAN - browsers require a trusted
    secure context for getUserMedia APIs.
    
.PARAMETER Apply
    Extract and install the Caddy root CA certificate.
    
.PARAMETER Remove
    Remove the previously installed AKIOR CA certificate.
    
.PARAMETER Verify
    Check if the certificate is already installed.
    
.EXAMPLE
    .\ops\trust-lan-https.ps1 -Apply
    # Install the certificate (requires admin)
    
.EXAMPLE
    .\ops\trust-lan-https.ps1 -Remove
    # Remove the certificate (requires admin)
    
.EXAMPLE
    .\ops\trust-lan-https.ps1 -Verify
    # Check if certificate is installed (no admin needed)
#>

param(
    [switch]$Apply = $false,
    [switch]$Remove = $false,
    [switch]$Verify = $false
)

$ErrorActionPreference = "Stop"

$CertSubject = "CN=Caddy Local Authority"
$CertFriendlyName = "AKIOR LAN HTTPS (Caddy Internal CA)"
$TempCertPath = Join-Path $env:TEMP "akior-caddy-root-ca.crt"

function Write-Status($msg) { Write-Host "[$((Get-Date).ToString('HH:mm:ss'))] $msg" -ForegroundColor Cyan }
function Write-Success($msg) { Write-Host "[OK] $msg" -ForegroundColor Green }
function Write-Fail($msg) { Write-Host "[FAIL] $msg" -ForegroundColor Red }
function Write-Warn($msg) { Write-Host "[WARN] $msg" -ForegroundColor Yellow }

function Test-IsAdmin {
    $currentUser = [Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = New-Object Security.Principal.WindowsPrincipal($currentUser)
    return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

function Request-Elevation {
    if (-not (Test-IsAdmin)) {
        Write-Warn "This operation requires administrator privileges."
        Write-Status "Requesting elevation..."
        
        $scriptPath = $MyInvocation.PSCommandPath
        if (-not $scriptPath) {
            $scriptPath = $PSCommandPath
        }
        
        $arguments = @()
        if ($Apply) { $arguments += "-Apply" }
        if ($Remove) { $arguments += "-Remove" }
        
        try {
            Start-Process powershell.exe -ArgumentList "-ExecutionPolicy Bypass -File `"$scriptPath`" $($arguments -join ' ')" -Verb RunAs -Wait
            exit 0
        } catch {
            Write-Fail "Failed to elevate. Please run this script as Administrator."
            exit 1
        }
    }
}

function Get-InstalledCert {
    $certs = Get-ChildItem -Path Cert:\LocalMachine\Root | Where-Object { $_.Subject -like "*Caddy Local Authority*" }
    return $certs
}

function Test-CertInstalled {
    $cert = Get-InstalledCert
    return $null -ne $cert
}

function Export-CaddyCert {
    Write-Status "Extracting Caddy root CA certificate from container..."
    
    # Check if container is running
    $container = docker ps --filter "name=jarvis-caddy" --format "{{.Names}}" 2>$null
    if (-not $container) {
        Write-Fail "jarvis-caddy container is not running."
        Write-Host "Start the AKIOR stack first: docker compose -f deploy/compose.jarvis.yml up -d"
        return $false
    }
    
    # Extract certificate
    try {
        docker cp "jarvis-caddy:/data/caddy/pki/authorities/local/root.crt" $TempCertPath 2>$null
        
        if (-not (Test-Path $TempCertPath)) {
            Write-Fail "Failed to extract certificate. The Caddy PKI directory may not exist yet."
            Write-Host "Try accessing https://akior.local once first to trigger certificate generation."
            return $false
        }
        
        Write-Success "Certificate extracted to: $TempCertPath"
        return $true
    } catch {
        Write-Fail "Failed to extract certificate: $_"
        return $false
    }
}

function Install-CaddyCert {
    Request-Elevation
    
    Write-Host ""
    Write-Host "=======================================" -ForegroundColor Cyan
    Write-Host "  AKIOR LAN HTTPS Trust Installation  " -ForegroundColor Cyan
    Write-Host "=======================================" -ForegroundColor Cyan
    Write-Host ""
    
    # Check if already installed
    if (Test-CertInstalled) {
        Write-Warn "Caddy CA certificate is already installed in the trust store."
        Write-Host "Use -Remove first if you want to reinstall."
        return
    }
    
    # Export certificate from container
    if (-not (Export-CaddyCert)) {
        exit 1
    }
    
    # Import certificate
    Write-Status "Installing certificate to LocalMachine\Root store..."
    
    try {
        $cert = Import-Certificate -FilePath $TempCertPath -CertStoreLocation Cert:\LocalMachine\Root
        Write-Success "Certificate installed successfully!"
        Write-Host ""
        Write-Host "Thumbprint: $($cert.Thumbprint)"
        Write-Host "Subject: $($cert.Subject)"
        Write-Host ""
        
        # Clean up temp file
        Remove-Item $TempCertPath -Force -ErrorAction SilentlyContinue
        
        # Verification
        Write-Status "Verifying installation..."
        if (Test-CertInstalled) {
            Write-Success "Certificate verified in trust store!"
            Write-Host ""
            Write-Host "========================================" -ForegroundColor Green
            Write-Host "  INSTALLATION COMPLETE" -ForegroundColor Green
            Write-Host "========================================" -ForegroundColor Green
            Write-Host ""
            Write-Host "Next steps:"
            Write-Host "1. RESTART your browser completely (close all windows)"
            Write-Host "2. Navigate to: https://akior.home.arpa/diagnostics"
            Write-Host "3. Verify 'Trusted HTTPS' shows green checkmark"
            Write-Host ""
            Write-Host "If you still see certificate warnings after browser restart,"
            Write-Host "try clearing browser cache or using incognito mode first."
        } else {
            Write-Fail "Certificate installation verification failed!"
        }
    } catch {
        Write-Fail "Failed to install certificate: $_"
        Remove-Item $TempCertPath -Force -ErrorAction SilentlyContinue
        exit 1
    }
}

function Remove-CaddyCert {
    Request-Elevation
    
    Write-Host ""
    Write-Host "=======================================" -ForegroundColor Cyan
    Write-Host "  AKIOR LAN HTTPS Trust Removal       " -ForegroundColor Cyan
    Write-Host "=======================================" -ForegroundColor Cyan
    Write-Host ""
    
    $certs = Get-InstalledCert
    
    if (-not $certs) {
        Write-Warn "No AKIOR/Caddy CA certificate found in trust store."
        return
    }
    
    Write-Status "Removing certificate(s) from trust store..."
    
    foreach ($cert in $certs) {
        try {
            $store = New-Object System.Security.Cryptography.X509Certificates.X509Store("Root", "LocalMachine")
            $store.Open("ReadWrite")
            $store.Remove($cert)
            $store.Close()
            Write-Success "Removed certificate: $($cert.Thumbprint)"
        } catch {
            Write-Fail "Failed to remove certificate $($cert.Thumbprint): $_"
        }
    }
    
    Write-Host ""
    Write-Host "Certificate(s) removed. Browser will no longer trust AKIOR LAN HTTPS."
    Write-Host "Restart your browser to see the change."
}

function Show-CertStatus {
    Write-Host ""
    Write-Host "=======================================" -ForegroundColor Cyan
    Write-Host "  AKIOR LAN HTTPS Trust Status        " -ForegroundColor Cyan
    Write-Host "=======================================" -ForegroundColor Cyan
    Write-Host ""
    
    $certs = Get-InstalledCert
    
    if ($certs) {
        Write-Success "Caddy CA certificate IS installed in trust store."
        Write-Host ""
        foreach ($cert in $certs) {
            Write-Host "  Subject:     $($cert.Subject)"
            Write-Host "  Thumbprint:  $($cert.Thumbprint)"
            Write-Host "  Expires:     $($cert.NotAfter)"
            Write-Host ""
        }
        Write-Host "Your browser should trust https://akior.home.arpa without warnings."
        Write-Host "(Restart browser if you just installed the certificate)"
    } else {
        Write-Warn "Caddy CA certificate is NOT installed."
        Write-Host ""
        Write-Host "Your browser will show certificate warnings for AKIOR LAN HTTPS."
        Write-Host "This prevents mic/camera access on LAN."
        Write-Host ""
        Write-Host "To install, run:"
        Write-Host "  .\ops\trust-lan-https.ps1 -Apply"
    }
    
    Write-Host ""
    
    # Check if container is running
    $container = docker ps --filter "name=jarvis-caddy" --format "{{.Names}}" 2>$null
    if ($container) {
        Write-Success "jarvis-caddy container is running."
    } else {
        Write-Warn "jarvis-caddy container is NOT running."
    }
}

# Main execution
if ($Apply) {
    Install-CaddyCert
} elseif ($Remove) {
    Remove-CaddyCert
} elseif ($Verify) {
    Show-CertStatus
} else {
    # Default: show status
    Show-CertStatus
    Write-Host ""
    Write-Host "Usage:"
    Write-Host "  .\ops\trust-lan-https.ps1 -Apply    # Install certificate (requires admin)"
    Write-Host "  .\ops\trust-lan-https.ps1 -Remove   # Remove certificate (requires admin)"
    Write-Host "  .\ops\trust-lan-https.ps1 -Verify   # Check installation status"
}
