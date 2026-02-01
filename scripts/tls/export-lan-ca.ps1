$ErrorActionPreference = "Stop"

$RepoRoot = Resolve-Path (Join-Path $PSScriptRoot "..\..")
$OutDir = Join-Path $RepoRoot "out\certs"
$OutFile = Join-Path $OutDir "akior-lan-root-ca.crt"
$ContainerName = "jarvis-caddy"
$CaddyRootPath = "/data/caddy/pki/authorities/local/root.crt"

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    Write-Error "Docker is not installed or not in PATH."
    exit 1
}

$running = docker ps --format "{{.Names}}" | Select-String -SimpleMatch $ContainerName
if (-not $running) {
    Write-Error "Container '$ContainerName' is not running. Start the stack first."
    exit 1
}

New-Item -ItemType Directory -Force -Path $OutDir | Out-Null

docker cp "$ContainerName:$CaddyRootPath" "$OutFile"

Write-Host ""
Write-Host "✅ Exported LAN root CA to:" -ForegroundColor Green
Write-Host "   $OutFile"
Write-Host ""
Write-Host "Next (Windows 11, elevated PowerShell):"
Write-Host "  Import-Certificate -FilePath `"$OutFile`" -CertStoreLocation Cert:\LocalMachine\Root"
Write-Host ""
Write-Host "See docs/ops/lan-tls-trust.md for macOS/iOS/Android steps."
