param(
  [string]$Hostname = "akior.home.arpa"
)

$ip = (Get-NetIPAddress -AddressFamily IPv4 -InterfaceAlias "*" | Where-Object {$_.IPAddress -notlike "169.*" -and $_.IPAddress -notlike "127.*"} | Select-Object -First 1 -ExpandProperty IPAddress)
Write-Host "LAN IP: $ip"
Write-Host "Hosts entry:"
Write-Host "$ip`t$Hostname"
Write-Host "Copy/paste that line into your hosts file if DNS is not pointing to this host."
