<#
.SYNOPSIS
    AKIOR Deterministic Deployment Script
    
.DESCRIPTION
    Deploys AKIOR with guaranteed web/server sync.
    - Always rebuilds both jarvis-web and jarvis-server images
    - Passes git SHA to both containers at build time
    - Verifies /__web_build and /api/health/build match after deploy
    
.PARAMETER Rebuild
    Force rebuild of all images (recommended). Default: true
    
.PARAMETER NoCache
    Build without Docker cache. Slower but guaranteed fresh. Default: false
    
.PARAMETER Verify
    Only run verification, don't rebuild. Default: false
    
.PARAMETER Host
    Target hostname for verification. Default: https://akior.local
    
.EXAMPLE
    .\ops\deploy.ps1
    # Standard deploy with rebuild
    
.EXAMPLE
    .\ops\deploy.ps1 -NoCache
    # Full rebuild without cache
    
.EXAMPLE
    .\ops\deploy.ps1 -Verify
    # Verify current deployment without rebuild
#>

param(
    [switch]$Rebuild = $true,
    [switch]$NoCache = $false,
    [switch]$Verify = $false,
    [string]$Host = "https://akior.local"
)

$ErrorActionPreference = "Stop"
$RepoRoot = Split-Path -Parent $PSScriptRoot
$ComposeFile = Join-Path $RepoRoot "deploy/compose.jarvis.yml"

function Write-Status($msg) { Write-Host "[$((Get-Date).ToString('HH:mm:ss'))] $msg" -ForegroundColor Cyan }
function Write-Success($msg) { Write-Host "[OK] $msg" -ForegroundColor Green }
function Write-Fail($msg) { Write-Host "[FAIL] $msg" -ForegroundColor Red }
function Write-Warn($msg) { Write-Host "[WARN] $msg" -ForegroundColor Yellow }

function Get-GitSha {
    $sha = git -C $RepoRoot rev-parse --short HEAD 2>$null
    if (-not $sha) { return "unknown" }
    return $sha.Trim()
}

