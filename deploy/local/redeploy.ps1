<#
.SYNOPSIS
    One-command redeploy script for AKIOR local stack.

.DESCRIPTION
    This script performs a complete redeploy of the AKIOR stack:
    1. Pulls latest code from main
    2. Stops existing containers
    3. Rebuilds images with --no-cache (injects git SHA and build time)
    4. Starts containers with --force-recreate
    5. Waits for health checks to pass
    6. Verifies /api/health/build returns the correct SHA

.PARAMETER SkipPull
    Skip git pull (useful for testing local changes)

.PARAMETER BaseUrl
    Base URL for health checks (default: https://akior.local)

.EXAMPLE
    .\redeploy.ps1
    
.EXAMPLE
    .\redeploy.ps1 -SkipPull -BaseUrl "http://localhost:3000"
#>

param(
    [switch]$SkipPull,
    [string]$BaseUrl = "https://akior.local"
)

$ErrorActionPreference = "Stop"

# Colors for output
function Write-Step { param($msg) Write-Host "`n==> $msg" -ForegroundColor Cyan }
function Write-Success { param($msg) Write-Host "[OK] $msg" -ForegroundColor Green }
function Write-Warn { param($msg) Write-Host "[WARN] $msg" -ForegroundColor Yellow }
function Write-Fail { param($msg) Write-Host "[FAIL] $msg" -ForegroundColor Red }

# Get script and repo root directory
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RepoRoot = (Get-Item $ScriptDir).Parent.Parent.FullName
$DeployDir = Join-Path $RepoRoot "deploy"

Write-Host "`n========================================" -ForegroundColor Magenta
Write-Host "  AKIOR Local Stack Redeploy" -ForegroundColor Magenta
Write-Host "========================================`n" -ForegroundColor Magenta

# Change to repo root
Set-Location $RepoRoot
Write-Host "Repo: $RepoRoot"
Write-Host "Base URL: $BaseUrl"

# Step 1: Git pull
if (-not $SkipPull) {
    Write-Step "Pulling latest code from main..."
    git fetch origin main
    git checkout main
    git pull origin main
    Write-Success "Code updated"
} else {
    Write-Warn "Skipping git pull (--SkipPull)"
}

# Get git SHA for build args
$GitSha = git rev-parse --short HEAD
$BuildTime = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
Write-Host "Git SHA: $GitSha"
Write-Host "Build Time: $BuildTime"

# Step 2: Stop existing containers
Write-Step "Stopping existing containers..."
docker compose -f "$DeployDir\compose.jarvis.yml" down --remove-orphans 2>$null
Write-Success "Containers stopped"

# Step 3: Rebuild images with --no-cache
Write-Step "Rebuilding images (no-cache)..."
Write-Host "This may take several minutes..."

# Build with build args
$env:DOCKER_BUILDKIT = "1"
docker compose -f "$DeployDir\compose.jarvis.yml" build --no-cache `
    --build-arg GIT_SHA=$GitSha `
    --build-arg BUILD_TIME=$BuildTime

if ($LASTEXITCODE -ne 0) {
    Write-Fail "Build failed!"
    exit 1
}
Write-Success "Images rebuilt with SHA=$GitSha"

# Step 4: Start containers
Write-Step "Starting containers..."
docker compose -f "$DeployDir\compose.jarvis.yml" up -d --force-recreate

if ($LASTEXITCODE -ne 0) {
    Write-Fail "Failed to start containers!"
    exit 1
}
Write-Success "Containers started"

# Step 5: Wait for health
Write-Step "Waiting for services to be healthy..."

$maxAttempts = 30
$attempt = 0
$healthy = $false

# Ignore SSL errors for self-signed certs
[System.Net.ServicePointManager]::ServerCertificateValidationCallback = { $true }

while ($attempt -lt $maxAttempts -and -not $healthy) {
    $attempt++
    Write-Host "  Attempt $attempt/$maxAttempts..." -NoNewline
    
    try {
        # Try to reach health endpoint
        $response = Invoke-RestMethod -Uri "$BaseUrl/api/health" -TimeoutSec 5 -SkipCertificateCheck 2>$null
        if ($response.ok -eq $true) {
            $healthy = $true
            Write-Host " healthy!" -ForegroundColor Green
        } else {
            Write-Host " not ready" -ForegroundColor Yellow
        }
    } catch {
        Write-Host " waiting..." -ForegroundColor Yellow
    }
    
    if (-not $healthy) {
        Start-Sleep -Seconds 2
    }
}

if (-not $healthy) {
    Write-Fail "Services did not become healthy within timeout!"
    Write-Host "Check logs: docker compose -f deploy/compose.jarvis.yml logs"
    exit 1
}

Write-Success "Services are healthy"

# Step 6: Verify build SHA
Write-Step "Verifying deployed build..."

try {
    $buildInfo = Invoke-RestMethod -Uri "$BaseUrl/api/health/build" -TimeoutSec 5 -SkipCertificateCheck
    
    Write-Host "`n  Build Info from /api/health/build:"
    Write-Host "    git_sha:    $($buildInfo.git_sha)"
    Write-Host "    build_time: $($buildInfo.build_time)"
    Write-Host "    service:    $($buildInfo.service)"
    
    if ($buildInfo.git_sha -eq $GitSha) {
        Write-Success "SHA matches! Deployment successful."
    } else {
        Write-Warn "SHA mismatch! Expected: $GitSha, Got: $($buildInfo.git_sha)"
        Write-Host "  This may indicate caching issues. Try:"
        Write-Host "    docker system prune -af"
        Write-Host "    Then run this script again."
    }
} catch {
    Write-Fail "Could not verify build info!"
    Write-Host "  Error: $_"
    Write-Host "  Check if /api/health/build endpoint exists."
    exit 1
}

# Step 7: Quick settings page check
Write-Step "Verifying /settings page loads..."

try {
    $settingsResponse = Invoke-WebRequest -Uri "$BaseUrl/settings" -TimeoutSec 10 -SkipCertificateCheck
    
    if ($settingsResponse.StatusCode -eq 200) {
        # Check for crash indicators
        if ($settingsResponse.Content -match "Application Error" -or $settingsResponse.Content -match "Cannot read properties of undefined") {
            Write-Warn "Settings page returned 200 but may contain error content"
        } else {
            Write-Success "Settings page loads without crash indicators"
        }
    }
} catch {
    Write-Warn "Could not fully verify settings page: $_"
}

# Summary
Write-Host "`n========================================" -ForegroundColor Magenta
Write-Host "  Redeploy Complete!" -ForegroundColor Magenta
Write-Host "========================================" -ForegroundColor Magenta
Write-Host "`n  Git SHA:    $GitSha"
Write-Host "  Build Time: $BuildTime"
Write-Host "  URL:        $BaseUrl"
Write-Host "`n  Verify manually:"
Write-Host "    1. Open $BaseUrl/api/health/build"
Write-Host "    2. Open $BaseUrl/settings"
Write-Host "    3. Check sidebar footer for Build: $GitSha"
Write-Host ""
