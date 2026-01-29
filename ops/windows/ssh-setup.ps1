#Requires -Version 5.1
<#
.SYNOPSIS
    Validates and sets up SSH key-only access to aifactory-lan host.

.DESCRIPTION
    This script:
    1. Validates the Windows SSH config for aifactory-lan alias
    2. Installs the local ed25519 public key onto the remote host (if needed)
    3. Verifies BatchMode=yes works (key-only, no password prompts)

    If BatchMode verification fails, it provides detailed diagnostics.

.PARAMETER HostAlias
    SSH host alias (default: aifactory-lan)

.PARAMETER TargetHost
    IP or hostname of the target (default: read from SSH config)

.PARAMETER User
    SSH username (default: yosi)

.PARAMETER IdentityFile
    Path to the ed25519 private key (default: $env:USERPROFILE\.ssh\id_ed25519)

.EXAMPLE
    .\ssh-setup.ps1
    Runs full validation and setup with defaults.

.EXAMPLE
    .\ssh-setup.ps1 -HostAlias myhost -User admin
    Uses custom host alias and username.
#>

[CmdletBinding()]
param(
    [string]$HostAlias = "aifactory-lan",
    [string]$TargetHost = "",
    [string]$User = "yosi",
    [string]$IdentityFile = "$env:USERPROFILE\.ssh\id_ed25519"
)

$ErrorActionPreference = "Stop"
$SSHConfigPath = "$env:USERPROFILE\.ssh\config"

function Write-Step {
    param([string]$Message)
    Write-Host "`n=== $Message ===" -ForegroundColor Cyan
}

function Write-OK {
    param([string]$Message)
    Write-Host "[OK] $Message" -ForegroundColor Green
}

function Write-Fail {
    param([string]$Message)
    Write-Host "[FAIL] $Message" -ForegroundColor Red
}

function Write-Warn {
    param([string]$Message)
    Write-Host "[WARN] $Message" -ForegroundColor Yellow
}

# Step 1: Check SSH client
Write-Step "Checking SSH client"
$sshPath = Get-Command ssh -ErrorAction SilentlyContinue
if (-not $sshPath) {
    Write-Fail "SSH client not found. Install OpenSSH or add it to PATH."
    exit 1
}
Write-OK "SSH client found: $($sshPath.Source)"

# Step 2: Check identity file
Write-Step "Checking identity file"
$pubKeyPath = "$IdentityFile.pub"
if (-not (Test-Path $IdentityFile)) {
    Write-Fail "Private key not found: $IdentityFile"
    Write-Host "Generate with: ssh-keygen -t ed25519 -C `"$env:USERNAME-windows`""
    exit 1
}
if (-not (Test-Path $pubKeyPath)) {
    Write-Fail "Public key not found: $pubKeyPath"
    exit 1
}
Write-OK "Identity file exists: $IdentityFile"

$localFingerprint = (ssh-keygen -lf $pubKeyPath 2>&1) -replace '\s+', ' '
Write-Host "    Local key fingerprint: $localFingerprint"

# Step 3: Validate SSH config
Write-Step "Validating SSH config"
if (-not (Test-Path $SSHConfigPath)) {
    Write-Warn "SSH config not found. Creating minimal config..."
    $configContent = @"
Host $HostAlias
  HostName <TARGET_IP>
  User $User
  IdentityFile $IdentityFile
  IdentitiesOnly yes
  StrictHostKeyChecking accept-new
  ServerAliveInterval 30
  ServerAliveCountMax 3
"@
    New-Item -ItemType File -Path $SSHConfigPath -Force | Out-Null
    Set-Content -Path $SSHConfigPath -Value $configContent -Encoding UTF8
    Write-Warn "Created SSH config with placeholder. Edit $SSHConfigPath and set HostName."
    exit 1
}

$configContent = Get-Content $SSHConfigPath -Raw
$hasHostAlias = $configContent -match "Host\s+$HostAlias"
if (-not $hasHostAlias) {
    Write-Fail "Host alias '$HostAlias' not found in SSH config"
    Write-Host "Add the following to $SSHConfigPath :"
    Write-Host @"

Host $HostAlias
  HostName <TARGET_IP>
  User $User
  IdentityFile $IdentityFile
  IdentitiesOnly yes
  StrictHostKeyChecking accept-new
  ServerAliveInterval 30
  ServerAliveCountMax 3
"@
    exit 1
}

# Check required directives
$requiredDirectives = @("HostName", "User", "IdentityFile", "IdentitiesOnly")
$missingDirectives = @()
foreach ($directive in $requiredDirectives) {
    if ($configContent -notmatch "$directive\s+\S+") {
        $missingDirectives += $directive
    }
}
if ($missingDirectives.Count -gt 0) {
    Write-Warn "SSH config missing recommended directives: $($missingDirectives -join ', ')"
}
Write-OK "SSH config has Host $HostAlias"

# Step 4: Test BatchMode (before attempting key install)
Write-Step "Testing BatchMode=yes (key-only auth)"
$batchResult = & ssh -o BatchMode=yes -o ConnectTimeout=5 $HostAlias "echo BATCHMODE_OK" 2>&1
if ($LASTEXITCODE -eq 0 -and $batchResult -match "BATCHMODE_OK") {
    Write-OK "BatchMode works! Key-only SSH is already configured."
    Write-Host "`nProof:"
    & ssh -o BatchMode=yes $HostAlias "whoami; hostname; uptime"
    Write-Host "`n[SUCCESS] SSH setup is complete. No further action needed." -ForegroundColor Green
    exit 0
}