function Get-BuildTime {
    return (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
}

function Invoke-Build {
    param([string]$GitSha, [string]$BuildTime, [switch]$NoCache)
    
    Write-Status "Building images with SHA: $GitSha, Time: $BuildTime"
    
    $env:GIT_SHA = $GitSha
    $env:BUILD_TIME = $BuildTime
    
    $buildArgs = @(
        "compose", "-f", $ComposeFile,
        "build"
    )
    
    if ($NoCache) {
        $buildArgs += "--no-cache"
        Write-Warn "Building without cache (this will take longer)"
    }
    
    $buildArgs += @("web", "server")
    
    Write-Status "Running: docker $($buildArgs -join ' ')"
    & docker @buildArgs
    
    if ($LASTEXITCODE -ne 0) {
        throw "Docker build failed with exit code $LASTEXITCODE"
    }
    
    Write-Success "Build completed"
}

function Invoke-Deploy {
    Write-Status "Deploying containers with force-recreate..."
    
    $deployArgs = @(
        "compose", "-f", $ComposeFile,
        "up", "-d", "--force-recreate",
        "caddy", "web", "server"
    )
    
    Write-Status "Running: docker $($deployArgs -join ' ')"
    & docker @deployArgs
    
    if ($LASTEXITCODE -ne 0) {
        throw "Docker deploy failed with exit code $LASTEXITCODE"
    }
    
    Write-Success "Containers started"
    
    # Wait for health
    Write-Status "Waiting for containers to become healthy..."
    Start-Sleep -Seconds 10
}

function Invoke-Verification {
    param([string]$ExpectedSha, [string]$TargetHost)
    
    Write-Status "Verifying deployment on $TargetHost..."
    Write-Status "Expected SHA: $ExpectedSha"
    
    $success = $true
    
    # Verify web build
    Write-Status "Checking /web-build..."
    try {
        $webResponse = Invoke-RestMethod -Uri "$TargetHost/web-build" -SkipCertificateCheck -TimeoutSec 15 -ErrorAction Stop
        $webSha = $webResponse.git_sha
        if ($webSha -eq $ExpectedSha) {
            Write-Success "Web SHA matches: $webSha"
        } else {
            Write-Fail "Web SHA mismatch: got $webSha, expected $ExpectedSha"
            $success = $false
        }
    } catch {
        # Fallback for older PowerShell without SkipCertificateCheck
        try {
            [System.Net.ServicePointManager]::ServerCertificateValidationCallback = { $true }
            $webResponse = Invoke-RestMethod -Uri "$TargetHost/web-build" -TimeoutSec 15
            $webSha = $webResponse.git_sha
            if ($webSha -eq $ExpectedSha) {
                Write-Success "Web SHA matches: $webSha"
            } else {
                Write-Fail "Web SHA mismatch: got $webSha, expected $ExpectedSha"
                $success = $false
            }
        } catch {
            Write-Fail "Failed to reach /web-build: $_"
            $success = $false
        }
    }
    
    # Verify server build
    Write-Status "Checking /api/health/build..."
    try {
        $serverResponse = Invoke-RestMethod -Uri "$TargetHost/api/health/build" -SkipCertificateCheck -TimeoutSec 15 -ErrorAction Stop
        $serverSha = $serverResponse.git_sha
        if ($serverSha -eq $ExpectedSha) {
            Write-Success "Server SHA matches: $serverSha"
        } else {
            Write-Fail "Server SHA mismatch: got $serverSha, expected $ExpectedSha"
            $success = $false
        }
    } catch {
        try {
            [System.Net.ServicePointManager]::ServerCertificateValidationCallback = { $true }
            $serverResponse = Invoke-RestMethod -Uri "$TargetHost/api/health/build" -TimeoutSec 15
            $serverSha = $serverResponse.git_sha
            if ($serverSha -eq $ExpectedSha) {
                Write-Success "Server SHA matches: $serverSha"
            } else {
                Write-Fail "Server SHA mismatch: got $serverSha, expected $ExpectedSha"
                $success = $false
            }
        } catch {
            Write-Fail "Failed to reach /api/health/build: $_"
            $success = $false
        }
    }
    
    # Verify diagnostics page
    Write-Status "Checking /diagnostics..."
    try {
        $diagResponse = Invoke-WebRequest -Uri "$TargetHost/diagnostics" -SkipCertificateCheck -TimeoutSec 15 -ErrorAction Stop
        if ($diagResponse.StatusCode -eq 200) {
            Write-Success "/diagnostics returns 200 OK"
        } else {
            Write-Fail "/diagnostics returned $($diagResponse.StatusCode)"
            $success = $false
        }
    } catch {
        try {
            [System.Net.ServicePointManager]::ServerCertificateValidationCallback = { $true }
            $diagResponse = Invoke-WebRequest -Uri "$TargetHost/diagnostics" -TimeoutSec 15
            if ($diagResponse.StatusCode -eq 200) {
                Write-Success "/diagnostics returns 200 OK"
            } else {
                Write-Fail "/diagnostics returned $($diagResponse.StatusCode)"
                $success = $false
            }
        } catch {
            Write-Fail "Failed to reach /diagnostics: $_"
            $success = $false
        }
    }
    
    # Show container status
    Write-Status "Container status:"
    docker ps --filter "name=jarvis" --format "table {{.Names}}\t{{.Status}}\t{{.Image}}"
    
    return $success
}

# Main execution
Write-Host ""
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host "  AKIOR Deterministic Deploy Script  " -ForegroundColor Cyan
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host ""

$gitSha = Get-GitSha
$buildTime = Get-BuildTime

Write-Status "Repository: $RepoRoot"
Write-Status "Compose file: $ComposeFile"
Write-Status "Git SHA: $gitSha"
Write-Status "Build time: $buildTime"
Write-Host ""

if ($Verify) {
    Write-Status "Verification-only mode"
    $result = Invoke-Verification -ExpectedSha $gitSha -TargetHost $Host
    if ($result) {
        Write-Host ""
        Write-Success "Deployment verified successfully!"
        exit 0
    } else {
        Write-Host ""
        Write-Fail "Deployment verification failed!"
        exit 1
    }
}

if ($Rebuild) {
    Invoke-Build -GitSha $gitSha -BuildTime $buildTime -NoCache:$NoCache
    Write-Host ""
}

Invoke-Deploy
Write-Host ""

$result = Invoke-Verification -ExpectedSha $gitSha -TargetHost $Host

Write-Host ""
if ($result) {
    Write-Success "======================================"
    Write-Success "  DEPLOYMENT COMPLETE - ALL VERIFIED  "
    Write-Success "======================================"
    Write-Host ""
    Write-Host "Web and Server are both running SHA: $gitSha"
    Write-Host "View diagnostics: $Host/diagnostics"
    exit 0
} else {
    Write-Fail "======================================"
    Write-Fail "  DEPLOYMENT VERIFICATION FAILED     "
    Write-Fail "======================================"
    Write-Host ""
    Write-Host "Check container logs: docker compose -f $ComposeFile logs"
    exit 1
}
