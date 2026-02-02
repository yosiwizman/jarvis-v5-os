param(
  [string]$Hostname = "akior.home.arpa",
  [switch]$Apply,
  [switch]$Remove,
  [switch]$UseLoopback = $true,
  [switch]$UseLanIp,
  [switch]$Silent
)

$ErrorActionPreference = "Stop"

function Write-Step($msg) { if (-not $Silent) { Write-Host "==> $msg" -ForegroundColor Cyan } }
function Write-Info($msg) { if (-not $Silent) { Write-Host $msg } }
function Write-Warn($msg) { if (-not $Silent) { Write-Host "[WARN] $msg" -ForegroundColor Yellow } }
function Write-Ok($msg)   { if (-not $Silent) { Write-Host "[OK] $msg" -ForegroundColor Green } }
function Write-Fail($msg) { Write-Host "[FAIL] $msg" -ForegroundColor Red }

# Elevation check (Windows)
function Ensure-Elevation {
  if ($Apply -or $Remove) {
    if ($env:OS -notlike "*Windows*") {
      return
    }
    $currentUser = [Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = New-Object Security.Principal.WindowsPrincipal($currentUser)
    $isAdmin = $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
    if (-not $isAdmin) {
      Write-Step "Re-launching with elevation..."
      $args = @("-File `"$PSCommandPath`"")
      if ($Apply) { $args += "-Apply" }
      if ($Remove) { $args += "-Remove" }
      if ($UseLoopback) { $args += "-UseLoopback" }
      if ($UseLanIp) { $args += "-UseLanIp" }
      if ($Silent) { $args += "-Silent" }
      Start-Process powershell -Verb RunAs -ArgumentList $args
      exit 0
    }
  }
}

Ensure-Elevation

function Get-LanIp {
  $candidate = Get-NetIPAddress -AddressFamily IPv4 -InterfaceAlias "*" |
    Where-Object { $_.IPAddress -notlike "169.*" -and $_.IPAddress -notlike "127.*" -and $_.IPAddress -notlike "0.*" } |
    Select-Object -First 1 -ExpandProperty IPAddress
  return $candidate
}

function Get-TargetIp {
  if ($UseLanIp) {
    $lan = Get-LanIp
    if (-not $lan) { throw "Could not detect LAN IP." }
    return $lan
  }
  return "127.0.0.1"
}

function Get-HostsPath {
  if ($env:OS -like "*Windows*") {
    return "$env:SystemRoot\\System32\\drivers\\etc\\hosts"
  }
  return "/etc/hosts"
}

function Remove-ManagedBlock([string]$content) {
  return ($content -replace "(?ms)^# AKIOR HOST OVERRIDES \(managed\).*?# END AKIOR HOST OVERRIDES\\s*", "")
}

function Write-ManagedBlock([string]$path, [string]$ip) {
  $content = Get-Content -Raw -Path $path -ErrorAction SilentlyContinue
  $content = Remove-ManagedBlock $content
  $block = @(
    "# AKIOR HOST OVERRIDES (managed)",
    "$ip akior.local",
    "$ip jarvis.local",
    "$ip akior.home.arpa",
    "# END AKIOR HOST OVERRIDES"
  ) -join "`r`n"
  if ($content -and -not $content.EndsWith("`r`n")) { $content += "`r`n" }
  $newContent = $content + $block + "`r`n"
  Set-Content -Path $path -Value $newContent -Encoding ASCII
}

function Remove-Block([string]$path) {
  $content = Get-Content -Raw -Path $path -ErrorAction SilentlyContinue
  $newContent = Remove-ManagedBlock $content
  Set-Content -Path $path -Value $newContent -Encoding ASCII
}

function Flush-Dns {
  try { ipconfig /flushdns | Out-Null } catch { Write-Warn "ipconfig /flushdns failed: $_" }
  try { Restart-Service -Name Dnscache -ErrorAction SilentlyContinue } catch { Write-Warn "Could not restart Dnscache (likely not permitted)."; }
}

function Curl-Json($url) {
  $raw = & curl.exe -k $url 2>$null
  try { return $raw | ConvertFrom-Json } catch { return $null }
}

function Verify-Build($ip) {
  $local = Curl-Json "http://localhost:3000/api/health/build"
  $host1 = Curl-Json "https://akior.local/api/health/build"
  $host2 = Curl-Json "https://akior.home.arpa/api/health/build"
  Write-Info "Local build git_sha: $($local.git_sha)"
  Write-Info "akior.local git_sha: $($host1.git_sha)"
  Write-Info "akior.home.arpa git_sha: $($host2.git_sha)"
  if ($local -and $host1 -and $local.git_sha -eq $host1.git_sha) { Write-Ok "akior.local matches local ($($local.git_sha))" } else { Write-Warn "akior.local mismatch" }
  if ($local -and $host2 -and $local.git_sha -eq $host2.git_sha) { Write-Ok "akior.home.arpa matches local ($($local.git_sha))" } else { Write-Warn "akior.home.arpa mismatch or not resolvable" }
}

$ipToUse = Get-TargetIp

if ($Apply) {
  $hostsPath = Get-HostsPath
  Write-Step "Applying hosts overrides to $hostsPath using IP $ipToUse"
  Write-ManagedBlock -path $hostsPath -ip $ipToUse
  Write-Step "Flushing DNS cache"
  Flush-Dns
  Write-Step "Verification"
  Verify-Build $ipToUse
  exit 0
}

if ($Remove) {
  $hostsPath = Get-HostsPath
  Write-Step "Removing managed hosts overrides from $hostsPath"
  Remove-Block -path $hostsPath
  Write-Step "Flushing DNS cache"
  Flush-Dns
  Write-Ok "Removed managed overrides."
  exit 0
}

# Default info mode
$lanIp = Get-LanIp
Write-Info "LAN IP: $lanIp"
Write-Info "Hosts entry:"
Write-Info "$ipToUse`t$Hostname"
Write-Info "Use -Apply to write this entry (or -UseLanIp to use LAN IP)."
