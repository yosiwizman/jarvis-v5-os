# DNS Setup for akior.local

This document describes how to configure DNS so that `akior.local` resolves to your AKIOR server across your network.

## ⚠️ Canonical Host Rule

**ONE server. ONE IP. Network-wide.**

- `akior.local` MUST resolve to exactly ONE IP address across the entire LAN
- All clients (PCs, phones, tablets) MUS## Quick Verification

Use the verification scripts for automated checks:

```powershell
# Windows - full verification suite
.\scripts\net\verify-dns.ps1

# Linux/Mac
./scripts/net/verify-dns.sh
```

Or manually:

```powershell
# Check what akior.local resolves to
ping -n 1 akior.local

# Check if the correct server responds
curl https://akior.local/api/health/build -k
```

Expected: Ping returns the IP from `docs/ops/canonical-host.md`, and the API returns the expected build SHA.

## Option 1: Router DNS (Recommended)

Most home routers support custom DNS entries. This is the best option as it works for all devices on your network automatically.

### Steps:

1. Find your AKIOR server's LAN IP:
   ```powershell
   # On the AKIOR server
   ipconfig | Select-String "IPv4"
   ```

2. Log into your router admin panel (usually `192.168.1.1` or `192.168.0.1`)

3. Navigate to DNS/DHCP settings (varies by router):
   - **ASUS**: LAN → DHCP Server → Manual Assignment
   - **TP-Link**: DHCP → Address Reservation
   - **UniFi**: Settings → Networks → DHCP Name Server
   - **pfSense**: Services → DNS Resolver → Host Overrides

4. Add entry:
   - Hostname: `akior` (without `.local`)
   - Domain: `local`
   - IP Address: `<your AKIOR server IP>`

5. Save and reboot router if required

6. Flush DNS cache on clients:
   ```powershell
   ipconfig /flushdns
   ```

## Option 2: Hosts File (Per-Device)

**⚠️ Temporary only. Violates canonical host rule for production.**

Quick fix for a single machine during initial setup or debugging.

### Windows:

Run as Administrator:
```powershell
notepad C:\Windows\System32\drivers\etc\hosts
```

Add line:
```
192.168.1.100  akior.local
```

Replace `192.168.1.100` with your AKIOR server IP.

### Linux/Mac:

```bash
sudo nano /etc/hosts
```

Add line:
```
192.168.1.100  akior.local
```

## Option 3: Local DNS Server (Enterprise-Grade)

For networks where router DNS is insufficient. This provides centralized DNS control for the entire LAN.

### AdGuard Home (Recommended)

AdGuard Home provides DNS with ad-blocking and custom rewrites. Best for home labs and small teams.

1. Install via Docker on the AKIOR server:
   ```yaml
   # docker-compose.adguard.yml
   services:
     adguard:
       image: adguard/adguardhome
       network_mode: host  # Required for port 53
       volumes:
         - ./adguard/work:/opt/adguardhome/work
         - ./adguard/conf:/opt/adguardhome/conf
       restart: unless-stopped
   ```

   ```powershell
   # Start AdGuard Home
   docker compose -f docker-compose.adguard.yml up -d
   ```

2. Access setup wizard at `http://<AKIOR_SERVER_IP>:3000`
   - Set admin credentials
   - Configure upstream DNS (e.g., `8.8.8.8`, `1.1.1.1`)

3. Add DNS rewrite:
   - Go to **Filters → DNS rewrites**
   - Add: `akior.local` → `<AKIOR_SERVER_IP>`

4. Configure router DHCP to use AdGuard as DNS:
   - Router admin → DHCP settings
   - Set **Primary DNS** = `<AKIOR_SERVER_IP>`
   - Leave Secondary DNS empty or use `8.8.8.8` as fallback

5. Force clients to pick up new DNS:
   - Disconnect/reconnect Wi-Fi, OR
   - `ipconfig /release && ipconfig /renew` (Windows), OR
   - Reboot devices

### dnsmasq (Lightweight Fallback)

Minimal DNS forwarder for Linux servers. Good for headless/CLI-only environments.

```bash
# Install
sudo apt install dnsmasq

# Configure (replace <AKIOR_SERVER_IP> with actual IP)
echo "address=/akior.local/<AKIOR_SERVER_IP>" | sudo tee /etc/dnsmasq.d/akior.conf
echo "server=8.8.8.8" | sudo tee -a /etc/dnsmasq.d/akior.conf

# Restart
sudo systemctl restart dnsmasq

# Verify
dig @localhost akior.local
```