Write-Warn "BatchMode failed. Key may not be installed on remote host."

# Step 5: Install key (requires password)
Write-Step "Installing public key on remote host"
Write-Host "This will prompt for the remote password ONCE to install the key."
Write-Host "Press Ctrl+C to cancel, or Enter to continue..."
Read-Host

$pubKeyContent = Get-Content $pubKeyPath -Raw
Write-Host "Installing key to $User@$HostAlias ..."

# Use interactive SSH to install the key
$installCmd = @"
set -e
umask 077
mkdir -p ~/.ssh
echo '$($pubKeyContent.Trim())' >> ~/.ssh/authorized_keys
sort -u -o ~/.ssh/authorized_keys ~/.ssh/authorized_keys
chown -R `$(whoami):`$(whoami) ~/.ssh
chmod 700 ~/.ssh
chmod 600 ~/.ssh/authorized_keys
echo '=== Key installed. Fingerprints on host: ==='
ssh-keygen -lf ~/.ssh/authorized_keys
"@

& ssh -o PreferredAuthentications=keyboard-interactive,password -o PubkeyAuthentication=no $HostAlias $installCmd
if ($LASTEXITCODE -ne 0) {
    Write-Fail "Key installation failed. Check password and try again."
    exit 1
}

Write-OK "Key installed on remote host."

# Step 6: Verify BatchMode now works
Write-Step "Verifying BatchMode=yes (post-install)"
Start-Sleep -Seconds 1
$batchResult2 = & ssh -o BatchMode=yes -o ConnectTimeout=5 $HostAlias "echo BATCHMODE_OK && whoami && hostname" 2>&1
if ($LASTEXITCODE -eq 0 -and $batchResult2 -match "BATCHMODE_OK") {
    Write-OK "BatchMode verified successfully!"
    Write-Host "`nProof:"
    Write-Host $batchResult2
    Write-Host "`n[SUCCESS] SSH key-only access is now configured." -ForegroundColor Green
    exit 0
}

# BatchMode still failing - provide diagnostics
Write-Fail "BatchMode still failing after key install"
Write-Host "`nDiagnostics:"

Write-Host "`n1. Verbose SSH output:"
& ssh -vvv -o BatchMode=yes -o ConnectTimeout=5 $HostAlias "true" 2>&1 | Select-String -Pattern "Offering|identity|Permission denied|Authentications"

Write-Host "`n2. Common causes:"
Write-Host "   - Wrong key fingerprint (compare local vs remote)"
Write-Host "   - Bad permissions on ~/.ssh or ~/.ssh/authorized_keys"
Write-Host "   - CRLF line endings in authorized_keys (run dos2unix)"
Write-Host "   - sshd AuthorizedKeysFile points elsewhere"

Write-Host "`n3. Check remote sshd config:"
Write-Host "   ssh $HostAlias `"sudo sshd -T | egrep 'pubkeyauthentication|authorizedkeysfile'`""

Write-Host "`n4. Check remote permissions:"
Write-Host "   ssh $HostAlias `"ls -ld ~/.ssh ~/.ssh/authorized_keys`""

exit 1