Then configure router DHCP to use this server's IP as the DNS server.

## Option 4: mDNS/Bonjour (Zero-Config)

If your AKIOR server runs Avahi (Linux) or Bonjour (Mac), it may already advertise `akior.local` automatically.

### Check if mDNS is working:

```bash
# Linux
avahi-resolve -n akior.local

# Mac
dns-sd -G v4 akior.local
```

### Enable Avahi on Linux:

```bash
sudo apt install avahi-daemon
sudo systemctl enable avahi-daemon
sudo systemctl start avahi-daemon
```

Configure `/etc/avahi/avahi-daemon.conf`:
```ini
[server]
host-name=akior
domain-name=local
```

**Note**: mDNS requires all clients to support it (Windows requires Bonjour Print Services or iTunes installed).

## Troubleshooting

### DNS Not Resolving

```powershell
# Flush DNS cache
ipconfig /flushdns

# Check DNS server being used
nslookup akior.local

# Try direct IP access (replace with canonical IP from docs/ops/canonical-host.md)
curl https://<CANONICAL_IP>/api/health/build -k
```

### Wrong IP (Most Common Issue)

If `akior.local` resolves to the wrong IP:

1. **Check local hosts file first** (often the culprit):
   ```powershell
   # Windows
   type C:\Windows\System32\drivers\etc\hosts | findstr akior
   
   # Linux/Mac
   grep akior /etc/hosts
   ```

2. **Remove stale hosts entries**:
   ```powershell
   # Windows (Admin PowerShell)
   (Get-Content C:\Windows\System32\drivers\etc\hosts) | Where-Object { $_ -notmatch 'akior' } | Set-Content C:\Windows\System32\drivers\etc\hosts
   ```

3. **Check router DNS entries** - ensure only one entry for `akior.local`

4. **Check for multiple DNS servers** - only one should have the `akior.local` override

5. **Verify with verification script**:
   ```powershell
   .\scripts\net\verify-dns.ps1
   ```

### Certificate Errors

Caddy generates self-signed certificates for `akior.local`. You need to:

1. Export Caddy's root CA:
   ```bash
   docker cp jarvis-caddy:/data/caddy/pki/authorities/local/root.crt ./caddy-root-ca.crt
   ```

2. Import on Windows:
   - Double-click the `.crt` file
   - Install Certificate → Local Machine
   - Place in "Trusted Root Certification Authorities"

## Canonical Architecture

For production deployments:

```
┌─────────────────┐     ┌─────────────────┐
│  Client Device  │     │  AKIOR Server   │
│                 │     │                 │
│  Browser        │────▶│  Caddy (443)    │
│  akior.local    │     │    ↓            │
└─────────────────┘     │  Next.js (3001) │
         │              │  Fastify (1234) │
         │              └─────────────────┘
         │
    DNS Resolution:
    akior.local → 192.168.1.100
    (via Router DNS or hosts file)
```

## DHCP Lease Renewal

After changing DNS settings, clients need to pick up the new configuration:

### Windows
```powershell
# Release and renew DHCP lease
ipconfig /release
ipconfig /renew
ipconfig /flushdns

# Verify
nslookup akior.local
```

### Linux
```bash
# Restart NetworkManager
sudo systemctl restart NetworkManager

# Or manually
sudo dhclient -r && sudo dhclient
```

### Mac
```bash
# Renew DHCP lease
sudo ipconfig set en0 DHCP

# Flush DNS
sudo dscacheutil -flushcache && sudo killall -HUP mDNSResponder
```

### All Devices (Nuclear Option)
If devices aren't picking up new DNS, reboot the router. This forces all DHCP leases to renew.

## Related

- `docs/ops/canonical-host.md` - Canonical server IP and change process
- `docs/runbooks/deploy-drift.md` - Deployment drift troubleshooting
- `scripts/net/verify-dns.ps1` - DNS verification script (Windows)
- `scripts/net/verify-dns.sh` - DNS verification script (Linux/Mac)
- `deploy/Caddyfile` - Caddy reverse proxy configuration
- `deploy/compose.jarvis.yml` - Docker Compose stack
